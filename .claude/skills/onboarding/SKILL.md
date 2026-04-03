---
name: onboarding
description: Interactive setup wizard for new team members. Walks through installing prerequisites, configuring credentials, setting up the Python venv, authenticating snowplow-cli, and verifying MCP connections. Run this once on a new machine before using /demo-workflow.
---

# Snowplow Demo Generator — Onboarding Wizard

Walk the user through every setup step in order. Check what's already done and skip it —
don't make them redo things. Verify each step before moving on. Be specific about what
to run and where to find values. End by running the full pre-demo-check.

Greet the user:

> Welcome! I'll walk you through setting up the Snowplow demo generator on this machine.
> I'll check what's already installed, guide you through anything missing, and verify
> everything works before we're done. This usually takes about 10 minutes.

---

## Step 1 — Check prerequisites

Run all checks in parallel:

```bash
node --version 2>/dev/null && echo "NODE_OK" || echo "NODE_MISSING"
npm --version 2>/dev/null && echo "NPM_OK" || echo "NPM_MISSING"
docker info > /dev/null 2>&1 && echo "DOCKER_OK" || echo "DOCKER_MISSING"
snowplow-cli --version > /dev/null 2>&1 && echo "CLI_OK" || echo "CLI_MISSING"
python3 --version 2>/dev/null && echo "PYTHON_OK" || echo "PYTHON_MISSING"
```

For each MISSING item, print the specific install instruction and wait for the user to confirm
they've installed it before moving on. Do not proceed past Step 1 until all are present.

- **Node.js / npm missing**: `brew install node` (Mac) or download from nodejs.org. Minimum version: Node 18.
- **Docker missing**: Download Docker Desktop from docker.com and start it.
- **snowplow-cli missing**: `brew install snowplow/taps/snowplow-cli`
- **Python missing**: `brew install python3` or download from python.org. Minimum version: Python 3.10.

After all pass:
> All prerequisites installed. Moving on.

---

## Step 2 — Verify repo location

```bash
ls demo-gen/tools/snowflake.py 2>/dev/null && echo "IN_REPO" || echo "NOT_IN_REPO"
```

If `NOT_IN_REPO`:
> It looks like Claude Code isn't open from the repo root. Please close this session,
> navigate to the `snowplow-demo-generator-workflow` directory, and reopen Claude Code there.
> Run: `cd snowplow-demo-generator-workflow && claude`

If `IN_REPO`: continue.

---

## Step 3 — Python venv

```bash
[[ -d demo-gen/.venv ]] && echo "VENV_EXISTS" || echo "VENV_MISSING"
```

If `VENV_MISSING`:
> Creating Python virtual environment...

```bash
cd demo-gen && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
```

Print progress as pip installs. After completion:
> Python environment ready.

If `VENV_EXISTS`:
```bash
cd demo-gen && source .venv/bin/activate && python -c "import snowflake.connector, dbt" 2>/dev/null && echo "VENV_OK" || echo "VENV_BROKEN"
```

If `VENV_BROKEN`:
> Your venv exists but is missing packages. Reinstalling...
```bash
cd demo-gen && source .venv/bin/activate && pip install -r requirements.txt
```

If `VENV_OK`:
> Python environment already set up.

---

## Step 4 — Configure .env

```bash
[[ -f demo-gen/.env ]] && echo "ENV_EXISTS" || echo "ENV_MISSING"
```

If `ENV_MISSING`:
> Let's set up your personal credentials file. I'll create it from the template and
> walk you through each value.

```bash
cp demo-gen/.env.example demo-gen/.env
```

Then ask for each value one at a time and write it into the file:

**4a. Snowflake account identifier**
> What is your Snowflake account identifier?
> (Find it in Snowflake UI → bottom-left account menu → "Copy account identifier".
> Format: `orgname-accountname`, e.g. `myorg-analytics`)

Once provided, write `SNOWFLAKE_ACCOUNT=<value>` into `demo-gen/.env`.

**4b. Snowflake username**
> What is your Snowflake username? (usually your work email or firstname.lastname)

