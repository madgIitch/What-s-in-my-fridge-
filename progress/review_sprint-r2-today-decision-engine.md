# Revisión R2 · 2 de octubre de 2026

Estado: `review_pending`. Spec aprobado, 32 criterios implementados y checklist
actualizado. Sin cierre humano ni despliegue.

## Resultado

- Hoy automático tras sesión, ranking determinista sin cuota, máximo 3+3.
- Parser estricto y suma decimal; unidades compatibles y unknown conservador.
- Caché privada, TTL máximo 60 minutos e invalidación por inputs/versiones.
  La publicación privilegiada revalida el estado en DB y la sesión se recomprueba.
- Compra recalculada en transacción; snapshot ajeno/desactualizado rechazado.
  Replay aplicado precede a la validación del nuevo estado y devuelve mismos IDs.
- Onboarding para cuentas vacías, ejemplo aislado, offline y TTMD sin PII.
  Logout cancela las respuestas pendientes. Cuentas migradas requieren revisión.
- Flag false conserva InventoryApp y oculta API nuevas; fixes R1 preservados.

## Validación

| Comprobación | Resultado |
| --- | --- |
| Harness typecheck/lint/unit/diff-scope | PASS |
| Next production build | PASS |
| Domain typecheck y Vitest | PASS, 37 pruebas |
| Web Vitest | 172 PASS, incluidos StrictMode y sesión pendiente |
| Supabase db lint | Sin errores |
| pgTAP | 252 aserciones PASS |
| Playwright R2, true | 4 PASS; false omitido en esa ejecución |
| Playwright rollback, false | 1 PASS |
| Concurrencia local por bloqueo | 4 PASS |
| Benchmark 10.002 recetas / 10.001 ingredientes | 200 candidatos, 1.172,62 ms local |

Capturas reales 320/393 y comparación 06/10:
`docs/design/neverita-v3/qa/R2_COMPARISON.md`. Se comprobaron foco/teclado,
movimiento reducido, primer CTA visible, detalle real, cuotas legacy agotadas
tras seis cambios, compra, offline/reconexión y reintento de error.

## Límites y operación

La raíz de Turbopack se corrigió para incluir el motor compartido; ajuste acotado
en progress/r2-build-scope.md. Sin nuevas dependencias.

El bloqueo de tablas protege snapshots concurrentes, pero serializa la caché.
El hash incluye recetas dentro de DB; medir contención real antes de optimizar.
El benchmark local no es SLA de producción.

La autenticación local usa claves publishable/secret actuales y registro público
local para crear sesiones. El token administrativo HS256 es rechazado por GoTrue.
No se cambió la autenticación remota. Los fixtures del navegador permanecen
identificados con prefijos r2 locales; SQL revierte datos y restaura el catálogo.

Solo se aplicó 20261002000100_today_decision_engine.sql en local. No push,
deploy, SQL remoto, reset ni features futuras. Antes de desplegar se debe aplicar
la migración aditiva al entorno destino mediante su flujo autorizado.
El smoke real de R1 continúa pendiente.

## Cierre · 8 de octubre de 2026

Spec marcado done por petición explícita del usuario. Los resultados anteriores se conservan; no se aporta evidencia adicional de smoke humano. El hotfix remoto del 2 de octubre figura en progress/current.md y sustituye el estado operativo inicial de este review.
