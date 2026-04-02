# Demo Gen — Architecture

## Current State (as of 2026-03-30)

### What exists

- `.claude/skills/demo-workflow/SKILL.md` — orchestration skill, research, confirmation, Agent tool invocations
- `.claude/agents/site-agent.md` — builds Next.js site with baseline tracking, starts Micro, writes site-manifest.json
- `.claude/agents/events-agent.md` — reads site source, designs schemas, publishes, injects tracking, Micro verification loop
- `.claude/agents/data-agent.md` — loads events to Snowflake, runs dbt, surfaces results
- `demo-gen/tools/snowflake.py` — Snowflake connection, event parsing, amplification (~150 lines)
- `demo-gen/reference/schema-example.yml` — canonical schema format, read by events-agent
- `demo-gen/reference/sales-handoff.md` — manual deal notes override
- `demo-gen/.env` — credentials
- `skills/site-generator/references/*.md` — baseline feature patterns, read by site-agent

### Pipeline flow

```
/demo-workflow  (skill)
       │  research: Gmail + Slack + Gong in parallel
       │  confirm context with user
       │  write context.json  (includes explicit page structure)
       │
       ├──▶ site-agent
       │      starts Micro in background while building site
       │      npm install runs in background while writing source files
       │      builds full Next.js site with baseline Snowplow tracking
       │      leaves TODO comments at every custom event injection point
       │      writes site-manifest.json  (pages + interactions + suggested events)
       │
       ├──▶ events-agent
       │      reads site source + site-manifest.json
       │      designs schemas grounded in real site interactions
       │      validates + publishes to BDP Console
       │      injects tracking calls at TODO comment locations
       │      autonomous verification loop: static analysis → curl → /micro/bad → fix → repeat
       │      writes schemas-ready.json
       │
       │  ← user interacts with site, says "done" →
       │
       └──▶ data-agent
              fetches events from Micro /good
              amplifies 9× across simulated sessions
              loads into Snowflake
              writes + runs dbt project (snowplow_unified)
              surfaces views / sessions / users counts
```

### Why this architecture

- **Site-first** — schemas derived from real site interactions, not the other way around. Eliminates the enum mismatch class of bugs that required manual fixes in the old order.
- **Agent tool** — Claude Code's native sub-agents replace a Python orchestration layer (`demo_gen.py`, `orchestrator.py`, `agents/*.py`). Same context isolation, no `.venv` maintenance for the orchestration itself.
- **site-manifest.json** — explicit handoff contract between site-agent and events-agent. Events-agent reads actual source files and the manifest together, so it knows exactly where to inject and with what data.
- **Autonomous verification loop** — events-agent closes the schema↔site gap entirely. It catches enum mismatches via static analysis before firing any curl requests, then confirms against Micro dynamically. No user intervention needed.
- **Snowflake Python** — `tools/snowflake.py` still earns its place (~150 lines of event parsing, session amplification, batch inserts). data-agent calls it via Python one-liners. This is the only Python infrastructure remaining.

---

## Agent Handoff Artifacts

| File | Written by | Read by |
|---|---|---|
| `output/context.json` | demo-workflow skill | site-agent, events-agent, data-agent |
| `output/site-manifest.json` | site-agent | events-agent |
| `output/schemas/<name>.yml` | events-agent | events-agent (validation loop) |
| `output/schemas-ready.json` | events-agent | data-agent |
| `output/demo-web/` | site-agent | events-agent (source injection) |
| `output/dbt-project/` | data-agent | dbt CLI |

---

## Open Items

1. **Snowflake keypair auth** — documented in IMPROVEMENTS.md. MFA blocks the data step in accounts that require TOTP. Keypair auth is the fix.

2. **GitHub demo library** — save/restore completed demos. Once a repo URL is provided:
   - `tools/library.py` (git clone/push/restore)
   - Demo-workflow skill: "save this demo" and "restore [company]" commands
   - events-agent: check library before generating schemas (reuse if vertical matches)

3. **Performance** (documented in IMPROVEMENTS.md):
   - npm install already starts in background during file writing ✅
   - Micro already starts in background during site build ✅
   - Remaining: parallel schema validation (dir command vs per-file)

---

## Key Files Reference

| File | Purpose |
|---|---|
| `.claude/skills/demo-workflow/SKILL.md` | Main skill — research, orchestration, Agent tool invocations |
| `.claude/agents/site-agent.md` | Next.js site build + Micro startup |
| `.claude/agents/events-agent.md` | Schema design, publish, injection, verification |
| `.claude/agents/data-agent.md` | Snowflake loading + dbt |
| `demo-gen/tools/snowflake.py` | Snowflake helpers (used by data-agent) |
| `demo-gen/.env` | All credentials |
| `demo-gen/output/context.json` | Prospect context + page structure |
| `demo-gen/output/site-manifest.json` | Site interactions map |
| `demo-gen/output/schemas-ready.json` | Published schema manifest |
| `.claude/skills/site-generator/references/` | Baseline feature patterns (shared with standalone skill) |
| `IMPROVEMENTS.md` | Blockers and future improvements |
