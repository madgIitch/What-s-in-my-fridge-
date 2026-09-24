# Migration tooling

Sprint 12 migration tooling is under `data/`. The first increment captures a read-only Firestore snapshot and validates its manifest. Import and reconciliation are still in progress. No migration credentials or exported user data are committed.

Install `firebase-admin` with `npm install --prefix scripts/migration/data` before capture. Provide Google Application Default Credentials through `GOOGLE_APPLICATION_CREDENTIALS` using an account whose IAM permissions allow reads only. The runner never calls Firebase writes, but Google credentials themselves must be restricted separately.

Capture requires an absolute snapshot path **outside this repository**:

```powershell
node scripts/migration/data/run.mjs capture --environment staging --source-project what-s-in-my-fridge-a2a07 --snapshot C:\secure\fridge-s12-snapshot --confirm-source-read READ_FIRESTORE_LEGACY
node scripts/migration/data/run.mjs plan --environment staging --snapshot C:\secure\fridge-s12-snapshot
```

Do not use this first increment to declare a migration complete. The manifest marks overall coverage `partial` because no export exists for WatermelonDB-only data.
