---
name: demo-workflow
description: Generate a full Snowplow demo environment for a prospect. Use this skill when asked to "run demo-workflow", "build a demo", "generate a demo for [company]", "set up a demo environment", or "create a Snowplow demo". This skill researches the prospect automatically from Gmail, Slack, and Gong call transcripts, then kicks off automated agents to generate custom schemas, a Next.js demo site, and Snowflake data modeling — all delegated to AI.
---

# Snowplow Demo Environment Generator

This skill orchestrates the full demo generation workflow. Your role is the visible AI layer:
research the prospect, conduct a focused intake to fill any gaps, confirm the context, then
delegate the technical execution to the Python agent pipeline.

---

## What this skill does

1. **Research** — Ask for company name, then search Gmail, Slack, and Gong transcripts automatically
2. **Confirm** — Show the user what was found and ask for confirmation + any gaps
3. **Kick off pipeline** — Write `context.json`, run `demo_gen.py run` (schema agent + env agent)
4. **Pause** — Let the user interact with the live demo site to generate events
5. **Complete pipeline** — Run `demo_gen.py run-data` (data agent: Snowflake + dbt)
6. **Surface results** — Report what was built and how to navigate the demo

---

## Step 1 — Get the company name

Ask the user:

> What company is this demo for?

If the user already provided the company name in their initial message, skip this question.

---

## Step 2 — Research the prospect

Run all of the following in parallel. Each source may or may not return useful content —
handle failures or empty results gracefully and continue.

### 2a. Check the sales handoff file

Read `demo-gen/reference/sales-handoff.md`. If it contains meaningful content for this
company, extract any context from it. If it's empty or for a different company, ignore it.

### 2b. Search Gmail

Search for recent emails related to the company:

- Search 1: `"<company name>"` — general mentions, maxResults 10
- Search 2: `subject:"<company name>"` — emails where the company is in the subject, maxResults 5

From each relevant thread, extract: use cases mentioned, pain points, tech stack signals,
deal stage, any stated requirements or concerns. Ignore routine scheduling or logistics emails.

### 2c. Search Slack

Search for internal discussions about the prospect:

- Search 1: `"<company name>"` — general mentions, limit 10, sort by timestamp descending
- Search 2: `"<company name>" snowplow` — Snowplow-specific discussions, limit 5

From results, extract: use cases discussed, any technical details, internal notes about the
prospect's situation or needs. Ignore unrelated mentions if the company name is ambiguous.

### 2d. Search Gong call transcripts

Query Snowflake for recent call transcripts mentioning the company. Run this command:

```bash
source .venv/bin/activate && python -c "
from dotenv import load_dotenv; load_dotenv()
from tools.snowflake import execute_query
import json

# Discover the table schema first
schema = execute_query(\"\"\"
    SELECT COLUMN_NAME, DATA_TYPE
    FROM GONG_SHARE_DB.INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'GONG_DATA_CLOUD'
      AND TABLE_NAME = 'CALL_TRANSCRIPTS'
    ORDER BY ORDINAL_POSITION
\"\"\")
print(json.dumps(schema.get('rows', []), default=str))
"
```

Once you know the column names, run a second query to find recent transcripts for this company.
Use an ILIKE filter on whichever column holds the account/company name. Limit to the 3 most
recent calls. Truncate transcript text to the first 2000 characters per call to keep the
response manageable:

```bash
source .venv/bin/activate && python -c "
from dotenv import load_dotenv; load_dotenv()
from tools.snowflake import execute_query
import json

results = execute_query(\"\"\"
    SELECT <date_column>, <title_column>, LEFT(<transcript_column>, 2000) as transcript_excerpt
    FROM GONG_SHARE_DB.GONG_DATA_CLOUD.CALL_TRANSCRIPTS
    WHERE <account_column> ILIKE '%<company name>%'
    ORDER BY <date_column> DESC
    LIMIT 3
\"\"\")
print(json.dumps(results.get('rows', []), default=str))
"
```

If the Snowflake query fails (credentials not set, no access to GONG_SHARE_DB, table not found),
skip this source silently and continue — do not surface the error to the user unless all sources
failed.

---

## Step 3 — Synthesize and confirm

Present a summary of what you found and ask the user to confirm before proceeding:

> Here's what I found for **[company name]**:
>
> **From [sources searched]:**
> - [Key finding 1 — e.g., "Focused on cart abandonment and product discovery (from 2 email threads and a Gong call on March 12)"]
> - [Key finding 2 — e.g., "React web app, no mobile yet, currently using GA4"]
> - [Key finding 3 — e.g., "Medium data maturity — interested in Snowflake but not yet set up"]
>
> **Proposed demo context:**
> - **Vertical**: [vertical]
> - **Stack**: [stack]
> - **Use cases**: [use cases]
> - **Data maturity**: [low/medium/high]
>
> Does this look right? Anything missing or different now?

If a source returned nothing useful, don't mention it in the summary — just work with what was found.

If no sources returned anything (no emails, no Slack messages, no transcripts, no handoff),
fall back to a short interview: ask 3–4 focused questions about vertical, use cases, stack,
and data maturity.

Wait for the user to confirm or correct before proceeding.

---

## Step 4 — Write context and run the pipeline

Once confirmed, do these steps in order:

**4a. Write output/context.json**

