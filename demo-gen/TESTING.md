# Testing Guide

Step-by-step testing for each phase of the demo-workflow. Each phase can be tested
independently — you don't need to run the full flow to test a single agent.

---

## Before you start

Run these checks once before testing anything:

```bash
# 1. Python venv (Snowflake tooling only — not needed for site/schema work)
cd demo-gen
python3 -m venv .venv
source .venv/bin/activate
python3 --version               # must be 3.11+
pip install python-dotenv snowflake-connector-python dbt-snowflake

# 2. Node.js and npm
node --version                  # must be 18+
npm --version

# 3. snowplow-cli
snowplow-cli --version
snowplow-cli data-structures list   # should list your org's schemas

# 4. Docker
docker ps                       # must return without error (Docker Desktop running)
docker pull snowplow/snowplow-micro:4.1.1

# 5. .env populated
cat demo-gen/.env               # no placeholder values should remain
```

All checks must pass before proceeding.

---

## Phase 1 — Skill research and intake (context.json)

**What it does:** The `/demo-workflow` skill asks for a company name, searches Gmail, Slack,
and Gong call transcripts in parallel, presents a summary, and writes `output/context.json`
after you confirm. If nothing is found across all sources, it falls back to a short interview.

All of this runs in Claude Code — not as a Python script.

### Pre-flight: confirm MCP connections

In a Claude Code conversation, verify Gmail and Slack tools are available. If either is
missing, the research step will skip that source silently.

Verify Gong Snowflake access:

```bash
cd demo-gen
source .venv/bin/activate
python -c "
from dotenv import load_dotenv; load_dotenv()
from tools.snowflake import execute_query
r = execute_query(\"SELECT COUNT(*) FROM GONG_SHARE_DB.GONG_DATA_CLOUD.CALL_TRANSCRIPTS\")
print(r)
"
```

If this returns a row count, Gong transcript lookup will work. If it fails with a permissions
error, the skill skips it gracefully.

### Test 1A — Research flow (primary path)

Invoke the skill in Claude Code:

```
/demo-workflow
```

Claude asks for the company name. Use a real prospect with email/Slack history.

