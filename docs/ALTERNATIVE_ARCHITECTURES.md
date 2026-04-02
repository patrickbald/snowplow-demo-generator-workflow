# Demo Gen — Alternative Architectures

This document explores how the demo generation workflow could be architected differently from the current approach. Each option is evaluated on pros, cons, level of effort, and the user group it fits best.

---

## Current Architecture (Baseline)

**Local CLI + Claude agents + Snowplow Micro + local Next.js**

The SA runs `demo_gen.py` from their laptop. Claude agents generate schemas, scaffold a Next.js site, and start Snowplow Micro in Docker. The SA interacts with the local site to generate events, then the data agent loads them to Snowflake and runs dbt.

**Best for:** Technical SAs who are comfortable in the terminal and want full control.

---

## Option 1 — Web UI Wrapper (Hosted Internal Tool)

### What it is
A lightweight internal web app (e.g. Next.js + FastAPI) that wraps the existing pipeline. SAs fill out a form (company name, vertical, use cases), hit Run, and watch the pipeline execute in a streaming log view. No terminal required.

### How it differs from current
- Form-based intake replaces the CLI/Claude Code conversation
- Pipeline runs on a server (not the SA's laptop)
- Micro runs server-side; the generated demo site is served from the same host
- Results page shows the live demo URL, Micro endpoint, and Snowflake query

### Pros
- No local setup — works from any browser, including on a call
- AEs and SEs with no terminal comfort can run demos independently
- Centralized logging — every demo run is recorded
- Demo site URL is shareable with the prospect during the call

### Cons
- Requires hosting infrastructure and maintenance
- Docker-in-Docker or a managed container runtime needed for Micro
- Snowflake auth per-SA becomes more complex (OAuth or shared service account)
- Harder to debug when things go wrong — less transparency than CLI output

### Level of effort
**High** — 3–4 weeks. Requires a backend service, job queue (for async pipeline runs), streaming log UI, and deployment pipeline.

### Best for
- AEs and SEs who want to run demos without engineering setup
- Teams running high volumes of demos (5+ per week)
- Orgs that want a shared demo library rather than per-SA local setups

---

## Option 2 — Fully Cloud-Native (No Local Dependencies)

### What it is
Eliminate all local components. Snowplow Micro runs as a cloud container (ECS/Cloud Run), the demo site is deployed to a CDN (Vercel/Netlify) per run, and schemas are published directly to BDP Console. The SA only interacts via Claude Code or a web UI.

### How it differs from current
- No Docker on the SA's machine
- Demo site is a real public URL, not localhost
- Events go to a cloud-hosted Micro instance, not a local one
- The pipeline is triggered remotely and monitored via a dashboard

### Pros
- No local setup at all — runs from any machine
- Demo site URL can be sent to the prospect before/during the call
- Micro is persistent — events survive laptop resteps or call drops
- Scales to multiple concurrent demos
- Natural path toward a fully async "AE self-serve" model

### Cons
- Most complex architecture — cloud infra, container orchestration, CDN deployment pipelines
- Cost per demo (compute, CDN, Micro container runtime)
- Snowplow Micro is designed for local use; running it in cloud adds latency and config complexity
- Security considerations: demo sites are public URLs, events go over the internet
- Harder to iterate quickly — deploys take time vs. `npm run dev` locally

### Level of effort
**Very high** — 6–8 weeks minimum. Requires cloud infra (Terraform/CDK), container registry, CD pipeline for demo sites, and a Micro deployment pattern that isn't standard.

### Best for
- Large SA teams (10+) needing concurrent, independent demo environments
- Orgs where the prospect needs to interact with the demo site independently (async demos, POC leave-behinds)
- Future state where AEs self-serve without any SA involvement

---

## Option 3 — Claude Code as the Only Interface (Current + Polished)

### What it is
Keep the current architecture but formalize Claude Code as the primary interface. The skill (`/demo-workflow`) handles all research, context-gathering, and pipeline orchestration. The SA never touches the terminal directly — everything flows through the Claude Code conversation.

### How it differs from current
- This is essentially the current direction — the main investment is in making the skill more robust
- Research (Gmail, Slack, Gong) is automated pre-run
- Confirmation checkpoints are built into the skill, not the agents
- Errors surface as natural language in the conversation, not raw stack traces

### Pros
- Minimal new infrastructure — builds on what exists
- The conversation IS the audit trail — every decision is visible
- Research automation (Gmail/Slack/Gong) saves significant prep time
- Easy to iterate — prompt changes are instant, no deploy cycle
- Natural fit for SAs already using Claude Code daily

### Cons
- Requires Claude Code to be installed and configured per SA
- Still requires Docker and Node on the SA's machine
- Snowflake auth blocker (MFA/keypair) still needs solving
- Not accessible to non-technical team members

### Level of effort
**Low** — ongoing incremental improvements. Most of the work is prompt tuning, bug fixes, and filling gaps (keypair auth, Iglu URL from env, etc.).

### Best for
- Technical SAs who are already Claude Code users
- Teams that prioritize iteration speed over polish
- The current Snowplow SA team as a near-term solution

---

## Option 4 — n8n / Zapier Workflow Automation

### What it is
Replace the Claude agent pipeline with a visual workflow tool (n8n self-hosted or Zapier). Each step — schema generation, site scaffolding, Snowflake loading, dbt — becomes a node in a workflow. Claude API calls are individual steps, not an orchestrating agent loop.

### How it differs from current
- No Python code to maintain — workflow defined visually
- Each step is a discrete, inspectable node
- Triggers could be form submissions, Slack commands, or CRM webhooks
- Less flexible but more accessible to non-engineers

### Pros
- Non-engineers can modify and maintain the workflow
- Built-in retry logic, error handling, and step-level logging
- Easy to add new triggers (e.g., HubSpot deal stage change → start demo prep)
- Good for linear pipelines where each step is well-defined

### Cons
- Claude agent loops (retry on validation failure, self-correction) are hard to express in node-based tools
- Complex logic (e.g., "read the schema YAML and fix enum values") requires custom code nodes — defeating the purpose
- Harder to debug multi-step AI reasoning
- n8n self-hosting adds infra overhead; Zapier has cost and step limits

### Level of effort
**Medium** — 2–3 weeks to build and test. Lower ongoing maintenance cost, but limited ceiling for complex AI behaviour.

### Best for
- RevOps or Marketing teams who want to trigger demo prep from CRM events
- Simpler workflows where the AI reasoning steps are minimal
- Organisations that already use n8n/Zapier and want to avoid Python infrastructure

---

## Option 5 — Agent SDK / Multi-Agent Framework (LangGraph, CrewAI)

### What it is
Rebuild the pipeline using a multi-agent framework like LangGraph or CrewAI. Each agent (schema, env, data) becomes a node in a graph. The orchestrator manages state transitions, retries, and inter-agent communication through the framework's primitives rather than file-based handoffs.

### How it differs from current
- State is managed by the framework, not shared JSON files
- Agent coordination is explicit in a graph definition, not implicit via polling
- Built-in support for parallel execution, retries, and human-in-the-loop checkpoints
- Easier to add new agents or swap models per node

### Pros
- Cleaner state management — no polling loops or race conditions
- Human-in-the-loop is a first-class primitive (LangGraph `interrupt`)
- Parallel agent execution is trivial to configure
- Better observability via LangSmith or similar
- Easier to extend — new agents slot into the graph cleanly

### Cons
- Adds framework dependency and learning curve
- Framework abstractions can obscure what Claude is actually doing — harder to debug prompt issues
- Current raw SDK approach is already working and narrate-able
- LangGraph in particular has a steep conceptual model (nodes, edges, state reducers)

### Level of effort
**Medium-high** — 3–4 weeks to rewrite and test. Ongoing cost of keeping up with framework updates.

### Best for
- Teams with engineers who are already LangGraph/CrewAI users
- Workflows that need parallel agent execution at scale
- Longer-term: if the pipeline grows beyond 5–6 agents and file-based handoffs become unwieldy

---

## Option 6 — Scheduled / Async Pre-Generation (AE Self-Serve)

### What it is
Decouple demo generation from the live call entirely. AE fills out a deal brief in HubSpot/Salesforce when a demo is booked. A scheduled job (or webhook) picks this up, runs the full pipeline overnight, and emails the SA a ready-to-use demo URL before the call.

### How it differs from current
- Demo prep happens asynchronously, not during or just before the call
- Triggered by a CRM event, not a manual CLI command
- SA receives output (URLs, event table) rather than running the pipeline
- Demo site is pre-warmed with data — no "interact with the site" step needed

### Pros
- Zero prep time on the day of the call
- AE owns the trigger — SA is just the recipient
- Demo site can be shared with the prospect ahead of the call
- Scales naturally — pipeline runs overnight for all booked demos

### Cons
- Requires CRM integration and a reliable async job runner
- AE deal brief quality becomes critical — garbage in, garbage out
- Less flexibility for last-minute context changes
- Still requires the Snowflake auth and infra challenges to be solved

### Level of effort
**High** — 4–6 weeks, primarily for CRM integration, job scheduling, and making the pipeline robust enough to run unattended.

### Best for
- High-volume sales teams (AEs booking 3+ demos per week)
- Orgs where the AE has strong deal context and writes good notes
- The long-term "remove the SA from repetitive prep" vision

---

## Summary Comparison

| Architecture | Effort | Technical Requirement | Best User | Key Blocker |
|---|---|---|---|---|
| **Current (CLI + Claude Code)** | Low (ongoing) | High | Technical SAs | Snowflake MFA / keypair auth |
| **Web UI Wrapper** | High | Medium | AEs, non-technical SEs | Infra + hosting |
| **Fully Cloud-Native** | Very High | Low (for end user) | Any | Infra complexity, cost |
| **Claude Code as primary interface** | Low | High | Claude Code SAs | Same as current |
| **n8n / Zapier** | Medium | Low | RevOps, non-engineers | Limited AI reasoning flexibility |
| **Agent Framework (LangGraph)** | Medium-High | High | Engineers | Rewrite cost, framework learning curve |
| **Async pre-generation** | High | Low (for SA) | High-volume AE teams | CRM integration, job reliability |

---

## Recommended Path

**Near-term (v1 → v2):** Stay on the current CLI + Claude Code architecture. Fix the Snowflake keypair blocker, move the Iglu URL to `.env`, and keep iterating on prompt quality. The research automation (Gmail/Slack/Gong) is the highest-leverage addition.

**Medium-term (v2 → v3):** Add a lightweight web UI wrapper for the intake and pipeline monitoring steps. Keep the backend agents unchanged — just put a form in front of the CLI. This unlocks AE and non-technical SE usage without a full rewrite.

**Long-term (v3+):** Async pre-generation triggered from CRM. By then the pipeline should be reliable enough to run unattended, and the AE self-serve model becomes credible.
