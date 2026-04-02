"""
Snowflake helpers for the data agent.
Handles connection, schema setup, Micro event parsing, amplification, and loading.
"""
import copy
import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

# Load personal credentials (.env) then shared project config (config.env).
# Both files are gitignored. Callers don't need to call load_dotenv() themselves.
load_dotenv()
load_dotenv("config.env")


# ---------------------------------------------------------------------------
# Connection
# ---------------------------------------------------------------------------

def get_connection():
    import snowflake.connector
    token = os.environ.get("SNOWFLAKE_TOKEN")
    if token:
        return snowflake.connector.connect(
            account=os.environ["SNOWFLAKE_ACCOUNT"],
            user=os.environ["SNOWFLAKE_USER"],
            authenticator="programmatic_access_token",
            token=token,
            database=os.environ["SNOWFLAKE_DATABASE"],
            warehouse=os.environ["SNOWFLAKE_WAREHOUSE"],
            role=os.environ.get("SNOWFLAKE_ROLE", ""),
            schema=os.environ.get("SNOWFLAKE_SCHEMA", "atomic"),
        )
    return snowflake.connector.connect(
        account=os.environ["SNOWFLAKE_ACCOUNT"],
        user=os.environ["SNOWFLAKE_USER"],
        password=os.environ["SNOWFLAKE_PASSWORD"],
        database=os.environ["SNOWFLAKE_DATABASE"],
        warehouse=os.environ["SNOWFLAKE_WAREHOUSE"],
        role=os.environ.get("SNOWFLAKE_ROLE", ""),
        schema=os.environ.get("SNOWFLAKE_SCHEMA", "atomic"),
    )


def execute_query(sql: str) -> dict:
    """Execute SQL and return rows + column names."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(sql)
        cols = [d[0].lower() for d in cur.description] if cur.description else []
        rows = cur.fetchall()
        return {
            "columns": cols,
            "rows": [dict(zip(cols, row)) for row in rows],
            "rowcount": len(rows),
            "success": True,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Schema + table setup
# ---------------------------------------------------------------------------

ATOMIC_DDL = """
CREATE SCHEMA IF NOT EXISTS {database}.{schema};

