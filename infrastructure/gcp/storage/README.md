# Temporary recipe media

The private `neverita-recipe-import-temp` bucket is only for direct uploads and optional retry spooling. Objects use `recipe-imports/<user-id>/<job-id>/...`; ordinary URL imports stream inside Cloud Run and never write to GCS. Apply `recipe-import-temp-lifecycle.json` and keep uniform bucket-level access enabled. Worker cleanup deletes the job prefix and treats 404 as success; lifecycle is the final safety net.
