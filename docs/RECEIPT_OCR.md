# Receipt OCR operational contract

Receipt images are validated and recompressed in the browser, then validated again by binary signature, declared MIME, dimensions and a 10 MiB limit on the server. Objects live in the private `receipt-images` bucket at `<auth.uid()>/<draft_id>/original.<ext>`. Read URLs, when an authorized server flow needs one, are scoped to that exact object, expire after 60 seconds and must never be persisted or logged.

Free usage is reserved atomically per user and UTC calendar month. Validation failures, cancelled crops, cache hits and idempotent replays do not consume usage. The reservation becomes one consumed unit immediately before Vision is invoked; both a successful call and a billable provider failure consume it. A retry reuses the persisted request and cannot invoke Vision or consume again.

Secrets, authorization/cookie headers, signed URL query strings, image bytes, complete OCR text and receipt PII are forbidden in logs and returned errors. Only request/draft identifiers, stable codes, durations, byte counts and aggregate line counts may be recorded. `GOOGLE_VISION_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-only and must never use `NEXT_PUBLIC_`.

Rollback is deployment-only: this sprint adds tables, columns, functions and a private bucket without deleting legacy data or changing Expo/Firebase. Drafts and images are retained while needed; lifecycle cleanup requires a later approved retention policy.
