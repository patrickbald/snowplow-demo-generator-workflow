# Demo Gen — Future Improvements & Blockers

## Current Blockers

### Snowflake MFA / TOTP Authentication
**Status:** Blocking data agent (`run-data` step)

**Problem:** The data agent connects to Snowflake programmatically using username + password from `.env`. Accounts with MFA enforced (TOTP via Google Authenticator) reject automated connections — the 6-digit code can't be passed interactively during a script run.

**What was tried:** `authenticator=username_password_mfa` — works for Duo push notifications but not TOTP.

**Fix for v2:** Add keypair (RSA) auth support to `tools/snowflake.py`.
- Check for `SNOWFLAKE_PRIVATE_KEY_PATH` in `.env`; if present, use private key auth instead of password
- One-time setup: generate key pair, register public key in Snowflake with `ALTER USER ... SET RSA_PUBLIC_KEY`
- Fully headless — no MFA challenge

Setup commands:
```bash
openssl genrsa 2048 | openssl pkcs8 -topk8 -inform PEM -out ~/.ssh/snowflake_rsa_key.p8 -nocrypt
openssl rsa -in ~/.ssh/snowflake_rsa_key.p8 -pubout -out ~/.ssh/snowflake_rsa_key.pub
grep -v "PUBLIC KEY" ~/.ssh/snowflake_rsa_key.pub | tr -d '\n'
```

```sql
ALTER USER "patrick.bald@snowplowanalytics.com" SET RSA_PUBLIC_KEY='<paste public key>';
```

Add to `.env`:
```
SNOWFLAKE_PRIVATE_KEY_PATH=~/.ssh/snowflake_rsa_key.p8
```

Code change needed in `tools/snowflake.py` `get_connection()`:
```python
private_key_path = os.environ.get("SNOWFLAKE_PRIVATE_KEY_PATH")
if private_key_path:
    from cryptography.hazmat.primitives.serialization import load_pem_private_key, Encoding, PrivateFormat, NoEncryption
    with open(os.path.expanduser(private_key_path), "rb") as f:
        pkb = load_pem_private_key(f.read(), password=None).private_bytes(
            encoding=Encoding.DER,
            format=PrivateFormat.PKCS8,
            encryption_algorithm=NoEncryption()
        )
    return snowflake.connector.connect(..., private_key=pkb)
else:
    return snowflake.connector.connect(..., password=os.environ["SNOWFLAKE_PASSWORD"])
```

---

## V2 Improvements

### Iglu / Micro
- Iglu registry URL is hardcoded in `env_agent.txt` as `https://com-snplow-eng-aws-dev.iglu.snplow.net/api` — should be moved to `.env` as `SNOWPLOW_IGLU_REGISTRY_URL` for portability across orgs and environments

### Schema Agent
- `schemas-ready.json` now includes full property types and enums — consider also surfacing `minLength` / `minimum` / `maximum` constraints for high-maturity schemas so the env agent can generate tighter type definitions in the site

### Env Agent
- Step 10b fires a test event per schema via curl and loops until `/micro/bad` is empty — could be extended to also validate that all required fields are present, not just enum values
- Consider auto-opening the browser to each page that triggers a custom event so the smoke test is more comprehensive

### Data Agent
- `--confirmed` flag bypasses per-step confirmation prompts — the skill workflow should always pass this after the user approves the upfront context summary
- Amplification factor (currently hardcoded at 9) could be made configurable via `context.json` or a CLI flag
- dbt output schema is now `<SNOWFLAKE_SCHEMA>_derived` (derived from `.env`) — consistent with source schema naming