Write `SNOWFLAKE_USER=<value>` into `demo-gen/.env`.

**4c. Snowflake auth — PAT token (preferred) or password**
> How would you like to authenticate with Snowflake?
> 1. Programmatic Access Token (recommended — bypasses MFA)
> 2. Password
>
> To create a PAT: Snowflake UI → your username (top-right) → My Profile → Programmatic Access Tokens → Generate.

If PAT: write `SNOWFLAKE_TOKEN=<value>` into `demo-gen/.env`.
If password: write `SNOWFLAKE_PASSWORD=<value>` into `demo-gen/.env`.

**4d. REPO_ROOT**
> Setting REPO_ROOT to the current directory...

```bash
echo "REPO_ROOT=$(pwd)" >> demo-gen/.env
```

If `ENV_EXISTS`:
> Found existing .env. Checking for required values...

```bash
cd demo-gen && source .env 2>/dev/null
for var in SNOWFLAKE_ACCOUNT SNOWFLAKE_USER REPO_ROOT; do
  [[ -z "${!var}" ]] && echo "MISSING $var" || echo "OK $var"
done
[[ -n "$SNOWFLAKE_TOKEN" || -n "$SNOWFLAKE_PASSWORD" ]] && echo "OK auth" || echo "MISSING auth"
```

For any MISSING var, ask for the value and write it into `.env`. Then continue.

---

## Step 5 — Configure config.env

```bash
[[ -f demo-gen/config.env ]] && echo "CONFIG_EXISTS" || echo "CONFIG_MISSING"
```

If `CONFIG_MISSING`:
> Now let's set up the shared project configuration.

```bash
cp demo-gen/config.env.example demo-gen/config.env
```

Ask for each value:

**5a. Snowflake database**
> What Snowflake database should demo data be written to?
> (Ask your team lead if unsure — e.g. `ANALYTICS_DEV_DB`)

**5b. Snowflake warehouse**
> What Snowflake warehouse should be used?
> (e.g. `ANALYTICS_DEV_WH`)

**5c. Snowflake schema (personal)**
> Choose a personal schema name for your demo data — use your name to avoid conflicts
> with teammates. Format: `yourname_dbt_demo` (e.g. `jsmith_dbt_demo`)

**5d. Snowflake role**
> What Snowflake role should be used?
> (e.g. `ANALYTICS_DEV_ROLE`)

**5e. Iglu registry URL**
> What is the Snowplow Iglu registry URL for this project?
> (Ask your team lead — e.g. `https://your-org.iglu.snplow.net/api`)

**5f. Schema vendor and prefix**
> Choose a schema vendor and prefix for schemas you publish to BDP Console.
> These should be unique to you to avoid naming conflicts.
>
> - Vendor: e.g. `com.snowplow.jsmith` (reverse-domain format)
> - Prefix: e.g. `jsmith_test_` (used as filename and schema name prefix)

Write all values into `demo-gen/config.env`.

If `CONFIG_EXISTS`:
> Found existing config.env. Checking for required values...

```bash
cd demo-gen && source config.env 2>/dev/null
for var in SNOWFLAKE_DATABASE SNOWFLAKE_WAREHOUSE SNOWFLAKE_SCHEMA SNOWFLAKE_ROLE SNOWPLOW_IGLU_REGISTRY_URL SCHEMA_VENDOR SCHEMA_PREFIX; do
  [[ -z "${!var}" ]] && echo "MISSING $var" || echo "OK $var"
done
```

For any MISSING var, ask and write it in before continuing.

---

## Step 6 — Verify Snowflake connection

```bash
cd demo-gen && source .venv/bin/activate && python -c "
from dotenv import load_dotenv; load_dotenv(); load_dotenv('config.env')
from tools.snowflake import execute_query
result = execute_query('SELECT CURRENT_USER() as u, CURRENT_ROLE() as r, CURRENT_WAREHOUSE() as w')
row = result['rows'][0] if result.get('rows') else {}
print(f'Connected as {row.get(\"u\")} / {row.get(\"r\")} / {row.get(\"w\")}')
" 2>&1
```

If it succeeds: `> Snowflake connection verified.`

