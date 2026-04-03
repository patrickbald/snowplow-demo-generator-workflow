# SA Demo Environment Generator

A sales engineering workflow — building a custom Snowplow demo environment for a prospect — delegated almost entirely to AI. Invoke `/demo-workflow` in Claude Code, confirm a research summary, interact with the generated site for a few minutes, then say "done." Everything else runs automatically.

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
       │  baseline tracking: page views, link clicks, consent, UTM, video, Signals
       │  leaves TODO comments for custom event injection
       │  writes output/site-manifest.json  (pages + interactions handoff)
       │
       ▼
events-agent  (.claude/agents/events-agent.md)
       │  reads site source + site-manifest.json
       │  designs 3–5 custom event schemas grounded in real site interactions
       │  validates + publishes schemas to BDP Console (vendor/prefix from config.env)
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
       │  runs dbt seed + dbt run (snowplow_unified package)
       │  surfaces: views, sessions, users tables
```

---

## New team member setup

Run the interactive onboarding wizard — it checks what's already installed, walks through each missing piece, and verifies everything works before you're done:

```
/onboarding
```

This covers: prerequisites, Python venv, `.env` and `config.env` configuration, Snowflake connection, snowplow-cli authentication, MCP connections (Gmail + Slack), and Docker image pull.

**If you prefer to set up manually**, see the sections below.

---

## Prerequisites

| Tool | Minimum version | Install |
|---|---|---|
| Claude Code | latest | `npm install -g @anthropic-ai/claude-code` |
| Node.js + npm | Node 18+ | `brew install node` |
| Docker Desktop | any | docker.com |
| snowplow-cli | any | `brew install snowplow/taps/snowplow-cli` |
| Python | 3.10+ | `brew install python3` |

**MCP connections** (configured in Claude Code, not this repo):
- Gmail MCP — for prospect research
- Slack MCP — for internal account discussions

---

## Configuration

The project uses two credential files, both gitignored:

### `demo-gen/.env` — personal credentials

Copy from `.env.example` and fill in:

| Variable | Where to find it |
|---|---|
| `SNOWFLAKE_ACCOUNT` | Snowflake UI → account menu → Copy account identifier |
| `SNOWFLAKE_USER` | Your Snowflake username |
| `SNOWFLAKE_TOKEN` | Snowflake UI → My Profile → Programmatic Access Tokens (preferred over password) |
| `SNOWFLAKE_PASSWORD` | Your Snowflake password (fallback if no token) |
| `SNOWPLOW_IGLU_API_KEY` | BDP Console → Settings → API Keys → Iglu write key |
| `REPO_ROOT` | Absolute path to this repo on your machine |

### `demo-gen/config.env` — shared project settings

Copy from `config.env.example` and fill in:

| Variable | Notes |
|---|---|
| `SNOWFLAKE_DATABASE` | e.g. `ANALYTICS_DEV_DB` |
| `SNOWFLAKE_WAREHOUSE` | e.g. `ANALYTICS_DEV_WH` |
| `SNOWFLAKE_SCHEMA` | Use your name to avoid conflicts, e.g. `jsmith_dbt_demo` |
| `SNOWFLAKE_ROLE` | e.g. `ANALYTICS_DEV_ROLE` |
| `SNOWPLOW_IGLU_REGISTRY_URL` | BDP Console → Settings → Iglu Registry URL |
| `SCHEMA_VENDOR` | Vendor for published schemas, e.g. `com.snowplow.jsmith` |
| `SCHEMA_PREFIX` | Prefix for schema names, e.g. `jsmith_test_` |

### Python venv

```bash
cd demo-gen
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### snowplow-cli authentication

```bash
snowplow-cli configure   # paste in your BDP Console API key and org ID when prompted
snowplow-cli data-structures list   # confirm it works
```

---

## Running a demo

### Before each demo

```
/pre-demo-check
```

Verifies Snowflake, Docker, Micro, snowplow-cli, Node, dbt, Gmail MCP, and Slack MCP are all working. Catches issues before you're live with a prospect.

### Run the workflow