CREATE TABLE IF NOT EXISTS {database}.{schema}.events (
    event_id            VARCHAR,
    collector_tstamp    TIMESTAMP_NTZ,
    derived_tstamp      TIMESTAMP_NTZ,
    dvce_created_tstamp TIMESTAMP_NTZ,
    dvce_sent_tstamp    TIMESTAMP_NTZ,
    true_tstamp         TIMESTAMP_NTZ,
    etl_tstamp          TIMESTAMP_NTZ,

    app_id              VARCHAR,
    platform            VARCHAR,
    event               VARCHAR,
    event_name          VARCHAR,
    event_vendor        VARCHAR,
    event_format        VARCHAR,
    event_version       VARCHAR,

    user_id             VARCHAR,
    domain_userid       VARCHAR,
    network_userid      VARCHAR,
    domain_sessionid    VARCHAR,
    domain_sessionidx   INTEGER,

    page_url            VARCHAR,
    page_urlscheme      VARCHAR,
    page_urlhost        VARCHAR,
    page_urlport        INTEGER,
    page_urlpath        VARCHAR,
    page_urlquery       VARCHAR,
    page_urlfragment    VARCHAR,
    page_title          VARCHAR,
    page_referrer       VARCHAR,

    refr_urlscheme      VARCHAR,
    refr_urlhost        VARCHAR,
    refr_urlport        INTEGER,
    refr_urlpath        VARCHAR,
    refr_urlquery       VARCHAR,
    refr_medium         VARCHAR,
    refr_source         VARCHAR,
    refr_term           VARCHAR,

    mkt_medium          VARCHAR,
    mkt_source          VARCHAR,
    mkt_term            VARCHAR,
    mkt_content         VARCHAR,
    mkt_campaign        VARCHAR,
    mkt_clickid         VARCHAR,
    mkt_network         VARCHAR,

    geo_country         VARCHAR,
    geo_region          VARCHAR,
    geo_city            VARCHAR,
    geo_timezone        VARCHAR,
    geo_latitude        FLOAT,
    geo_longitude       FLOAT,
    geo_region_name     VARCHAR,

    useragent           VARCHAR,
    br_lang             VARCHAR,
    br_viewwidth        INTEGER,
    br_viewheight       INTEGER,
    br_colordepth       INTEGER,
    br_cookies          BOOLEAN,
    br_family           VARCHAR,

    os_family           VARCHAR,
    os_timezone         VARCHAR,
    dvce_type           VARCHAR,
    dvce_screenwidth    INTEGER,
    dvce_screenheight   INTEGER,

    doc_charset         VARCHAR,
    doc_width           INTEGER,
    doc_height          INTEGER,

    pp_xoffset_min      INTEGER,
    pp_xoffset_max      INTEGER,
    pp_yoffset_min      INTEGER,
    pp_yoffset_max      INTEGER,

    se_category         VARCHAR,
    se_action           VARCHAR,
    se_label            VARCHAR,
    se_property         VARCHAR,
    se_value            FLOAT,

    v_tracker           VARCHAR,
    v_collector         VARCHAR,
    v_etl               VARCHAR,

    unstruct_event      VARIANT,
    contexts_com_snowplowanalytics_snowplow_web_page_1  VARIANT,
    contexts_com_snowplowanalytics_snowplow_client_session_1  VARIANT
);
"""


def setup_atomic_table() -> dict:
    database = os.environ["SNOWFLAKE_DATABASE"]
    schema = os.environ.get("SNOWFLAKE_SCHEMA", "atomic")
    conn = get_connection()
    try:
        cur = conn.cursor()
        for statement in ATOMIC_DDL.format(database=database, schema=schema).split(";"):
            stmt = statement.strip()
            if stmt:
                cur.execute(stmt)
        conn.commit()
        return {"success": True, "message": f"{schema}.events table ready in {database}"}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Micro event parsing
# ---------------------------------------------------------------------------

def _parse_micro_events(micro_json: str) -> list[dict]:
    """
    Parse the raw JSON from Micro's /good endpoint.
    Micro returns a JSON array. Each element may be a flat enriched event dict
    or a nested object with an 'event' key containing the enriched fields.
    Returns a list of flat enriched event dicts.
    """
    data = json.loads(micro_json)

    if not isinstance(data, list):
        raise ValueError(f"Expected JSON array from Micro, got {type(data).__name__}")

    events = []
    for item in data:
        if isinstance(item, dict):
            # Micro wraps events: {"rawEvent": ..., "event": {...enriched...}, ...}
            event = item.get("event", item)
            events.append(event)

    return events


def _safe_ts(value, fallback_offset_days: int = 0) -> str:
    """Parse a timestamp string or return a generated one."""
    if value:
        try:
            # Handle various ISO formats
            ts = value.replace("Z", "+00:00")
            return datetime.fromisoformat(ts).strftime("%Y-%m-%d %H:%M:%S.%f")
        except Exception:
            pass
    ts = datetime.now(timezone.utc) - timedelta(days=fallback_offset_days)
    return ts.strftime("%Y-%m-%d %H:%M:%S.%f")


def _safe_json(value) -> str | None:
    """Ensure a value is a JSON string, or None."""
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return json.dumps(value)
    if isinstance(value, str):
        try:
            json.loads(value)  # validate
            return value
        except Exception:
            return None
    return None


def _extract_web_page_context(event: dict) -> str | None:
    """Extract web_page context from Micro event and format as a JSON array for Snowplow's atomic column."""
    contexts = event.get("contexts")
    if not contexts:
        return None
    if isinstance(contexts, str):
        try:
            contexts = json.loads(contexts)
        except Exception:
            return None
    data = contexts.get("data", []) if isinstance(contexts, dict) else []
    for ctx in data:
        schema = ctx.get("schema", "")
        if "web_page" in schema or "web-page" in schema:
            return json.dumps([ctx.get("data", {})])
    return None


