---
name: clean-demo
description: Reset the demo environment for a fresh run. Stops Snowplow Micro and the Next.js dev server, removes all generated output files, and optionally clears Snowflake data. Use when asked to "clean the demo", "reset the demo", "start fresh", or "clear the demo environment".
---

# Clean Demo Environment

Reset everything so `/demo-workflow` can be run fresh for a new prospect.

---

## Step 1 — Stop running services

```bash
# Stop Snowplow Micro
docker ps --filter publish=9090 -q | xargs docker stop 2>/dev/null && echo "Micro stopped" || echo "Micro was not running"

# Kill Next.js dev server
lsof -ti:3000 | xargs kill -9 2>/dev/null && echo "Dev server stopped" || echo "Dev server was not running"
```

---

## Step 2 — Remove generated output files

Run from the repo root (`dev-env-workflow/`):

```bash
cd .. && \
rm -f demo-gen/output/context.json \
      demo-gen/output/schemas-ready.json \
      demo-gen/output/site-manifest.json && \
rm -rf demo-gen/output/schemas/ \
       demo-gen/output/demo-web/ \
       demo-gen/output/dbt-project/ \
       demo-gen/output/existing-schemas/ && \
echo "Output files cleared" && \
ls demo-gen/output/
```

---

## Step 3 — Ask about Snowflake data

Read `SNOWFLAKE_DATABASE` and `SNOWFLAKE_SCHEMA` from `demo-gen/config.env`, then ask the user:

> Snowflake data (`<SNOWFLAKE_SCHEMA>.events` and `<SNOWFLAKE_SCHEMA>_derived.*`) is still in place.
> Should I clear that too?

If yes, run:

```bash
cd demo-gen && source .venv/bin/activate && python -c "
from tools.snowflake import execute_query
import os

db = os.environ['SNOWFLAKE_DATABASE']
schema = os.environ['SNOWFLAKE_SCHEMA']

execute_query(f'DROP SCHEMA IF EXISTS {db}.{schema} CASCADE')
execute_query(f'DROP SCHEMA IF EXISTS {db}.{schema}_derived CASCADE')
print(f'Dropped {db}.{schema} and {db}.{schema}_derived')
"
```

If no, skip this step.

---

## Step 4 — Remind about BDP Console

Print:

> Local environment reset complete.
>
> One manual step remaining: if you published custom schemas (`pb_test_*`) to BDP Console
> dev during this demo, delete them before the next run to avoid name conflicts.
>
> BDP Console → Data Structures → filter vendor `com.pbenvworkflow` → delete `pb_test_*` schemas.
>
> Ready to run `/demo-workflow` for a new prospect.
