# Stripe reconciliation

La migración conserva Stripe como autoridad y no copia secretos a archivos. Para cada customer histórico, el operador invoca `POST /api/stripe/reconcile` con `Authorization: Bearer $STRIPE_RECONCILE_SECRET`. El endpoint resuelve metadata Supabase o el mapping Firebase inequívoco y es idempotente.

Antes del cutover, comprobar cardinalidades de customers, mappings ambiguos, anomalías de múltiples subscriptions y comparar entitlements. El rollback es exclusivamente de deployment: las tablas y ledgers aditivos permanecen legibles.
