# SA Demo Environment Generator

A demonstration of delegating a repeatable sales-engineering workflow to AI. Invoke `/demo-workflow` in Claude Code, give it a company name, and it researches the prospect automatically — searching Gmail, Slack, and Gong call transcripts — before kicking off three Claude Code sub-agents that build the environment end-to-end.

---

## How it works

```
/demo-workflow  (Claude Code skill)
       │
       │  asks for company name
       │  searches Gmail + Slack + Gong transcripts in parallel
       │  confirms findings with user
       │  writes output/context.json  (includes page structure)
       │
       ▼
site-agent  (.claude/agents/site-agent.md)
       │  starts Snowplow Micro in background
       │  scaffolds Next.js site at output/demo-web/
       │  baseline tracking only (page views, link clicks, consent, UTM, video, Signals)
       │  leaves TODO comments for custom event injection
       │  writes output/site-manifest.json  (pages + interactions handoff)
       │
       ▼
events-agent  (.claude/agents/events-agent.md)
       │  reads site source + site-manifest.json
       │  designs 3–5 custom event schemas grounded in real site interactions
       │  validates + publishes schemas to BDP Console
       │  injects tracking calls into site source files
       │  runs autonomous Micro verification loop until /micro/bad is empty
       │  writes output/schemas-ready.json
       │
← YOU: open http://localhost:3000, interact with the site, say "done" →
       │
       ▼
data-agent  (.claude/agents/data-agent.md)
       │  fetches events from Micro /good
       │  amplifies across 9 simulated sessions (9 days of data)
       │  loads into Snowflake: <DATABASE>.<SCHEMA>.events
       │  writes + runs dbt project (snowplow_unified package)
       │  surfaces: views, sessions, users tables
```

---

## Prerequisites

### 1. Claude Code + MCP connections

The skill runs inside Claude Code. The research step requires:
- **Gmail MCP** — for searching prospect email threads
- **Slack MCP** — for searching internal account discussions

Gong transcript lookup uses your Snowflake credentials directly (queries `GONG_SHARE_DB`). If your role doesn't have access, this step is skipped silently.

### 2. Python venv (for Snowflake tooling only)

```bash
cd demo-gen
python3 -m venv .venv
source .venv/bin/activate
pip install python-dotenv snowflake-connector-python dbt-snowflake
```

The venv is only needed for Snowflake loading and dbt. The site build and schema work run natively via Claude Code.

### 3. Node.js 18+ and npm

```bash
node --version   # 18+
npm --version
```

### 4. snowplow-cli

```bash
brew install snowplow/taps/snowplow-cli
snowplow-cli data-structures list   # confirm it works
```

Credentials are read from `.env` automatically.

### 5. Docker

```bash
docker pull snowplow/snowplow-micro:4.1.1
docker ps   # must return without error
```

---

## Credentials

Edit `demo-gen/.env` before running:

**Snowplow:**

| Variable | Where to find it |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `SNOWPLOW_CONSOLE_ORG_ID` | BDP Console → Settings → Organisation |
| `SNOWPLOW_CONSOLE_API_KEY_ID` | BDP Console → Settings → API Keys |
| `SNOWPLOW_CONSOLE_API_KEY` | BDP Console → Settings → API Keys |
| `SNOWPLOW_IGLU_API_KEY` | BDP Console → Settings → API Keys → Iglu |
| `SNOWPLOW_IGLU_REGISTRY_URL` | BDP Console → Settings → Iglu Registry URL |

**Snowflake:**

| Variable | Notes |
|---|---|
| `SNOWFLAKE_ACCOUNT` | e.g. `xy12345.us-east-1` |
| `SNOWFLAKE_USER` | Snowflake username |
| `SNOWFLAKE_PASSWORD` | Snowflake password |
| `SNOWFLAKE_DATABASE` | Database where events will be loaded |
| `SNOWFLAKE_WAREHOUSE` | Compute warehouse |
| `SNOWFLAKE_SCHEMA` | Schema for raw events (derived tables land in `<SCHEMA>_derived`) |
| `SNOWFLAKE_ROLE` | Role with CREATE SCHEMA + CREATE TABLE + INSERT on the target database |

---

## Running