def _safe_int(value) -> int | None:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _safe_float(value) -> float | None:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _event_to_row(event: dict, day_offset: int = 0) -> dict:
    """Map a Micro enriched event dict to an atomic.events row."""
    ts = _safe_ts(event.get("collector_tstamp") or event.get("collectorTstamp"), day_offset)
    created_ts = _safe_ts(event.get("dvce_created_tstamp") or event.get("dvceCreatedTstamp"), day_offset)
    derived_ts = _safe_ts(event.get("derived_tstamp") or event.get("derivedTstamp"), day_offset) or ts

    return {
        "event_id": str(uuid.uuid4()),
        "collector_tstamp": ts,
        "derived_tstamp": derived_ts,
        "dvce_created_tstamp": created_ts,
        "dvce_sent_tstamp": _safe_ts(event.get("dvce_sent_tstamp") or event.get("dvceSentTstamp"), day_offset) or created_ts,
        "true_tstamp": _safe_ts(event.get("true_tstamp") or event.get("trueTstamp"), day_offset),
        "etl_tstamp": ts,

        "app_id": event.get("app_id") or event.get("appId", ""),
        "platform": event.get("platform", "web"),
        "event": event.get("event", ""),
        "event_name": event.get("event_name") or event.get("eventName", ""),
        "event_vendor": event.get("event_vendor") or event.get("eventVendor", ""),
        "event_format": event.get("event_format") or event.get("eventFormat", "jsonschema"),
        "event_version": event.get("event_version") or event.get("eventVersion", ""),

        "user_id": event.get("user_id") or event.get("userId"),
        "domain_userid": event.get("domain_userid") or event.get("domainUserid", ""),
        "network_userid": event.get("network_userid") or event.get("networkUserid", ""),
        "domain_sessionid": event.get("domain_sessionid") or event.get("domainSessionid", ""),
        "domain_sessionidx": _safe_int(event.get("domain_sessionidx") or event.get("domainSessionidx")) or 1,

        "page_url": event.get("page_url") or event.get("pageUrl", ""),
        "page_urlscheme": event.get("page_urlscheme") or event.get("pageUrlscheme", ""),
        "page_urlhost": event.get("page_urlhost") or event.get("pageUrlhost", ""),
        "page_urlport": _safe_int(event.get("page_urlport") or event.get("pageUrlport")),
        "page_urlpath": event.get("page_urlpath") or event.get("pageUrlpath", ""),
        "page_urlquery": event.get("page_urlquery") or event.get("pageUrlquery"),
        "page_urlfragment": event.get("page_urlfragment") or event.get("pageUrlfragment"),
        "page_title": event.get("page_title") or event.get("pageTitle", ""),
        "page_referrer": event.get("page_referrer") or event.get("pageReferrer", ""),

        "refr_urlscheme": event.get("refr_urlscheme") or event.get("refrUrlscheme"),
        "refr_urlhost": event.get("refr_urlhost") or event.get("refrUrlhost"),
        "refr_urlport": _safe_int(event.get("refr_urlport") or event.get("refrUrlport")),
        "refr_urlpath": event.get("refr_urlpath") or event.get("refrUrlpath"),
        "refr_urlquery": event.get("refr_urlquery") or event.get("refrUrlquery"),
        "refr_medium": event.get("refr_medium") or event.get("refrMedium"),
        "refr_source": event.get("refr_source") or event.get("refrSource"),
        "refr_term": event.get("refr_term") or event.get("refrTerm"),

        "mkt_medium": event.get("mkt_medium") or event.get("mktMedium"),
        "mkt_source": event.get("mkt_source") or event.get("mktSource"),
        "mkt_term": event.get("mkt_term") or event.get("mktTerm"),
        "mkt_content": event.get("mkt_content") or event.get("mktContent"),
        "mkt_campaign": event.get("mkt_campaign") or event.get("mktCampaign"),
        "mkt_clickid": event.get("mkt_clickid") or event.get("mktClickid"),
        "mkt_network": event.get("mkt_network") or event.get("mktNetwork"),

        "geo_country": event.get("geo_country") or event.get("geoCountry"),
        "geo_region": event.get("geo_region") or event.get("geoRegion"),
        "geo_city": event.get("geo_city") or event.get("geoCity"),
        "geo_timezone": event.get("geo_timezone") or event.get("geoTimezone"),
        "geo_latitude": _safe_float(event.get("geo_latitude") or event.get("geoLatitude")),
        "geo_longitude": _safe_float(event.get("geo_longitude") or event.get("geoLongitude")),
        "geo_region_name": event.get("geo_region_name") or event.get("geoRegionName"),

        "useragent": event.get("useragent"),
        "br_lang": event.get("br_lang") or event.get("brLang"),
        "br_viewwidth": _safe_int(event.get("br_viewwidth") or event.get("brViewwidth")),
        "br_viewheight": _safe_int(event.get("br_viewheight") or event.get("brViewheight")),
        "br_colordepth": _safe_int(event.get("br_colordepth") or event.get("brColordepth")),
        "br_cookies": event.get("br_cookies") or event.get("brCookies"),
        "br_family": event.get("br_family") or event.get("brFamily"),

        "os_family": event.get("os_family") or event.get("osFamily"),
        "os_timezone": event.get("os_timezone") or event.get("osTimezone"),
        "dvce_type": event.get("dvce_type") or event.get("dvceType"),
        "dvce_screenwidth": _safe_int(event.get("dvce_screenwidth") or event.get("dvceScreenwidth")),
        "dvce_screenheight": _safe_int(event.get("dvce_screenheight") or event.get("dvceScreenheight")),

        "doc_charset": event.get("doc_charset") or event.get("docCharset"),
        "doc_width": _safe_int(event.get("doc_width") or event.get("docWidth")),
        "doc_height": _safe_int(event.get("doc_height") or event.get("docHeight")),

        "pp_xoffset_min": _safe_int(event.get("pp_xoffset_min") or event.get("ppXoffsetMin")),
        "pp_xoffset_max": _safe_int(event.get("pp_xoffset_max") or event.get("ppXoffsetMax")),
        "pp_yoffset_min": _safe_int(event.get("pp_yoffset_min") or event.get("ppYoffsetMin")),
        "pp_yoffset_max": _safe_int(event.get("pp_yoffset_max") or event.get("ppYoffsetMax")),

        "se_category": event.get("se_category") or event.get("seCategory"),
        "se_action": event.get("se_action") or event.get("seAction"),
        "se_label": event.get("se_label") or event.get("seLabel"),
        "se_property": event.get("se_property") or event.get("seProperty"),
        "se_value": _safe_float(event.get("se_value") or event.get("seValue")),

        "v_tracker": event.get("v_tracker") or event.get("vTracker", "js-3"),
        "v_collector": event.get("v_collector") or event.get("vCollector", "snowplow-micro"),
        "v_etl": event.get("v_etl") or event.get("vEtl", "snowplow-micro"),

        "unstruct_event": _safe_json(event.get("unstruct_event") or event.get("unstructEvent")),
        "contexts_com_snowplowanalytics_snowplow_web_page_1": _extract_web_page_context(event),
        "contexts_com_snowplowanalytics_snowplow_client_session_1": None,
    }