If it fails:
> Snowflake connection failed. Common causes:
> - Wrong account identifier format (should be `orgname-accountname`, not a URL)
> - PAT token expired or copied incorrectly
> - User doesn't have access to the specified role/warehouse
>
> Check your .env values and try again. Run `/onboarding` to restart from where you left off.

Do not continue until Snowflake connects successfully.

---

## Step 7 — Authenticate snowplow-cli

```bash
snowplow-cli data-structures list 2>&1 | head -3
```

If output contains an auth error or "unauthorized":
> snowplow-cli needs to be authenticated. You'll need a BDP Console API key.
>
> To get one: BDP Console → Settings → API Keys → Create Key (read/write access to Data Structures).
>
> Once you have it, run:
> ```
> snowplow-cli configure
> ```
> And paste in your API key and org ID when prompted.
>
> Let me know when that's done and I'll verify the connection.

Wait for confirmation, then re-run the check. If still failing, surface the error.

If output succeeds (lists schemas or returns empty): `> snowplow-cli authenticated.`

Also check the Iglu API key is set in `.env`:

```bash
cd demo-gen && source .env 2>/dev/null
[[ -n "$SNOWPLOW_IGLU_API_KEY" ]] && echo "IGLU_KEY_OK" || echo "IGLU_KEY_MISSING"
```

If `IGLU_KEY_MISSING`:
> One more credential needed: the Iglu registry API key for publishing schemas.
> This is separate from the BDP Console API key.
>
> Ask your team lead for the `SNOWPLOW_IGLU_API_KEY` value — it's the write key for
> the shared Iglu registry. Add it to `demo-gen/.env`:
> ```
> SNOWPLOW_IGLU_API_KEY=<value>
> ```
>
> Let me know when it's added.

Wait for confirmation, re-check before continuing.

---

## Step 8 — Check MCP connections

> Almost done. The workflow uses Gmail and Slack to research prospects automatically.
> Let me check if those are connected.

Do a minimal Gmail search (query: `snowplow`, maxResults: 1):
- If results return: `PASS Gmail MCP connected`
- If auth error: surface it

Do a minimal Slack search (query: `snowplow`, limit: 1):
- If results return: `PASS Slack MCP connected`
- If auth error: surface it

If either MCP fails:
> MCP connections need to be added to Claude Code on this machine.
> These are set up through Claude Code settings — not in this repo.
>
> For Gmail:
> ```
> claude mcp add
> ```
> Select Gmail and follow the OAuth flow.
>
> For Slack:
> ```
> claude mcp add
> ```
> Select Slack and follow the OAuth flow.
>
> After adding both, start a fresh Claude Code session and run `/onboarding` again to verify.

If both pass: `> Gmail and Slack research connections verified.`

---

## Step 9 — Pull Snowplow Micro image

```bash
docker image inspect snowplow/snowplow-micro:latest > /dev/null 2>&1 \
  && echo "IMAGE_PRESENT" \
  || echo "IMAGE_MISSING"
```

If `IMAGE_MISSING`:
> Pulling Snowplow Micro Docker image (one-time download, ~200MB)...
```bash
docker pull snowplow/snowplow-micro:latest
```

If `IMAGE_PRESENT`: `> Snowplow Micro image ready.`

---

## Step 10 — Final verification

> Running full pre-demo-check to confirm everything is in order...

Run all checks from the pre-demo-check skill (Snowflake, Docker, Micro image, snowplow-cli,
Node, npm, dbt, Gmail MCP, Slack MCP, output directory).

Print each result as it comes in. Summarize at the end.

If all pass:

> Setup complete. You're ready to run your first demo.
>
> **Quick start:**
> 1. Run `/demo-workflow` and enter a prospect company name
> 2. Confirm the research summary
> 3. Interact with the generated site at http://localhost:3000
> 4. Say "done" — data modeling runs automatically
>
> **Before each demo:** run `/pre-demo-check` to catch any issues early.
> **After each demo:** run `/clean-demo` to reset for the next prospect.

If anything still fails: surface the specific fix and offer to walk through it.
