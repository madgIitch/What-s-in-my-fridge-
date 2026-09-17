# Arquitectura de migración

## Línea base y estrategia

La referencia funcional del cliente legado es el commit `6a50475006c692538e6e51d30a7063f956ad054c`. La migración sigue el patrón strangler: la PWA crece en `apps/web` mientras `App.tsx`, `src/` y `whats-in-my-fridge-backend/` continúan disponibles y no se modifican destructivamente.

Para comparar comportamiento, se crea un checkout o worktree limpio del commit de referencia, se ejecuta el recorrido equivalente con datos sintéticos y se contrasta con la PWA en Preview. Las diferencias se registran contra los criterios del sprint correspondiente. El rollback previo al cutover consiste en dirigir tráfico al deployment legacy y conservar Supabase sin borrados; el procedimiento de producción completo se aprobará en Sprint 15.

## Reparto de responsabilidades

| Plano | Responsabilidad | No hace |
|---|---|---|
| Navegador/PWA | UI mobile-first y, en sprints futuros, IndexedDB/outbox | No recibe secretos ni procesa media pesada |
| Vercel | Render web, auth/session y orquestación interactiva | No ejecuta ffmpeg, Whisper ni descargas largas |
| Supabase | Postgres/Auth/Storage/Realtime, fuente de verdad | No sustituye al worker multimedia |
| Google Cloud | Vision, Cloud Tasks, Cloud Run y GCS temporal opcional | No conserva el dato canónico de usuario |

Railway no forma parte de la versión 1.0.

## Matriz legacy → PWA

| Pantalla o capacidad legacy | Sprint de migración |
|---|---:|
| Login | 3 · Auth y migración de cuentas |
| Home | 4 · Inventario offline-first; acabado visual en 13 |
| Scan, Crop, ReviewDraft | 5 · OCR y revisión de borradores |
| RecipesPro, Detail | 6 · Catálogo y sugerencias |
| AddRecipeFromUrl, estado/notificación de jobs | 7 · Imports por URL |
| Favorites, RecipeSteps, ConsumeIngredients, ConsumeRecipeIngredients, ShoppingList | 8 · Favoritos, cocina y compra |
| Calendar, AddMeal, MealDetail | 9 · Calendario de comidas |
| Paywall y suscripción | 10 · Stripe Pro y usage |
| Push notifications e instalación PWA | 11 · Shell offline y push |
| Settings y preferencias | 3/13 · cuenta y paridad UI |
| AddItem | 4 · Inventario offline-first |
| Importación/reconciliación de datos Firebase | 12 · migración de datos |

## Matriz de entornos y variables

| Variable o grupo | Navegador | Vercel | Supabase | Google Cloud |
|---|:---:|:---:|:---:|:---:|
| `NEXT_PUBLIC_APP_URL` | ✓ | ✓ | — | — |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | ✓ | endpoint/key pública | — |
| `SUPABASE_SERVICE_ROLE_KEY` | — | ✓ | service role | — |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | — | ✓ | — | — |
| `GOOGLE_CLOUD_VISION_CREDENTIALS_JSON` | — | ✓ | — | IAM |
| `GCP_PROJECT_ID`, `GCP_REGION`, `CLOUD_TASKS_QUEUE` | — | ✓ | — | recurso/config |
| `CLOUD_RUN_WORKER_URL`, `CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL` | — | ✓ | — | endpoint/identidad |
| `GCS_TEMP_BUCKET` | — | ✓ | — | bucket temporal |
| `MIGRATION_*` | — | tooling aislado | destino | origen/credencial |

La shell de Sprint 0 no lee ninguna de estas variables en runtime y por ello Vercel Preview se construye sin conectarse a Firebase, Supabase o Google Cloud.
