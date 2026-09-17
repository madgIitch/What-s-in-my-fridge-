# Convenciones

- Metodología: SDD (una feature a la vez, spec aprobado antes de implementar).
- Sin ramas por feature: el harness trabaja en la rama actual y commitea cada feature ahí (`feat(<name>): <título>`). Para aislar una corrida entera, usa un `git worktree`.
- Una feature `sdd:true` queda en `review_pending` tras implementar; revisas el diff y la cierras con `spec.mjs done` (o `git revert` para descartarla).
- Tests obligatorios para cerrar una feature.

## Estilo de código

Lenguaje/framework principal: TypeScript estricto; React Native/Expo en legacy y Next.js App Router en `apps/web`.

Gestor de paquetes: pnpm para la PWA; npm permanece en el cliente legado hasta su migración.

Comandos locales:

- Instalar: `cd apps/web && corepack pnpm install --frozen-lockfile`
- Lint: `cd apps/web && corepack pnpm lint`
- Typecheck/build: `cd apps/web && corepack pnpm typecheck && corepack pnpm build`
- Test: `cd apps/web && corepack pnpm test`; E2E: `corepack pnpm test:e2e`
- Dev server: `cd apps/web && corepack pnpm dev`

Estructura relevante:

- `apps/web`: PWA y endpoints interactivos futuros.
- `packages/domain`: contratos compartidos sin dependencias de framework.
- `scripts/migration`: tooling de migración y reconciliación.
- `src` y `whats-in-my-fridge-backend`: cliente y backend legacy, preservados durante la migración.

Reglas de diseño/API:

- Server Components por defecto; añadir `use client` únicamente cuando se requiera interacción o APIs del navegador.
- No importar React Native, Expo, Firebase RN o WatermelonDB desde `apps/web`.
- Las variables `NEXT_PUBLIC_` son públicas por definición y nunca contienen secretos.

Reglas de tests:

- Cada vertical incluye unit tests y, para recorridos críticos, Playwright mobile-first.
- Los adaptadores externos deben poder sustituirse por mocks.

Reglas de despliegue:

- Vercel Preview debe construir sin credenciales de producción.
- Producción requiere gates verdes y cutover aprobado; Sprint 0 no modifica despliegues legacy.
