# Migration tooling

Sprint 12 migration tooling is under `data/`. The first increment captures a read-only Firestore snapshot and validates its manifest. Import and reconciliation are still in progress. No migration credentials or exported user data are committed.

Install `firebase-admin` with `npm install --prefix scripts/migration/data` before capture. Provide Google Application Default Credentials through `GOOGLE_APPLICATION_CREDENTIALS` using an account whose IAM permissions allow reads only. The runner never calls Firebase writes, but Google credentials themselves must be restricted separately.

Capture requires an absolute snapshot path **outside this repository**:

```powershell
node scripts/migration/data/run.mjs capture --environment staging --source-project what-s-in-my-fridge-a2a07 --snapshot C:\secure\fridge-s12-snapshot --confirm-source-read READ_FIRESTORE_LEGACY
node scripts/migration/data/run.mjs plan --environment staging --snapshot C:\secure\fridge-s12-snapshot
node scripts/migration/data/run.mjs dry-run --environment staging --snapshot C:\secure\fridge-s12-snapshot --auth-map C:\secure\firebase-uid-to-supabase-uuid.json
```

The auth map is a JSON object keyed by Firebase UID with Supabase UUID values exported from the Sprint 3 `legacy_id_map` for `entity_type='auth_user'`. It must stay outside the repository. `dry-run` validates domain transformations and reports hashed paths and error codes for quarantine candidates; it never writes to Supabase. It currently marks `cookingPreferences`, `recipe_jobs`, `usage`, and `subscription` as `MAPPING_NOT_IMPLEMENTED` rather than silently dropping them.

`import` handles only inventory, drafts, saved recipes, and meals. It upserts on `(user_id,source,legacy_id)` and then writes `legacy_id_map`; a failed map write is retried on resume. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the shell, then use `--confirm-write IMPORT_FIREBASE_DATA_STAGING` for staging. The target guard accepts only project `bwscshjtwmsfscbjbndq` for staging or loopback HTTP for local. It writes a checkpoint beside the snapshot. A report with quarantined records returns exit code 2. **Do not use this increment to declare a migration complete or a staging rehearsal reconciled.** The manifest marks overall coverage `partial` because no export exists for WatermelonDB-only data.
