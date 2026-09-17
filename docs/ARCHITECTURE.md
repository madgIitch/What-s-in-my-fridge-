# Arquitectura

> El agente lo lee antes de implementar. Mantén aquí el contexto que no cabe en una feature concreta.

## Visión general

Producto/proyecto: Neverita / What's In My Fridge, migración progresiva del cliente Expo a una PWA.

Usuarios principales: personas que gestionan inventario doméstico, recetas, compras y comidas desde el móvil.

Objetivo no negociable: preservar los contratos funcionales y los datos del producto durante una migración reversible.

## Componentes

- Cliente móvil legado (`App.tsx`, `src/`): producto React Native/Expo actual; permanece intacto hasta el cutover.
- PWA (`apps/web`): interfaz Next.js App Router mobile-first, desplegable en Vercel.
- Dominio (`packages/domain`): contratos TypeScript sin dependencias de UI o infraestructura.
- Backend legado (`whats-in-my-fridge-backend`): Firebase Functions y workers actuales; referencia funcional durante la migración.
- Migración (`scripts/migration`): importadores idempotentes y herramientas de reconciliación futuras.

## Flujo de datos

1. Durante Sprint 0 la PWA renderiza una shell estática y no conecta con producción.
2. Los siguientes verticales moverán estado de Firebase/WatermelonDB a Supabase e IndexedDB bajo specs independientes.
3. El procesamiento pesado se encolará desde Vercel y se ejecutará en Cloud Run.

## Integraciones externas

- Vercel: sirve Next.js y la lógica interactiva Node; nunca procesa vídeo pesado.
- Supabase: será fuente de verdad para Postgres, Auth, Storage y Realtime.
- Google Cloud: Vision para OCR y Cloud Tasks/Cloud Run para media e IA.
- Stripe: checkout, portal y webhooks; secretos solo en servidor.

## Restricciones conocidas

- No se elimina ni modifica destructivamente el stack legado antes de reconciliación y rollback aprobado.
- Ningún secreto usa prefijo `NEXT_PUBLIC_`.
- La shell web se puede compilar y previsualizar sin credenciales ni acceso a producción.

## Decisiones abiertas

- Cada decisión de datos, autenticación u offline se resolverá en su sprint aprobado; Sprint 0 no anticipa esos contratos.

<!-- Los specs aprobados se anexan debajo con marcadores harness:<id>. -->

<!-- harness:sprint-0-pwa-migration-foundation -->
## sprint-0-pwa-migration-foundation · Sprint 0 - PWA Migration Foundation



### Scope aprobado

  - `apps/web/**`
  - `packages/**`
  - `scripts/migration/**`
  - `.github/workflows/**`
  - `.gitattributes`
  - `.env.example`
  - `docs/**`
  - `spec.json`
