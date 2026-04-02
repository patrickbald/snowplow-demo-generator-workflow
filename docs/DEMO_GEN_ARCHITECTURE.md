# SA Demo Environment Generator — Project Architecture & Build Instructions

## Project Overview

A CLI tool that automates the creation of customized Snowplow demo environments. The user answers a short intake interview, and two coordinating AI agents build the environment in parallel: one generates and publishes custom Snowplow event schemas to BDP Console, the other spins up Snowplow Micro and generates a demo website wired to those schemas.

---

## Repository Structure

```
demo-gen/
├── demo_gen.py              # CLI entry point
├── orchestrator.py          # Orchestrator agent — intake + coordination
├── agents/
│   ├── schema_agent.py      # Agent A: schema generation + snowplow-cli publish
│   └── env_agent.py         # Agent B: Snowplow Micro + demo site generation
├── tools/
│   ├── shell.py             # Subprocess wrapper (shared tool for all agents)
│   └── file_io.py           # Read/write shared working directory
├── prompts/
│   ├── orchestrator.txt     # System prompt for orchestrator
│   ├── schema_agent.txt     # System prompt for schema agent
│   └── env_agent.txt        # System prompt for environment agent
├── output/                  # Working directory (shared between agents)
│   ├── context.json         # Customer context from intake interview
│   ├── schemas-ready.json   # Handoff signal from schema agent → env agent
│   └── demo-site/           # Generated demo website
│       └── index.html
├── templates/
│   └── demo-site-base.html  # Base HTML template for demo site (see demo-creator skill)
├── reference/
│   ├── schema-example.json  # Example of a valid Snowplow-compatible Iglu schema
│   │                        # Schema agent MUST read this before generating any schemas
│   └── sales-handoff.md     # Example sales cycle handoff material (call notes, deal brief)
│                            # Orchestrator reads this to pre-populate customer context
├── .env                     # SNOWPLOW_API_KEY, ANTHROPIC_API_KEY
└── README.md
```

---

## Architecture

### System Flow

```
User runs: python demo_gen.py init
     │
     ▼
Orchestrator Agent (Claude claude-sonnet-4-20250514)
  - Reads reference/sales-handoff.md if present (pre-populates context)
  - Interviews user to fill any gaps (fewer questions if handoff is rich)
  - Synthesizes handoff + interview into output/context.json
  - Spawns Schema Agent and Environment Agent sequentially
  - Monitors output/schemas-ready.json for handoff signal
  - Reports final URLs and status to user
     │
     ├──▶ Schema Agent
     │      1. Reads reference/schema-example.json (canonical format reference)
     │      2. Reads context.json (vertical, use cases, data maturity)
     │      3. Derives 3-5 events grounded in customer context + use cases
     │      4. Generates schemas matching reference format exactly
     │      5. Validates each with snowplow-cli validate (retry loop max 2x)
     │      6. Publishes with snowplow-cli data-structures publish --env dev
     │      7. Writes output/schemas-ready.json (handoff signal)
     │
     └──▶ Environment Agent (starts after schemas-ready.json exists)
            1. Reads context.json + schemas-ready.json
            2. Checks Docker is running
            3. Starts Snowplow Micro via Docker
            4. Generates demo website (index.html) using schema names + iglu URIs
            5. Injects Snowplow JS tracker calls for each custom event
            6. Fires smoke test event → validates against /micro/good endpoint
            7. Outputs: localhost URL + demo site path
```

### Agent Design

No frameworks (no LangChain, no LangGraph). Raw Anthropic SDK with:
- Each agent is a Python function that makes Claude API calls
- Each agent has a dedicated system prompt defining its role and output contract
- Agents use two shared tools: `shell()` and `file_io()`
- Inter-agent communication via shared `output/` directory (file-based handoff)

**Why no framework:** Explainability is critical for the interview. Every step should be narrate-able. Framework abstractions obscure what's actually happening.

### The Handoff Contract