# ---------------------------------------------------------------------------
# Amplification
# ---------------------------------------------------------------------------

def _amplify(base_rows: list[dict], factor: int) -> list[dict]:
    """
    Copy base_rows 'factor' times, each copy getting a new domain_userid,
    domain_sessionid, and timestamps staggered back 1 day per copy.
    The original session is copy 0 (today).
    """
    all_rows = []
    for i in range(factor):
        new_user = uuid.uuid4().hex
        new_session = str(uuid.uuid4())
        for row in base_rows:
            new_row = copy.deepcopy(row)
            new_row["event_id"] = str(uuid.uuid4())
            new_row["domain_userid"] = new_user
            new_row["network_userid"] = new_user
            new_row["domain_sessionid"] = new_session
            # Shift timestamps back by i days
            for ts_field in ("collector_tstamp", "derived_tstamp", "dvce_created_tstamp", "dvce_sent_tstamp", "etl_tstamp", "true_tstamp"):
                if new_row.get(ts_field):
                    try:
                        original = datetime.strptime(new_row[ts_field], "%Y-%m-%d %H:%M:%S.%f")
                        shifted = original - timedelta(days=i)
                        new_row[ts_field] = shifted.strftime("%Y-%m-%d %H:%M:%S.%f")
                    except Exception:
                        pass
            all_rows.append(new_row)
    return all_rows


# ---------------------------------------------------------------------------
# Batch insert
# ---------------------------------------------------------------------------

