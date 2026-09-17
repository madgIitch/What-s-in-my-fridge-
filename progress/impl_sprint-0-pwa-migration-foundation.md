# Implementación · Sprint 0

## Resultado

- Shell mobile-first Next.js 16 en `apps/web`, instalable mediante manifest y sin acceso a servicios de producción.
- Frontera automática que impide imports de React Native, Expo, Firebase RN y WatermelonDB.
- CI de web con instalación reproducible, typecheck, lint, tests y build.
- Base `packages/domain`, placeholder de migración y configuración de entornos sin secretos públicos.
- Documentación durable de arquitectura, convenciones, ADR, mapa de pantallas y rollback.

## Verificación

- `corepack pnpm typecheck`: OK
- `corepack pnpm lint`: OK
- `corepack pnpm test`: 1 test OK
- `corepack pnpm test:e2e`: 1 smoke mobile Chromium OK
- `corepack pnpm check:boundaries`: OK
- `corepack pnpm check:env`: OK
- `corepack pnpm build`: OK; rutas `/`, `/_not-found` y `/manifest.webmanifest` estáticas
- Browser móvil: contenido presente, sin error overlay y sin overflow horizontal

## Condición externa preservada

Antes de comenzar, Git mostraba el cliente legacy completo borrado en el índice y presente de nuevo como archivos no rastreados. La implementación no restauró, añadió ni descartó ese estado del usuario. Por esa razón el `diff-scope` global no puede distinguir los cambios preexistentes de este sprint.

El runner global del harness también conserva comandos legacy (`npx tsc`, `npx eslint`, `npm test`) en la raíz. Su primera barrera falla porque el paquete raíz no tiene instalado el binario `tsc`; no se cambió esa configuración porque `.harness/gates.config.json` queda fuera del scope aprobado. Los comandos equivalentes y ampliados de `apps/web` sí pasan, tal como exige R6.