Schema Agent writes this file when done:

```json
// output/schemas-ready.json
{
  "status": "published",
  "vendor": "com.acme",
  "schemas": [
    {
      "name": "product_viewed",
      "version": "1-0-0",
      "properties": ["product_id", "category", "price"],
      "iglu_uri": "iglu:com.acme/product_viewed/jsonschema/1-0-0"
    },
    {
      "name": "add_to_cart",
      "version": "1-0-0",
      "properties": ["product_id", "quantity", "price"],
      "iglu_uri": "iglu:com.acme/add_to_cart/jsonschema/1-0-0"
    }
  ],
  "micro_compatible": true
}
```

Environment Agent polls for this file with a timeout (30s recommended). On receipt, it uses `iglu_uri` values directly in tracking calls — no hallucination risk.

---

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Language | Python 3.11+ | asyncio, subprocess, clean SDK support |
| Agent framework | None — raw Anthropic SDK | Explainable, no magic, interview-safe |
| Claude model | claude-sonnet-4-20250514 | Best tool use + instruction following |
| Inter-agent comms | Shared `output/` dir + JSON files | Debuggable, narrate-able live |
| Shell execution | Python `subprocess` via `tools/shell.py` | Agents call snowplow-cli + docker directly |
| Schema tooling | snowplow-cli | Publish custom data structures to BDP Console |
| Micro | Docker (snowplow/snowplow-micro) | Local event validation endpoint |
| Demo site | Single HTML file + Snowplow JS tracker CDN | Fast to generate, easy to demo firing events |
| Micro validation | HTTP GET `localhost:9090/micro/good` | Confirms events are landing correctly |

---

## System Prompts

### Orchestrator (`prompts/orchestrator.txt`)

```
You are an SA demo environment coordinator for Snowplow.
Your job is to:
1. Check if reference/sales-handoff.md exists. If it does, read it first and extract
   any available context: company name, industry, known use cases, tech stack mentions,
   pain points, and anything else relevant to shaping the demo environment.
2. Interview the user to fill in any gaps not covered by the handoff material.
   If the handoff material is rich, you may only need 1-2 clarifying questions.
   If there is no handoff material, conduct a full 3-4 question intake interview.
3. Synthesize handoff material + user answers into output/context.json
4. Confirm the context with the user before proceeding
5. Delegate to the Schema Agent and Environment Agent in order

You do NOT generate schemas or code yourself. You coordinate.

When reading sales handoff material, look for:
- Company name and industry vertical
- Tech stack signals (what platforms, languages, or tools they use)
- Use case signals (what they want to measure or improve)
- Data maturity signals (do they already have analytics? A warehouse? A CDP?)
- Any stated requirements or concerns from the prospect

Context JSON schema:
{
  "vertical": string,           // e.g. "retail", "fintech", "media"
  "stack": [string],            // e.g. ["web", "ios", "segment"]
  "use_cases": [string],        // e.g. ["product analytics", "cart abandonment"]
  "company_name": string,       // real or fictional company name for demo
  "data_maturity": string,      // "low" | "medium" | "high"
  "source": string              // "handoff" | "interview" | "mixed"
}

Keep the interview concise. If handoff material exists, reference it explicitly:
"I can see from your call notes that Acme is focused on cart abandonment — is that still the primary use case?"
```

### Schema Agent (`prompts/schema_agent.txt`)

