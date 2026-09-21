# Cloud Tasks identity

`neverita-tasks@what-s-in-my-fridge-a2a07.iam.gserviceaccount.com` is the only queue identity granted `roles/run.invoker` on `neverita-media-worker`. The service has no unauthenticated invoker binding. Tasks use an OIDC token whose audience is the exact worker URL and their base64 body decodes to exactly `{"jobId":"<uuid>"}`.

Vercel's queue principal receives only `cloudtasks.tasks.create` on `recipe-imports` and `iam.serviceAccounts.actAs` on `neverita-tasks`. Cloud Run validates Google's token before the container; the container additionally checks the forwarded audience, email and expiry claims.