### Primary flow

```
/demo-workflow
```

Claude asks for the company name, researches the prospect, confirms with you, then runs all three sub-agents automatically. You only need to interact with the demo site when prompted, then say "done".

### Manual handoff

To provide context not in email/Slack (e.g., notes from an in-person meeting), paste it into `reference/sales-handoff.md` before invoking the skill. Claude checks this file first and merges it with automated research.

### Clearing output

To reset all generated output and stop running services:

```bash
# Stop Micro
docker ps --filter publish=9090 -q | xargs docker stop 2>/dev/null

# Kill Next.js dev server
lsof -ti:3000 | xargs kill -9 2>/dev/null

# Remove generated files
rm -rf demo-gen/output/context.json \
       demo-gen/output/schemas-ready.json \
       demo-gen/output/site-manifest.json \
       demo-gen/output/schemas/ \
       demo-gen/output/demo-web/ \
       demo-gen/output/dbt-project/
```

This does not affect data structures in BDP Console or data in Snowflake.

---

## Output

| File / Location | Description |
|---|---|
| `output/context.json` | Prospect context — vertical, use cases, page structure |
| `output/site-manifest.json` | Site interactions map (site-agent → events-agent handoff) |
| `output/schemas/<name>.yml` | Published custom event schemas |
| `output/schemas-ready.json` | Schema manifest with full property details |
| `output/demo-web/` | Generated Next.js demo site |
| `output/dbt-project/` | Configured dbt project |
| `<DATABASE>.<SCHEMA>.events` | Raw events in Snowflake |
| `<DATABASE>.<SCHEMA>_derived.*` | Modeled output tables |

**Demo site:** `http://localhost:3000`
**Micro event stream:** `http://localhost:9090/micro/good`

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `snowplow-cli: command not found` | `brew install snowplow/taps/snowplow-cli` |
| Gmail/Slack search returns nothing | Confirm MCP connections are active in your Claude Code session |
| Gong transcripts not found | Confirm your Snowflake role has access to `GONG_SHARE_DB`; skipped silently if not |
| Docker not running | Start Docker Desktop, then retry |
| Port 9090 already in use | site-agent stops the existing container automatically |
| Port 3000 already in use | site-agent kills the process automatically |
| Schema validation fails | events-agent self-corrects up to 2 times per schema |
| Micro not validating custom schemas | Check `SNOWPLOW_IGLU_API_KEY` and `SNOWPLOW_IGLU_REGISTRY_URL` in `.env` |
| `npm install` fails | Check Node.js version (18+ required) |
| Demo site blank/broken | Check `/tmp/demo-dev.log` for Next.js errors |
| "No events found in Micro" | Open `http://localhost:3000`, interact with the site, then say "done" |
| dbt run fails — schema not found | Check `SNOWFLAKE_DATABASE` in `.env` and that the role has CREATE SCHEMA permissions |
| dbt run fails — auth error | Check all Snowflake credentials in `.env` |

---

## Project structure

```
demo-gen/
├── tools/
│   └── snowflake.py         # Snowflake connection, event parsing, amplification, dbt queries
├── reference/
│   ├── schema-example.yml   # Canonical schema format (read by events-agent)
│   └── sales-handoff.md     # Paste deal notes here before running the skill
├── output/                  # Generated files (created at runtime, gitignored)
└── .env                     # API keys and credentials

.claude/
├── agents/
│   ├── site-agent.md        # Builds Next.js site + starts Micro
│   ├── events-agent.md      # Schema generation, injection, Micro verification
│   └── data-agent.md        # Snowflake loading + dbt modeling
└── skills/
    └── demo-workflow/
        └── SKILL.md         # /demo-workflow skill — orchestrates the full pipeline

.claude/agents/site-templates/     # Pre-built TypeScript files copied by site-agent
    ├── package.json              # with {{APP_ID}} / {{BRAND_NAME}} placeholders
    ├── src/lib/snowplow-config.ts
    ├── src/components/           # footer, header, login-modal, consent-manager, etc.
    └── app/video/page.tsx

.claude/skills/site-generator/
    ├── SKILL.md             # Standalone site-generator skill (non-demo use)
    └── references/          # Baseline feature reference docs
```