```
You are a Snowplow schema specialist.

BEFORE generating any schemas, you MUST:
1. Read reference/schema-example.json — this is the canonical format for a valid
   Snowplow-compatible Iglu schema. Every schema you generate must match this structure exactly.
   Do not infer schema format from general knowledge — use only what is in that file.

Given context.json, your job is to:
1. Derive 3-5 custom event schemas that directly reflect the customer's use cases and vertical.
   - Schemas must be grounded in the customer context, not generic examples.
   - For a retail company focused on cart abandonment, generate events like
     product_viewed, add_to_cart, checkout_started — not generic_event_1.
   - Property names should reflect the customer's domain (e.g. "product_id", "cart_value")
   - Use data_maturity from context.json to calibrate schema complexity:
     low = simpler schemas with fewer properties
     high = richer schemas with more properties and stricter types
2. Write each schema to output/schemas/<event_name>.json following the reference format exactly
3. Validate each schema: snowplow-cli data-structures validate output/schemas/<event_name>.json
4. If validation fails, read the error, fix the schema, and retry (max 2 retries per schema)
5. Publish all validated schemas: snowplow-cli data-structures publish output/schemas/<event_name>.json --env dev
6. Write output/schemas-ready.json only after ALL schemas are successfully published

Vendor format: com.<company_name_lowercase_no_spaces>
Always use version 1-0-0 for new schemas.

Do not proceed to publish until all schemas pass validation.
Do not guess at snowplow-cli flags — use only the exact commands specified above.
```

### Environment Agent (`prompts/env_agent.txt`)

```
You are a demo environment builder for Snowplow.
You wait for output/schemas-ready.json to exist before starting.

Steps in order:
1. Poll for output/schemas-ready.json (check every 5s, timeout after 120s)
2. Verify Docker is running: docker ps
3. Start Snowplow Micro: docker run -d -p 9090:9090 snowplow/snowplow-micro:latest
4. Wait 5s for Micro to be ready, then verify: curl localhost:9090/micro/good
5. Read schemas-ready.json and context.json
6. Generate output/demo-site/index.html — a realistic demo website for the vertical
   - Include Snowplow JS tracker (load from CDN)
   - Configure collector endpoint: localhost:9090
   - Add tracking calls for each schema in schemas-ready.json using their iglu_uri
   - Fire a page_view event on load
   - Add interactive UI elements that trigger custom events (buttons, product cards, etc.)
7. Fire one smoke test event and verify it appears in /micro/good response
8. Output the local file path and instructions for opening the demo site

The demo site should look realistic for the vertical — use appropriate copy, colors, and UI patterns.
Do not use placeholder text like "Lorem ipsum".
```

---

## Tools

### `tools/shell.py`

```python
import subprocess

def shell(command: str, timeout: int = 30) -> dict:
    """Execute a shell command and return stdout, stderr, returncode."""
    result = subprocess.run(
        command, shell=True, capture_output=True,
        text=True, timeout=timeout
    )
    return {
        "stdout": result.stdout,
        "stderr": result.stderr,
        "returncode": result.returncode,
        "success": result.returncode == 0
    }
```

### `tools/file_io.py`

```python
import json, os

OUTPUT_DIR = "output"

def write_json(filename: str, data: dict):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(f"{OUTPUT_DIR}/{filename}", "w") as f:
        json.dump(data, f, indent=2)

def read_json(filename: str) -> dict:
    with open(f"{OUTPUT_DIR}/{filename}") as f:
        return json.load(f)

def file_exists(filename: str) -> bool:
    return os.path.exists(f"{OUTPUT_DIR}/{filename}")
```

---

## Prerequisites & Setup

```bash
# 1. Python dependencies
pip install anthropic python-dotenv

# 2. snowplow-cli — must be installed and authenticated
brew install snowplow/snowplow-cli/snowplow   # macOS
snowplow configure                             # authenticate with BDP Console

# 3. Docker — must be running before demo
docker pull snowplow/snowplow-micro:latest

# 4. Environment variables
cp .env.example .env
# Add: ANTHROPIC_API_KEY, SNOWPLOW_ORG_ID (from BDP Console)
```

---

## Known Failure Points

