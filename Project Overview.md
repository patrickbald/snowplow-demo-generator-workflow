# Project Overview: SA Demo Environment Generator

## What this is

A sales engineering workflow — building a custom Snowplow demo environment for a prospect — delegated almost entirely to AI. A sales engineer invokes a single Claude Code skill, confirms a research summary, interacts with the generated demo site for a few minutes, then says "done." Everything else — prospect research, site generation, event schema design, Snowflake loading, dbt modeling — runs without manual steps.

The project runs as a Claude Code skill (`/demo-workflow`) that orchestrates three Claude Code sub-agents. The only human steps are:
1. Confirm the research summary looks right
2. Click around the demo site
3. Say "done"

---

## The problem it solves

Before this project, building a Snowplow demo environment for a prospect took 2–3 hours of SA time: researching the prospect, scaffolding a Next.js site, designing and publishing Iglu event schemas, injecting tracking code, loading seed data into Snowflake, and configuring dbt. Every step was manual, and the quality varied based on how much time the SA had.

The goal was to make this repeatable, fast, and consistent — and to shift the SA's role from builder to reviewer.

---

## Architecture decisions

### Starting point: a Python orchestration layer

The first version of this system used a Python pipeline (`demo_gen.py`) that called three Python agents: a schema agent (designed Iglu schemas from a context JSON), an environment agent (built the Next.js site from those schemas), and a data agent (loaded events and ran dbt). Claude was invoked via the Anthropic API from inside these Python scripts.

This worked but had a structural problem: **the schema agent ran before the site existed.** It was inventing schemas based on a verbal description of what the site might contain — then the environment agent had to make the site match those pre-invented schemas. This caused a recurring class of bug: enum values defined in a schema didn't match what the generated site actually sent, and Micro validation failed. Every run required debugging enum mismatches.

### The key insight: site-first schema derivation

The fix was reversing the order. Build the site first. Then read the actual source code to design the schemas. Once events-agent can see the real component props, the exact onClick handlers, and the existing data being passed around, it can write schemas that are guaranteed to match what the site actually sends — because it's reading the same code it will later inject into.

This eliminated the enum mismatch class of bugs structurally, not through better prompting.

### Replacing Python with Claude Code native agents

The Python orchestration layer existed to chain together API calls to Claude. Claude Code's Agent tool does this natively — a skill can invoke sub-agents directly, each with its own isolated context window. This removed the need for `demo_gen.py`, `orchestrator.py`, and the `agents/` Python directory entirely. The pipeline is now:

```
/demo-workflow skill  →  site-agent  →  events-agent  →  [user]  →  data-agent
```

Each agent is a Markdown file in `.claude/agents/`. The skill passes control by invoking the Agent tool. The only Python that remains is `tools/snowflake.py` — for Snowflake connection, event loading, and amplification — which Claude Code calls as a subprocess.

Benefits of this approach:
- Each agent runs in an isolated context window (npm output, dbt logs, and schema validation errors don't pollute the skill's context)
- Sub-agents can be re-run independently (if schema injection fails, re-run events-agent; if dbt fails, re-run data-agent — no need to rebuild the site)
- No API key management or retry logic to write — Claude Code handles it

### Handoff artifacts instead of shared state

The three agents don't share memory — they communicate through files:

| File | Written by | Read by |
|---|---|---|
| `output/context.json` | `/demo-workflow` skill | site-agent, events-agent, data-agent |
| `output/site-manifest.json` | site-agent | events-agent |
| `output/schemas-ready.json` | events-agent | data-agent, `/demo-workflow` skill |

`site-manifest.json` is the critical handoff. site-agent populates it with every interactive element that has a TODO comment — the page path, the UI element, the suggested event name, the available data, and the source file path. events-agent reads this and the actual source files before designing any schema. This is what makes the site-first approach work: events-agent has enough context to ground its schemas in real code, not assumptions.

### Template-based site generation

The first version of site-agent generated every file from scratch on every run: `package.json`, `tsconfig.json`, `next.config.ts`, Snowplow config, all components. This took 20–25 minutes because Claude was writing 15+ files sequentially, often with minor variations that still needed to be consistent.

The insight was that about 80% of the files are identical across every demo — the Snowplow tracker setup, the consent manager, the footer with demo controls, the login modal, the video page, the dbt configuration. Only ~20% varies by prospect: the config (brand name, tagline, nav), the global CSS (brand colors), the header, and the vertical-specific pages.

