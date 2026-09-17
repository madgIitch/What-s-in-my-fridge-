# sprint-0-pwa-migration-foundation · undefined — Requisitos

- name: `Sprint 0 - PWA Migration Foundation` · priority: P0 · sdd: true
- aprobado por: peorr · 2026-09-17T21:51:14.205Z

## Contexto



## Requisitos funcionales

R1. apps/web arranca con `pnpm dev`, compila con `pnpm build` y no importa módulos React Native, Expo, Firebase RN ni WatermelonDB.
R2. package.json, tsconfig.json, app.json y manifests equivalentes necesarios para CI ya no son punteros LFS; recipes.json grande puede seguir en LFS hasta su importación.
R3. El diff no elimina pantallas, funciones Firebase ni datos legacy.
R4. Existe una matriz documentada de cada pantalla/feature actual y su sprint de migración.
R5. Las variables con SECRET, SERVICE_ROLE, STRIPE_SECRET, VISION, FIREBASE_PRIVATE o MIGRATION nunca usan NEXT_PUBLIC_.
R6. CI ejecuta typecheck, lint, tests y build de apps/web con código 0.
R7. Vercel Preview puede desplegar la shell sin acceder a Firebase ni Supabase de producción.
R8. docs/MIGRATION_ARCHITECTURE.md identifica commit legacy de referencia y procedimiento para comparar comportamiento.
R9. Existe un ADR aprobado que prohíbe procesamiento pesado de vídeo en Vercel y define Cloud Run como media worker.
R10. La matriz de entornos identifica qué variables pertenecen a navegador, Vercel, Supabase y Google Cloud sin duplicar secretos innecesariamente.