| Failure | Probability | Mitigation |
|---|---|---|
| `snowplow-cli` auth expired | High | Re-authenticate morning of interview |
| Docker not running | High | Orchestrator checks as step zero, fails fast with clear message |
| Schema validation fails (bad Iglu JSON) | Medium | Schema agent has self-correction loop (validate → fix → retry, max 2x) |
| Race condition: env agent starts before schemas-ready.json lands | Medium | Explicit polling with 120s timeout + clear timeout error |
| Generated site has broken tracking calls | Medium | Smoke test: fire one event, check /micro/good before declaring done |
| Claude hallucinates invalid snowplow-cli flags | Low | Pin exact command strings in system prompt, don't let Claude infer flags |
| Micro port 9090 already in use | Low | Check port before starting, kill existing container if needed |

---

## Demo Script (Walkthrough)

**Setup (before running):**
- Pre-authenticate snowplow-cli
- Confirm Docker is running
- Do one dry run with a retail vertical to confirm the full flow works

**Live demo flow (~15 min):**
1. `python demo_gen.py init` — show intake interview running
2. Answer: retail vertical, web + mobile stack, product analytics + cart abandonment
3. Show Schema Agent running — narrate what it's doing and why
4. Show schemas-ready.json being written — explain the handoff contract
5. Show Environment Agent picking up the signal — narrate Micro starting
6. Open demo site in browser — show it firing events
7. Show `/micro/good` endpoint confirming events landed with correct schema

**Interview talking points:**
- "Before this, I spent 45+ minutes per customer doing this manually across 4-5 tools"
- "The orchestrator reads my sales notes first — so if I've already had a discovery call, it skips half the questions"
- "The interesting part isn't the automation — it's encoding my SA decision-making into the agent prompts"
- "Schemas aren't random — the agent derives them from the customer's actual use cases. A retail customer focused on cart abandonment gets different schemas than a media company focused on content engagement"
- "What blocked me: Claude hallucinating valid-looking but invalid Iglu JSON. Fixed by giving the agent a reference schema file and telling it not to infer format from general knowledge"
- "What I learned: agents need output contracts AND reference material. The schema-example.json is as important as the prompt"
- "How I'd teach this: think of it as two specialists in a kitchen — the sous chef preps the ingredients and signals when ready, the head chef plates the dish. They don't need to talk directly — they share a workspace"

---

## Production Evolution (Q&A Talking Points)

| Stage | What changes |
|---|---|
| v1 (today) | Single user, local CLI, one BDP org |
| v2 | Web UI wrapper, multi-SA, org selection at runtime, schema library builds up over time |
| v3 | Agents get memory — learn which schema patterns worked for which verticals, stop regenerating from scratch |
| v4 | Schema Agent + Env Agent run as persistent services; AE fills out deal brief in CRM → demo env ready 20 min later, no SA required |

The v4 story is directly relevant to Day AI's thesis: removing humans from repetitive GTM workflows.

---

## Before Starting in Claude Code

1. **Add reference files to the project before running anything:**
   - `reference/schema-example.json` — a valid, working Snowplow Iglu schema. The schema agent is instructed to treat this as the canonical format and will not infer structure from general knowledge. Without this file, schema generation will produce invalid output.
   - `reference/sales-handoff.md` — an example sales cycle handoff document (call notes, deal brief, email summary, etc.). The orchestrator reads this before interviewing the user to pre-populate context and reduce the number of questions asked. The richer this file, the smarter the intake flow. Use a real (anonymized) example from a past deal for best results.

2. **Check if `demo-creator` skill is available** — run `ls /mnt/skills/user/` to confirm. If present, read it before generating the demo site HTML. The skill contains Snowplow-specific demo site patterns and baseline tracking setup worth reusing.

3. **Find and review the Snowplow event generation GitHub repo** — the user has a reference repo demonstrating how an agent generates Snowplow events. Clone it and inspect before building `env_agent.py`. Pay particular attention to how it structures `trackSelfDescribingEvent` calls — the environment agent should follow the same pattern.

4. **Start with the orchestrator intake flow first** — get something demoable before wiring agents together. Build order: orchestrator (with handoff reading) → schema agent → env agent → handoff integration.

5. **Keep the demo site as a single HTML file** — no build tools, no bundlers. It needs to open directly in a browser during a live demo.