**Expected behaviour:**
- Claude asks: "What company is this demo for?"
- After you answer, Claude searches Gmail, Slack, and Gong in parallel (you'll see tool calls)
- Claude presents a summary of findings and from which sources
- Claude proposes a draft context (vertical, stack, use cases, data maturity, pages)
- Claude asks you to confirm or correct
- On confirmation, Claude writes `output/context.json`

**Verify:**
```bash
cat demo-gen/output/context.json
```
Expected shape (values vary by prospect):
```json
{
  "vertical": "retail",
  "stack": ["web"],
  "use_cases": ["product analytics", "cart abandonment"],
  "company_name": "Acme Sports",
  "data_maturity": "medium",
  "source": "research",
  "pages": [
    { "path": "/", "name": "Home", "description": "..." },
    { "path": "/products/[id]", "name": "Product Detail", "description": "..." },
    { "path": "/checkout", "name": "Checkout", "description": "..." },
    { "path": "/video", "name": "Video", "description": "..." }
  ]
}
```

The `pages` field is required — it drives site-agent's page structure.

### Test 1B — Fallback interview (no sources found)

Use a company name with no email, Slack, or Gong history (e.g. a fictional company).

**Expected behaviour:**
- Claude searches all sources, finds nothing useful
- Claude asks 3–4 focused questions about vertical, use cases, stack, data maturity
- `output/context.json` is written with `"source": "interview"`

### Test 1C — Manual handoff override

Paste notes into `demo-gen/reference/sales-handoff.md`:

```markdown
# Acme Sports — Discovery Call Notes

Company: Acme Sports (acmesports.com)
Industry: Retail / sporting goods e-commerce
Primary use case: Reduce cart abandonment, understand product discovery funnel
Stack: React web app, no mobile yet
Current analytics: Google Analytics 4, no warehouse
```

Run `/demo-workflow` with the same company name. Claude should merge handoff content with
Gmail/Slack/Gong findings.

**Verify:** `output/context.json` should have `"source": "mixed"`.

### Bypassing Phase 1 (for downstream testing)

Write `output/context.json` directly:

```bash
mkdir -p demo-gen/output
cat > demo-gen/output/context.json << 'EOF'
{
  "vertical": "retail",
  "stack": ["web"],
  "use_cases": ["product analytics", "cart abandonment"],
  "company_name": "Acme Sports",
  "data_maturity": "medium",
  "source": "research",
  "pages": [
    { "path": "/", "name": "Home", "description": "Product discovery feed with add-to-cart" },
    { "path": "/products/[id]", "name": "Product Detail", "description": "Full product page with purchase flow" },
    { "path": "/checkout", "name": "Checkout", "description": "Cart review and payment" },
    { "path": "/video", "name": "Video", "description": "Snowplow explainer video" }
  ]
}
EOF
```

---

## Phase 2 — site-agent

**What it does:** Reads `output/context.json`, starts Snowplow Micro, copies pre-built
template files, generates custom config/styles/header, builds vertical-specific pages with
TODO comments for custom event injection, writes `output/site-manifest.json`.

**Agent definition:** `.claude/agents/site-agent.md`
**Requires:** `output/context.json` from Phase 1 (or written manually above).

### Test 2A — Run site-agent directly

In a Claude Code conversation, invoke the agent with the Agent tool or ask Claude to run it:

```
Use the site-agent to build the demo site for the context in demo-gen/output/context.json
```

Or it runs automatically as part of `/demo-workflow`.

**Expected progress output:**
```
[site-agent] Micro starting in background
[site-agent] Templates copied, npm install running in background
[site-agent] → / built — product discovery feed, add-to-cart interactions
[site-agent] → /products/[id] built — product detail, size selector, purchase CTA
[site-agent] → /checkout built — cart review, order submission
[site-agent] Done.
```

### Verify: template files were copied

```bash
ls demo-gen/output/demo-web/src/lib/
# should include: snowplow-config.ts, utils.ts, consent.ts, config.ts

ls demo-gen/output/demo-web/src/components/
# should include: header.tsx, footer.tsx, snowplow-init.tsx, consent-manager.tsx, login-modal.tsx

ls demo-gen/output/demo-web/app/video/
# should include: page.tsx
```

### Verify: APP_ID placeholder was replaced

```bash
grep '{{APP_ID}}' demo-gen/output/demo-web/src/lib/snowplow-config.ts
# should return nothing — placeholder must be replaced

grep 'appId' demo-gen/output/demo-web/src/lib/snowplow-config.ts
# should show: appId: "acme-sports-demo"  (or whatever the company → APP_ID mapping produces)
```

### Verify: Micro is running

```bash
docker ps | grep snowplow-micro
curl -s localhost:9090/micro/good
# should return []
```

### Verify: site is live

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
# should return 200

cat /tmp/demo-dev.log | tail -5
# should show "compiled successfully" or "ready"
```

### Verify: app_id is correct in Micro

Open `http://localhost:3000` and navigate to any page, then:

```bash
sleep 3 && curl -s localhost:9090/micro/good | python3 -c "
import json, sys
events = json.load(sys.stdin)
if events:
    app_id = events[0].get('event', {}).get('app_id')
    print(f'app_id in Micro: {app_id}')
else:
    print('No events yet — open the site first')
"
```

The `app_id` must match the derived APP_ID (e.g. `acme-sports-demo`). If it shows `null` or
a placeholder string, the `{{APP_ID}}` substitution in `snowplow-config.ts` failed.

### Verify: site-manifest.json written

```bash
cat demo-gen/output/site-manifest.json
```

Should contain pages, interactions, suggested event names, and source file paths for every
interactive element with a TODO comment.

### Manual browser checks at http://localhost:3000

1. Page loads without errors (check browser console)
2. Network tab shows a request to `localhost:9090` on page load (page_view event)
3. Layout and copy are vertical-appropriate (not generic placeholder text)
4. All 6 baseline features present:
   - Consent banner on first load
   - UTM Reload button in footer
   - Signals toggle in footer
   - Watch Video link in footer
   - Login button in header
   - Link to `snowplow.io` in footer (cross-domain tracking)

### Common failures

| Symptom | Check |
|---|---|
| `{{APP_ID}}` still in config | `grep '{{' demo-gen/output/demo-web/src/lib/snowplow-config.ts` — sed substitution failed |
| `app_id: null` in Micro | APP_ID placeholder not replaced — check the sed command in site-agent Step 3 |
| `npm install` fails | Check Node.js version (`node --version` must be 18+) |
| Next.js dev server fails | Run `cat /tmp/demo-dev.log` — look for TypeScript or import errors |
| No events in Micro | Check browser Network tab for requests to `localhost:9090` |
| Docker: port 9090 in use | `docker ps --filter publish=9090 -q | xargs docker stop` |

---

## Phase 3 — events-agent

**What it does:** Reads site source and `site-manifest.json`, designs 3–5 custom event
schemas grounded in real site interactions, validates and publishes them to BDP Console,
injects tracking calls into the site source, runs a Micro verification loop until all events
pass, writes `output/schemas-ready.json`.

**Agent definition:** `.claude/agents/events-agent.md`
**Requires:** `output/context.json`, `output/site-manifest.json`, running Next.js site.

### Test 3A — Run events-agent directly

In a Claude Code conversation:

```
Use the events-agent to add custom tracking to the demo site
```

Or it runs automatically as part of `/demo-workflow` after site-agent completes.

**Expected progress output:**
```
[events-agent] → wrote schema: pb_test_product_viewed.yml
[events-agent] → wrote schema: pb_test_add_to_cart.yml
[events-agent] → wrote schema: pb_test_checkout_started.yml
[events-agent] → published all schemas to BDP Console
[events-agent] → added tracking functions to snowplow-config.ts
[events-agent] → injected tracking into demo-gen/output/demo-web/app/page.tsx
[events-agent] → injected tracking into demo-gen/output/demo-web/app/products/[id]/page.tsx
[events-agent] → injected tracking into demo-gen/output/demo-web/app/checkout/page.tsx
```

### Verify: schema YAMLs on disk

```bash
ls demo-gen/output/schemas/
# should show 3–5 pb_test_*.yml files

cat demo-gen/output/schemas/pb_test_<first_schema>.yml
# should match reference/schema-example.yml structure:
# schema: iglu:com.pbenvworkflow/pb_test_...
# self: { vendor: com.pbenvworkflow, name: pb_test_..., format: jsonschema, version: 1-0-0 }
# data: { type: object, additionalProperties: false, properties: {...} }
```

### Verify: schema names use pb_test_ prefix and correct vendor

```bash
grep 'vendor' demo-gen/output/schemas/*.yml
# must all show: vendor: com.pbenvworkflow

grep 'name:' demo-gen/output/schemas/*.yml
# must all show: name: pb_test_...
```

### Verify: schemas published to BDP Console

```bash
cd demo-gen && source .venv/bin/activate
snowplow-cli data-structures list | grep pb_test
# should list your newly published schemas
```

Also check in BDP Console UI → Data Structures → filter vendor `com.pbenvworkflow`.

### Verify: tracking functions added to snowplow-config.ts

```bash
grep 'export function track' demo-gen/output/demo-web/src/lib/snowplow-config.ts
# should show one function per schema, e.g.:
# export function trackProductViewed(data: {...})
# export function trackAddToCart(data: {...})
```

### Verify: TODO comments replaced with tracking calls

```bash
grep -r 'TODO: events-agent' demo-gen/output/demo-web/
# should return nothing — all TODOs replaced
```

### Verify: enum values in site match schema

```bash
# Pick a schema with an enum field and check it against the injected call
grep -r 'trackProduct\|trackAdd\|trackCheckout' demo-gen/output/demo-web/app/
# Values passed must be in the enum arrays defined in the YAML
```

### Verify: Micro validation passed (/micro/bad is empty)

```bash
curl -s localhost:9090/micro/bad
# must return []
```

If it returns events, the events-agent verification loop should have caught and fixed these.
Check the agent output for error messages and retry steps.

### Verify: schemas-ready.json written

```bash
cat demo-gen/output/schemas-ready.json
```

Expected shape:
```json
{
  "status": "published",
  "vendor": "com.pbenvworkflow",
  "schemas": [
    {
      "name": "pb_test_product_viewed",
      "version": "1-0-0",
      "iglu_uri": "iglu:com.pbenvworkflow/pb_test_product_viewed/jsonschema/1-0-0",
      "properties": {
        "product_id": { "type": "string", "required": true },
        "category": { "type": "string", "required": true, "enum": ["apparel", "footwear", "equipment"] }
      }
    }
  ],
  "micro_compatible": true
}
```

The `properties` object must be complete and accurate — data-agent reads this file.

### Common failures

| Symptom | Check |
|---|---|
| `publish failed: schema already exists` | Delete schemas from BDP Console dev, or rename them in the YAML |
| Schema validation fails | events-agent self-corrects up to 2 times per schema; if it still fails, read the error and fix the YAML manually |
| `snowplow-cli: command not found` | `brew install snowplow/taps/snowplow-cli` |
| Enum mismatch in Micro | events-agent's static analysis (Step 10) should catch this before curl tests; if it doesn't, check the TODO replacement |
| `/micro/bad` not empty after events-agent | Read the bad event payload — check `dataReports` for the field and constraint that failed |
| Tracking import missing | events-agent injects the import; if the build fails with "not found", check the import line at top of the source file |

---

## Phase 4 — data-agent

**What it does:** Fetches events from Micro, amplifies across 9 simulated sessions, loads
into Snowflake, writes a dbt project, runs `dbt run --select snowplow_unified`, surfaces
results.

**Agent definition:** `.claude/agents/data-agent.md`
**Requires:** Micro running with events in it. Complete Phases 2–3 and interact with the site.

### Test 4A — Snowflake connectivity check

```bash
cd demo-gen
source .venv/bin/activate
python -c "
from dotenv import load_dotenv; load_dotenv()
from tools.snowflake import execute_query
result = execute_query('SELECT CURRENT_USER(), CURRENT_DATABASE(), CURRENT_WAREHOUSE()')
print(result)
"
```

Expected: `{'columns': [...], 'rows': [{'CURRENT_USER()': '...', ...}], 'success': True}`

### Test 4B — Micro event check

```bash
curl -s localhost:9090/micro/good | python3 -c "
import json, sys
events = json.load(sys.stdin)
print(f'{len(events)} events in Micro')
"
```

Must be > 0. If 0: open `http://localhost:3000`, interact with the site, then re-check.

### Test 4C — Run data-agent

In Claude Code, data-agent runs automatically after you say "done" following site interaction.
To invoke it directly:

```
Use the data-agent to load events into Snowflake and run dbt modeling
```

**Expected progress output:**
```
[data-agent] Found <N> events in Micro
[data-agent] → amplifying 9x across simulated sessions
[data-agent] → load to Snowflake: <N*9> rows
[data-agent] → dbt deps
[data-agent] → dbt run --select snowplow_unified
[data-agent] Done.
```

### Verify data in Snowflake

```bash
cd demo-gen
source .venv/bin/activate
python -c "
from dotenv import load_dotenv; load_dotenv()
import os
from tools.snowflake import execute_query
db = os.environ['SNOWFLAKE_DATABASE']
for label, q in [
    ('atomic.events',      f'SELECT COUNT(*) as n FROM {db}.atomic.events'),
    ('views',              f'SELECT COUNT(*) as n FROM {db}.snowplow_demo_derived.snowplow_unified_views'),
    ('sessions',           f'SELECT COUNT(*) as n FROM {db}.snowplow_demo_derived.snowplow_unified_sessions'),
    ('users',              f'SELECT COUNT(*) as n FROM {db}.snowplow_demo_derived.snowplow_unified_users'),
]:
    print(label, execute_query(q)['rows'])
"
```

Expected (with 5 source events, amplification factor 9):
- `atomic.events`: ~45 rows
- `snowplow_unified_views`: rows present if page_view events fired
- `snowplow_unified_sessions`: 9 rows
- `snowplow_unified_users`: 9 rows

### Common failures

| Symptom | Check |
|---|---|
| Snowflake auth error | Verify `SNOWFLAKE_ACCOUNT` format: `xy12345.us-east-1` (no `.snowflakecomputing.com`) |
| `CREATE SCHEMA failed: insufficient privileges` | Role needs CREATE SCHEMA on the target database |
| `dbt deps` fails | Check internet connectivity; `dbt-snowflake` must be installed in the venv |
| `dbt run` fails — relation not found | Check `snowplow__database` and `snowplow__schema` in `output/dbt-project/dbt_project.yml` |
| `dbt run` fails — no data | Check `atomic.events` row count; confirm `snowplow__start_date` is before event timestamps |
| `snowplow_unified_views` empty | Ensure page_view events fired — open the site and load at least one page |

---

## Full end-to-end test

### Run the complete flow

```
/demo-workflow
```

Claude asks for the company name, researches, confirms with you, then runs site-agent →
events-agent automatically. When prompted, interact with the site at `http://localhost:3000`,
then tell Claude you're done. data-agent runs automatically.

### Success criteria

- [ ] Claude searched at least one of Gmail / Slack / Gong before asking questions
- [ ] Research summary shown before writing context
- [ ] `output/context.json` written with correct values including `pages` array
- [ ] Snowplow Micro running at `localhost:9090`
- [ ] Template files copied to `output/demo-web/`
- [ ] `{{APP_ID}}` and `{{BRAND_NAME}}` placeholders replaced throughout
- [ ] `http://localhost:3000` loads and fires events to Micro
- [ ] `app_id` in Micro matches the company-derived APP_ID (not null)
- [ ] All 6 baseline features present (consent, UTM reload, Signals, video, login, cross-domain)
- [ ] `output/site-manifest.json` written with pages and interactions
- [ ] 3–5 schema YAML files in `output/schemas/`, all with `pb_test_` prefix
- [ ] Schemas visible in BDP Console dev environment under vendor `com.pbenvworkflow`
- [ ] `output/schemas-ready.json` written with full property details
- [ ] No TODO comments remaining in site source (`grep -r 'TODO: events-agent' output/demo-web/`)
- [ ] `curl localhost:9090/micro/bad` returns `[]`
- [ ] `curl localhost:9090/micro/good` returns at least 5 events with correct app_id
- [ ] `atomic.events` has rows in Snowflake
- [ ] `snowplow_demo_derived.snowplow_unified_sessions` has 9 rows
- [ ] data-agent prints final Snowflake query results

---

## Resetting between test runs

```bash
# Stop Micro
docker ps --filter publish=9090 -q | xargs docker stop 2>/dev/null || true

# Kill Next.js dev server
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Remove all generated output files
rm -f demo-gen/output/context.json \
      demo-gen/output/schemas-ready.json \
      demo-gen/output/site-manifest.json
rm -rf demo-gen/output/schemas/ \
       demo-gen/output/demo-web/ \
       demo-gen/output/dbt-project/
```

This does not affect data structures in BDP Console or data in Snowflake.

### Also clear Snowflake data

```bash
cd demo-gen
source .venv/bin/activate
python -c "
from dotenv import load_dotenv; load_dotenv()
import os
from tools.snowflake import execute_query
db = os.environ['SNOWFLAKE_DATABASE']
execute_query(f'DROP SCHEMA IF EXISTS {db}.atomic CASCADE')
execute_query(f'DROP SCHEMA IF EXISTS {db}.snowplow_demo_derived CASCADE')
print('Snowflake schemas cleared')
"
```

### Clean up BDP Console schemas

Log in to BDP Console → Data Structures → filter vendor `com.pbenvworkflow` → delete any
`pb_test_*` schemas from the dev environment before re-running.
