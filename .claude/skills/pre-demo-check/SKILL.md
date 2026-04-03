---
name: pre-demo-check
description: Verify all connections and tools are working before running a live demo. Tests Snowflake auth, Docker, Snowplow Micro, snowplow-cli, Node/npm, dbt, Gmail MCP, and Slack MCP. Use before any demo run to catch issues early.
---

# Pre-Demo Connection Check

Run all checks in sequence, print PASS/FAIL for each, and summarize at the end.
If anything fails, diagnose and surface the fix — don't just report the error.

---

## Check 1 — Config files present

```bash
cd demo-gen
echo "=== Config files ===" && \
[[ -f .env ]] && echo "PASS .env exists" || echo "FAIL .env missing — copy from .env.example" && \
[[ -f config.env ]] && echo "PASS config.env exists" || echo "FAIL config.env missing — copy from config.env.example"
```

Also verify required vars are set (non-empty):

```bash
cd demo-gen
source .env 2>/dev/null; source config.env 2>/dev/null
for var in SNOWFLAKE_ACCOUNT SNOWFLAKE_USER SNOWFLAKE_DATABASE SNOWFLAKE_SCHEMA SNOWFLAKE_WAREHOUSE SNOWFLAKE_ROLE SNOWPLOW_IGLU_REGISTRY_URL SCHEMA_VENDOR SCHEMA_PREFIX; do
  [[ -n "${!var}" ]] && echo "PASS $var set" || echo "FAIL $var not set"
done
# Check at least one auth method
if [[ -n "$SNOWFLAKE_TOKEN" ]]; then
  echo "PASS SNOWFLAKE_TOKEN set (PAT auth)"
elif [[ -n "$SNOWFLAKE_PASSWORD" ]]; then
  echo "PASS SNOWFLAKE_PASSWORD set (password auth)"
else
  echo "FAIL No Snowflake auth — set SNOWFLAKE_TOKEN (preferred) or SNOWFLAKE_PASSWORD in .env"
fi
```

---

## Check 2 — Snowflake connection

```bash
cd demo-gen && source .venv/bin/activate && python -c "
from dotenv import load_dotenv; load_dotenv(); load_dotenv('config.env')
from tools.snowflake import execute_query
result = execute_query('SELECT CURRENT_USER() as u, CURRENT_ROLE() as r, CURRENT_WAREHOUSE() as w')
row = result['rows'][0] if result.get('rows') else {}
print(f'PASS Snowflake connected — user={row.get(\"u\")}, role={row.get(\"r\")}, warehouse={row.get(\"w\")}')
" 2>&1 || echo "FAIL Snowflake connection failed — check .env credentials and SNOWFLAKE_TOKEN"
```

---

## Check 3 — Docker

```bash
docker info > /dev/null 2>&1 && echo "PASS Docker running" || echo "FAIL Docker not running — open Docker Desktop"
```

---

## Check 4 — Snowplow Micro image available

```bash
docker image inspect snowplow/snowplow-micro:latest > /dev/null 2>&1 \
  && echo "PASS Snowplow Micro image present" \
  || (docker pull snowplow/snowplow-micro:latest > /dev/null 2>&1 \
      && echo "PASS Snowplow Micro image pulled" \
      || echo "FAIL Could not pull Snowplow Micro image — check internet/Docker Hub access")
```

---

## Check 5 — snowplow-cli

```bash
snowplow-cli --version > /dev/null 2>&1 \
  && echo "PASS snowplow-cli available ($(snowplow-cli --version 2>&1 | head -1))" \
  || echo "FAIL snowplow-cli not found — install it (brew install snowplow/taps/snowplow-cli or equivalent)"
```

Also verify Iglu registry credentials are set:

```bash
cd demo-gen
source .env 2>/dev/null; source config.env 2>/dev/null
[[ -n "$SNOWPLOW_IGLU_REGISTRY_URL" && -n "$SNOWPLOW_IGLU_API_KEY" ]] \
  && echo "PASS Iglu registry credentials present" \
  || echo "FAIL Iglu registry credentials missing — check SNOWPLOW_IGLU_REGISTRY_URL and SNOWPLOW_IGLU_API_KEY in .env"
```

---

## Check 6 — Node.js and npm

```bash
node --version > /dev/null 2>&1 && echo "PASS Node.js $(node --version)" || echo "FAIL Node.js not found"
npm --version > /dev/null 2>&1 && echo "PASS npm $(npm --version)" || echo "FAIL npm not found"
```

---

## Check 7 — dbt

```bash
cd demo-gen && source .venv/bin/activate
dbt --version 2>&1 | head -3 && echo "PASS dbt available" || echo "FAIL dbt not found — check venv"
```

---

## Check 8 — Gmail MCP

Do a minimal Gmail search to verify the MCP connection is active:

Search Gmail for: `snowplow` with maxResults 1.

If the search returns results or an empty list without an auth error: print `PASS Gmail MCP connected`.
If it returns an auth/permission error: print `FAIL Gmail MCP — re-authenticate or check MCP config`.

---

## Check 9 — Slack MCP

Do a minimal Slack search to verify the MCP connection is active:

Search Slack public channels for: `snowplow` with limit 1.

If the search returns results or an empty list without an auth error: print `PASS Slack MCP connected`.
If it returns an auth/permission error: print `FAIL Slack MCP — re-authenticate or check MCP config`.

---

## Check 10 — Output directory clean

```bash
cd demo-gen
echo "=== Output directory ===" && ls output/
```

If `context.json`, `demo-web/`, or `dbt-project/` exist, warn:

> WARNING: output directory has files from a previous run. Run `/clean-demo` first if this is a fresh demo.

If the output directory only contains `.gitkeep`, print `PASS output directory clean`.

---

## Summary

After all checks, print:

```
=== Pre-Demo Check Summary ===
PASS: <N>
FAIL: <N>
WARN: <N>

<list any FAILs with their fix instructions>
```

If all checks pass: `Ready to run /demo-workflow.`
If any FAILs: `Fix the above before running the demo.`