_COLUMNS = [
    "event_id", "collector_tstamp", "derived_tstamp", "dvce_created_tstamp",
    "dvce_sent_tstamp", "true_tstamp", "etl_tstamp",
    "app_id", "platform", "event", "event_name", "event_vendor", "event_format", "event_version",
    "user_id", "domain_userid", "network_userid", "domain_sessionid", "domain_sessionidx",
    "page_url", "page_urlscheme", "page_urlhost", "page_urlport", "page_urlpath",
    "page_urlquery", "page_urlfragment", "page_title", "page_referrer",
    "refr_urlscheme", "refr_urlhost", "refr_urlport", "refr_urlpath", "refr_urlquery",
    "refr_medium", "refr_source", "refr_term",
    "mkt_medium", "mkt_source", "mkt_term", "mkt_content", "mkt_campaign", "mkt_clickid", "mkt_network",
    "geo_country", "geo_region", "geo_city", "geo_timezone", "geo_latitude", "geo_longitude", "geo_region_name",
    "useragent", "br_lang", "br_viewwidth", "br_viewheight", "br_colordepth", "br_cookies", "br_family",
    "os_family", "os_timezone", "dvce_type", "dvce_screenwidth", "dvce_screenheight",
    "doc_charset", "doc_width", "doc_height",
    "pp_xoffset_min", "pp_xoffset_max", "pp_yoffset_min", "pp_yoffset_max",
    "se_category", "se_action", "se_label", "se_property", "se_value",
    "v_tracker", "v_collector", "v_etl",
    "unstruct_event", "contexts_com_snowplowanalytics_snowplow_web_page_1",
    "contexts_com_snowplowanalytics_snowplow_client_session_1",
]

_VARIANT_COLS = {
    "unstruct_event",
    "contexts_com_snowplowanalytics_snowplow_web_page_1",
    "contexts_com_snowplowanalytics_snowplow_client_session_1",
}


def _insert_rows(conn, rows: list[dict], batch_size: int = 50):
    schema = os.environ.get("SNOWFLAKE_SCHEMA", "atomic")
    col_list = ", ".join(_COLUMNS)
    placeholders = ", ".join(
        f"PARSE_JSON(%s)" if col in _VARIANT_COLS else "%s"
        for col in _COLUMNS
    )
    sql = f"INSERT INTO {schema}.events ({col_list}) SELECT {placeholders}"
    cur = conn.cursor()
    for i in range(0, len(rows), batch_size):
        chunk = rows[i : i + batch_size]
        for row in chunk:
            params = tuple(row.get(col) for col in _COLUMNS)
            cur.execute(sql, params)
    conn.commit()


# ---------------------------------------------------------------------------
# Main entry point exposed as a tool
# ---------------------------------------------------------------------------

def process_and_load_micro_events(micro_events_json: str, amplification_factor: int = 9) -> dict:
    """
    Parse Micro /good events, amplify across multiple sessions, load to Snowflake.
    Returns a summary dict.
    """
    try:
        raw_events = _parse_micro_events(micro_events_json)
    except Exception as e:
        return {"success": False, "error": f"Failed to parse Micro events: {e}"}

    if not raw_events:
        return {"success": False, "error": "No events returned from Micro. Browse the demo site first."}

    base_rows = [_event_to_row(e) for e in raw_events]
    all_rows = _amplify(base_rows, amplification_factor)

    # Setup table
    setup_result = setup_atomic_table()
    if not setup_result["success"]:
        return setup_result

    # Insert
    conn = get_connection()
    try:
        # Clear any previous demo run
        cur = conn.cursor()
        schema = os.environ.get("SNOWFLAKE_SCHEMA", "atomic")
        cur.execute(f"DELETE FROM {schema}.events WHERE v_collector = 'snowplow-micro'")
        _insert_rows(conn, all_rows)
    except Exception as e:
        return {"success": False, "error": f"Insert failed: {e}"}
    finally:
        conn.close()

    unique_users = len({r["domain_userid"] for r in all_rows})
    unique_sessions = len({r["domain_sessionid"] for r in all_rows})

    return {
        "success": True,
        "source_events": len(raw_events),
        "amplification_factor": amplification_factor,
        "total_rows_inserted": len(all_rows),
        "unique_users": unique_users,
        "unique_sessions": unique_sessions,
    }