```
/demo-workflow
```

Claude asks for the company name, researches the prospect automatically, confirms findings with you, then runs all three sub-agents. You interact with the demo site when prompted, then say "done" — data modeling runs automatically.

### Manual context handoff

To provide context not in email/Slack (e.g. notes from an in-person meeting), paste it into `demo-gen/reference/sales-handoff.md` before invoking the skill. Claude checks this file first and merges it with automated research.

---

## After each demo — cleanup

```
/clean-demo
```

Stops Snowplow Micro and the Next.js dev server, removes all generated output files, and optionally drops Snowflake data. Also reminds you to delete published schemas from BDP Console dev before the next run.

---

## Output

| File / Location | Description |
|---|---|
| `output/context.json` | Prospect context — vertical, use cases, page structure |
| `output/site-manifest.json` | Site interactions map (site-agent → events-agent handoff) |
| `output/schemas/<prefix><name>.yml` | Published custom event schemas |
| `output/schemas-ready.json` | Schema manifest with full property details |
| `output/demo-web/` | Generated Next.js demo site |
| `output/dbt-project/` | Configured dbt project |
| `<DATABASE>.<SCHEMA>.events` | Raw events in Snowflake |
| `<DATABASE>.<SCHEMA>_derived.*` | Modeled output (views, sessions, users) |

**Demo site:** `http://localhost:3000`
**Micro event stream:** `http://localhost:9090/micro/good`

---

## Skills reference

| Skill | When to use |
|---|---|
| `/onboarding` | First-time setup on a new machine |
| `/pre-demo-check` | Before every demo to verify connections |
| `/demo-workflow` | Run the full pipeline for a prospect |
| `/clean-demo` | Reset environment after a demo |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `snowplow-cli: command not found` | `brew install snowplow/taps/snowplow-cli` |
| Gmail/Slack search returns nothing | Confirm MCP connections are active in your Claude Code session |
| Gong transcripts not found | Confirm your Snowflake role has access to `GONG_SHARE_DB`; skipped silently if not |
| Docker not running | Start Docker Desktop, then retry |
| Snowflake MFA prompt blocking data-agent | Use a Programmatic Access Token (`SNOWFLAKE_TOKEN`) instead of password |
| Schema validation fails | events-agent self-corrects up to 2 times per schema |
| Schema publish fails — name conflict | Delete existing `<SCHEMA_PREFIX>*` schemas from BDP Console dev before re-running |
| Micro not validating custom schemas | Check `SNOWPLOW_IGLU_API_KEY` and `SNOWPLOW_IGLU_REGISTRY_URL` in `.env` |
| `npm install` fails | Check Node.js version (18+ required) |
| Demo site blank/broken | Check `/tmp/demo-dev.log` for Next.js errors |
| "No events found in Micro" | Open `http://localhost:3000`, interact with the site, then say "done" |
| dbt run fails — schema not found | Check `SNOWFLAKE_DATABASE` and `SNOWFLAKE_SCHEMA` in config files |
| dbt schema has `_derived_derived` suffix | Set dbt target schema to `SNOWFLAKE_SCHEMA` only — the package appends its own suffixes |

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
├── .env                     # Personal credentials (gitignored — copy from .env.example)
├── .env.example             # Template for .env
├── config.env               # Shared project settings (gitignored — copy from config.env.example)
├── config.env.example       # Template for config.env
└── requirements.txt         # Python dependencies

.claude/
├── agents/
│   ├── site-agent.md        # Builds Next.js site + starts Micro
│   ├── events-agent.md      # Schema generation, injection, Micro verification
│   ├── data-agent.md        # Snowflake loading + dbt modeling
│   └── site-templates/      # Pre-built TypeScript files stamped by site-agent
└── skills/
    ├── demo-workflow/        # /demo-workflow — orchestrates the full pipeline
    ├── clean-demo/           # /clean-demo — resets environment between demos
    ├── pre-demo-check/       # /pre-demo-check — verifies all connections before going live
    └── onboarding/           # /onboarding — interactive setup wizard for new team members
```