The solution was a `site-templates/` directory of pre-written TypeScript files with two placeholders (`{{APP_ID}}` and `{{BRAND_NAME}}`). site-agent copies all template files in a single bash block, stamps the placeholders with `sed`, starts `npm install` immediately in the background, then generates only the prospect-specific files while npm is installing. Generation time dropped from ~25 minutes to ~8 minutes.

---

## How the workflow works end-to-end

### Research phase

The skill searches Gmail, Slack, and Gong call transcripts in parallel for the prospect company name. It extracts: use cases mentioned, pain points, tech stack signals, deal stage. It synthesizes these into a proposed demo context and asks the SA to confirm before writing anything.

If the SA has notes from an in-person meeting or call, they paste them into `reference/sales-handoff.md` before invoking the skill — this file is checked first and merged with automated research.

### Site-agent

Reads `context.json` and starts Snowplow Micro in the background (Docker container on port 9090, configured with the org's Iglu registry credentials). Then:
- Copies 13 template files in one command
- Stamps `{{APP_ID}}` and `{{BRAND_NAME}}` via `sed`
- Starts `npm install` immediately in the background
- Generates `config.ts`, `globals.css`, `header.tsx`, and `layout.tsx` custom to the prospect
- Builds every vertical-specific page with realistic copy and appropriate layout
- Leaves precise TODO comments wherever custom event tracking should fire, including what data will be available at that point in the component

By the time pages are built, `npm install` is usually done. site-agent starts the Next.js dev server, runs a smoke test against Micro, verifies the `app_id` is present on events (not null), and writes `site-manifest.json`.

### Events-agent

Reads the site source files and `site-manifest.json`. Designs 3–5 custom event schemas, where each schema is grounded in a specific TODO comment it found in the code — not a generic guess. It writes the schemas as YAML, validates them with `snowplow-cli`, publishes them to BDP Console dev, adds TypeScript tracking functions to `snowplow-config.ts`, and injects the actual tracking calls at each TODO comment location.

Before firing any test events, it does a static analysis pass: reads each schema YAML and cross-checks every field value in the injected site code against the schema's enum constraints and type constraints. Only after that passes does it fire test events via curl to Micro's TP2 endpoint and check `/micro/bad`. If any events fail, it reads the error, determines whether the fix is in the schema or the tracking code, fixes it, and loops until `/micro/bad` is empty.

### User interaction

The skill pauses and tells the SA: "The demo site is live at localhost:3000. Interact with it to generate events." This is intentional — the SA needs to see the site anyway to verify it looks right, and their interactions become the seed data for the Snowflake modeling. When they say "done," data-agent runs automatically.

### Data-agent

Fetches all events from Micro's `/good` endpoint. Amplifies them 9x across simulated sessions — each session gets a new `domain_userid` and is staggered back one day, producing 9 days of historical data from a single 5-minute site interaction. Loads all rows into Snowflake, writes `packages.yml`, `profiles.yml`, and `dbt_project.yml` with the correct credentials and `app_id`, runs `dbt deps`, `dbt seed` (required by snowplow_unified before models can run), and `dbt run --select snowplow_unified`, then queries the derived tables and prints a summary.

The `app_id` can be passed directly as an agent argument (e.g. `app_id: bumble-demo`) or derived from `context.json`. The dbt target schema is set to `SNOWFLAKE_SCHEMA` only — the snowplow_unified package automatically appends `_derived`, `_scratch`, and `_snowplow_manifest` suffixes.

---

## Tools implemented

### `tools/snowflake.py`

The only custom Python in the pipeline. Provides:
- `execute_query()` — single query execution with Snowflake connector
- `process_and_load_micro_events()` — parses Micro's event format, amplifies across N sessions with staggered timestamps and new `domain_userid` values, batch-inserts into `<SCHEMA>.events`, creates the schema if it doesn't exist

Auto-loads both `.env` and `config.env` at import time so callers don't need to load credentials manually. Supports Snowflake Programmatic Access Token (PAT) auth — if `SNOWFLAKE_TOKEN` is set in `.env`, it connects with `authenticator="programmatic_access_token"`, bypassing MFA. Falls back to password auth if not set.

The DDL for the `events` table matches the full Snowplow atomic schema (70+ columns) — all `geo_*`, `br_*`, `os_*`, `mkt_*`, `refr_*`, `se_*`, `pp_*`, `doc_*` columns plus the VARIANT columns for web_page and client_session contexts. This is required by the snowplow_unified dbt package.

This is called by data-agent as a subprocess (`python -c "..."`) to avoid needing a Python runtime inside the agents themselves.

### Snowplow Micro (Docker)

Used as the local event validation endpoint throughout development and demo generation. site-agent starts it (configured with the org's Iglu registry URL and API key so custom schemas are resolved), events-agent fires test events to it and checks `/micro/bad`, and data-agent reads events from `/micro/good` as the seed for Snowflake loading.

### snowplow-cli

Used by events-agent for schema lifecycle: `validate` (check YAML structure before publishing), `publish dev` (push to BDP Console dev environment). Credentials come from `.env`.

### MCP connections (Gmail, Slack)

The skill uses Gmail MCP and Slack MCP for prospect research. These are native Claude Code MCP connections — the skill invokes them as tool calls, handles empty results gracefully, and falls back to an interview if nothing is found.

---

## Testing approach

Testing is organized into four phases that can be run independently:

**Phase 1 — Research and context:** Verify MCP connections, test that Gmail/Slack/Gong searches return results, verify the fallback interview triggers when no sources find content, check `context.json` structure including the `pages` array.

**Phase 2 — site-agent:** Verify template files were copied, verify `{{APP_ID}}` placeholder was replaced (the most common failure mode), verify Micro is running, verify the dev server started, verify `app_id` is non-null on events in Micro, verify `site-manifest.json` is populated with interactions.

**Phase 3 — events-agent:** Verify schema YAMLs use `pb_test_` prefix and `com.pbenvworkflow` vendor, verify schemas appear in BDP Console, verify TODO comments were replaced in source files, verify `/micro/bad` returns `[]`, verify `schemas-ready.json` has complete property details including enum arrays.

**Phase 4 — data-agent:** Verify Snowflake connectivity, verify Micro has events before running, verify amplification (9 sessions from N source events), verify `snowplow_unified_sessions` has 9 rows after dbt run.

---

## Blockers and how they were resolved

### Enum mismatch (structural)

**Problem:** The schema agent designed schemas before seeing the site. It would define an enum like `["premium", "standard", "free"]` based on what seemed reasonable for the vertical. The site-builder would then generate code that sent `"tier_premium"` or used a different naming convention entirely. Micro validation failed on every run, and fixing it required reading both the schema and the site code to find the discrepancy.

**Resolution:** Reversed the pipeline order — build site first with TODO comments, then derive schemas from the actual component code. events-agent reads the source file before designing the schema, so the enum values it defines are ones it controls end-to-end.

### Null app_id in Micro UI

**Problem:** During the Bumble test run, page_view and ping events showed `app_id: "bumble-demo"` correctly in Micro, but the custom schema events fired by events-agent's curl validation showed `app_id: null`. This made it impossible to distinguish events by app in the Micro UI when testing multiple demos.

**Root cause:** Snowplow's TP2 protocol uses `"aid"` as the field name for app_id in raw payloads. The JS tracker includes this automatically. The manual curl test payloads in events-agent did not include `"aid"`.

**Resolution:** Added `"aid":"<APP_ID>"` to all curl test payloads in events-agent's verification step.

### Site generation too slow (~25 minutes)

**Problem:** site-agent was generating 15+ TypeScript files sequentially from scratch, including files with near-identical content across every demo run (Snowplow tracker setup, consent manager, footer, video page).

**Resolution:** Pre-wrote 13 files as templates in `.claude/agents/site-templates/`. site-agent copies them all in one bash command, stamps two placeholders via `sed`, and starts `npm install` immediately — before generating any custom files. Custom generation (4–5 files) runs in parallel with npm install. Total time dropped from ~25 minutes to ~8 minutes.

### Snowflake MFA blocking data-agent

**Problem:** Snowflake accounts configured to require MFA (TOTP) blocked the Python connector — it would prompt for an authenticator code interactively, hanging the subprocess.

**Resolution:** Added Programmatic Access Token (PAT) support to `tools/snowflake.py`. If `SNOWFLAKE_TOKEN` is set in `.env`, the connector uses `authenticator="programmatic_access_token"` with the token value, bypassing MFA entirely. PATs are generated in the Snowflake UI per user and don't expire on a short cycle.

### dbt schema naming double-suffix

**Problem:** dbt output tables appeared as `pb_dbt_demo_derived_derived`, `pb_dbt_demo_derived_scratch`, etc. — the `_derived` suffix was doubled.

**Root cause:** data-agent was setting the dbt target schema to `SNOWFLAKE_SCHEMA + '_derived'`. The snowplow_unified package then appended its own `_derived` suffix on top.

**Resolution:** data-agent now sets the dbt target schema to `SNOWFLAKE_SCHEMA` only. snowplow_unified appends its suffixes automatically, producing the correct `pb_dbt_demo_derived`, `pb_dbt_demo_scratch`, `pb_dbt_demo_snowplow_manifest` schemas.

### dbt models failing without seed data

**Problem:** `dbt run --select snowplow_unified` failed because the snowplow_unified package requires seed data (lookup tables) to be loaded before models can run.

**Resolution:** Added `dbt seed --profiles-dir . --target dev` as an explicit step before `dbt run` in data-agent.

### Truncated Snowplow atomic schema

**Problem:** The initial DDL for `<SCHEMA>.events` used a simplified ~30-column schema. The snowplow_unified dbt package expects the full atomic schema and failed when columns like `derived_tstamp`, `geo_latitude`, `br_colordepth`, and the context VARIANT columns were missing.

**Resolution:** Expanded `ATOMIC_DDL` in `tools/snowflake.py` to the full 70+ column Snowplow enriched events schema, including all `geo_*`, `br_*`, `os_*`, `mkt_*`, `refr_*`, `se_*`, `pp_*`, `doc_*` columns and VARIANT columns for web_page and client_session contexts.

### Schema name conflicts on re-runs

**Problem:** BDP Console returns an error if you try to publish a schema that already exists under the same name. On re-runs (e.g. second Bumble test), events-agent would attempt to publish `pb_test_profile_viewed` and fail because it was already there from the first run.

**Current state:** events-agent self-corrects by renaming conflicting schemas (e.g. `pb_test_profile_viewed` → `pb_test_profile_detail_viewed`). A cleaner solution would be to check existing schemas before publishing and skip or version-bump as needed — this is an open item.

### Context window pollution from long-running processes

**Problem:** npm install output, dbt run logs, and Micro event dumps are verbose. When all of this ran in a single Claude Code session (the original Python pipeline approach), the context window filled up with log output before the workflow was complete.

**Resolution:** Each sub-agent runs in its own isolated context window via the Agent tool. Verbose output from one phase doesn't carry into the next.

---

## Configuration and team setup

The project uses a two-file config pattern to separate personal credentials from shared project settings:

**`.env`** (gitignored, personal) — Snowflake user, password or PAT token, account identifier, `REPO_ROOT` path. Each team member fills this in from `.env.example`.

**`config.env`** (gitignored, shared template in `config.env.example`) — Snowflake database, warehouse, schema, role, and Snowplow Iglu registry URL. These are project-wide settings that don't change per team member.

`tools/snowflake.py` auto-loads both files at import time. Sub-agents do not need to manage credential loading explicitly.

**Onboarding a new team member:**
1. Clone the repo
2. Copy `.env.example` → `.env` and fill in personal Snowflake credentials
3. Copy `config.env.example` → `config.env` and fill in project Snowflake settings
4. Set `REPO_ROOT` in `.env` to your local repo path
5. Run `cd demo-gen && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`

---

## What's still manual or incomplete

**BDP Console schema cleanup between runs:** If re-running for the same prospect, existing `pb_test_*` schemas in BDP Console dev need to be deleted manually before events-agent runs. The CLI doesn't expose a delete command, so this requires the BDP Console UI. The `/clean-demo` skill reminds you of this step.

**Single-site per run:** The pipeline generates one site per context.json. Running a second demo requires resetting output and re-running from scratch (`/clean-demo`). There's no mechanism to maintain multiple demo environments simultaneously.

**Data amplification is synthetic:** The 9-session amplification is useful for making dbt models non-trivial, but all sessions originate from the same 5–10 minutes of site interaction. The behavioral patterns are repetitive. Real-looking data would require longer or scripted site interaction before running data-agent.