Before writing context.json, use your research context to design the page structure.
Decide explicitly: what pages the demo needs, what the primary user journey is, and what
interactions on each page best showcase the use cases. This is the richest context you have —
surface it here so site-agent doesn't have to infer it.

Create `demo-gen/output/context.json` with this exact shape:

```json
{
  "vertical": "<vertical>",
  "stack": ["<stack items>"],
  "use_cases": ["<use case items>"],
  "company_name": "<company name>",
  "data_maturity": "<low|medium|high>",
  "source": "<handoff|research|mixed>",
  "pages": [
    {
      "path": "/",
      "name": "<page name>",
      "description": "<what this page shows and what user journey it supports>"
    },
    {
      "path": "/<path>",
      "name": "<page name>",
      "description": "<what this page shows and what user journey it supports>"
    }
  ]
}
```

Include every page the demo should have. Examples by vertical:
- Dating: Home (discovery feed), `/profiles/[id]` (profile detail), `/matches` (match list)
- Ecommerce: Home, `/products/[id]` (product detail), `/checkout`
- Media: Home (article feed), `/articles/[slug]` (article), `/topics/[slug]`
- Travel: Home (search/hero), `/destinations/[id]`, `/search`
- Gaming: Home, `/games/[id]`, `/leaderboard`
- Fintech/SaaS: Home (marketing), `/dashboard`, `/pricing`

Always include `/video` (baseline, pre-built by site-agent).

Use `"source": "research"` if context came from Gmail/Slack/Gong, `"handoff"` if it came from
the handoff file, `"mixed"` if both contributed.

**4b. Run the pipeline**

Invoke the sub-agents in sequence using the Agent tool:

1. **site-agent** — builds the Next.js site with baseline Snowplow tracking, starts Micro,
   writes `demo-gen/output/site-manifest.json`. Takes ~3–5 minutes.

2. **events-agent** — reads the site source and manifest, designs and publishes custom schemas,
   injects tracking calls, runs the Micro verification loop. Takes ~3–5 minutes.

Narrate progress as each agent reports milestones:
- `[site-agent] → /page built` — pages being scaffolded
- `[site-agent] npm install running` — dependencies installing
- `[events-agent] → wrote schema:` — schemas being designed
- `[events-agent] → published` — schemas live in BDP Console
- `[events-agent] → injected tracking` — tracking calls added to site

**4c. Confirm the site is up**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

If it returns 200, the site is live. If not, check `/tmp/demo-dev.log` for errors.

---

## Step 5 — Pause for user interaction

> The demo site is live at **http://localhost:3000** and Snowplow Micro is running at **http://localhost:9090/micro/good**.
>
> Open the site and interact with it — click through product cards, buttons, and any other
> interactive elements to fire events. The more interactions the better, as these become the
> seed data for the Snowflake modeling.
>
> When you're done, just say something like **"done"**, **"ready"**, **"I've used the site"**,
> or **"go ahead"** — I'll automatically kick off the data modeling step.

Wait for ANY message from the user indicating they are finished interacting with the site.
Treat phrases like "done", "ready", "finished", "go ahead", "run it", "I've used the site",
"looks good", or any similar confirmation as the trigger to immediately proceed to Step 6.
Do not ask any follow-up questions — just run the data step.

---

## Step 6 — Run data modeling

Invoke the **data-agent** sub-agent using the Agent tool.

It runs fully automatically — no confirmation prompts. Narrate progress as milestones appear:
- `[data-agent] Found <N> events` — events fetched from Micro
- `[data-agent] → load to Snowflake` — events being amplified and inserted
- `dbt deps` / `dbt run` — packages installing, models running (~2–5 min)
- `[data-agent] Done` — results ready

---

## Step 7 — Surface results

> **Demo environment ready.**
>
> **Demo site**: http://localhost:3000
> **Event validation**: http://localhost:9090/micro/good
>
> **Custom events wired in**: [list event names and how to trigger them — read from output/schemas-ready.json]
>
> **Snowflake modeling complete**:
> - Views: `<SNOWFLAKE_DATABASE>.<SNOWFLAKE_SCHEMA>_derived.snowplow_unified_views`
> - Sessions: `<SNOWFLAKE_DATABASE>.<SNOWFLAKE_SCHEMA>_derived.snowplow_unified_sessions`
> - Users: `<SNOWFLAKE_DATABASE>.<SNOWFLAKE_SCHEMA>_derived.snowplow_unified_users`
>
> ```sql
> SELECT * FROM <SNOWFLAKE_DATABASE>.<SNOWFLAKE_SCHEMA>_derived.snowplow_unified_sessions LIMIT 10;
> ```

Read `demo-gen/output/context.json`, `demo-gen/output/schemas-ready.json`, and `demo-gen/config.env` for specific values (`SNOWFLAKE_DATABASE`, `SNOWFLAKE_SCHEMA`).

---

## Notes

- Run all Step 2 research in parallel — don't wait for Gmail before starting Slack.
- If the company name is common or ambiguous, use additional filters (e.g., domain name from email, Snowplow context in Slack) to avoid pulling irrelevant results.
- The venv (`demo-gen/.venv`) must be active for any Python commands inside the sub-agents.
- If only the data step fails, invoke data-agent directly — no need to re-run site-agent or events-agent.
- If only schema/tracking needs fixing, invoke events-agent directly — site-agent output and site-manifest.json persist.
- If the site itself needs rebuilding, run site-agent first, then events-agent, then data-agent.
