# R4 · comparación visual y funcional

8 de octubre de 2026. Capturas de localhost, cuentas y fixtures sintéticos en
Supabase local. Las vistas usan respuestas reales de API/DB.

## Referencia 09

Se conserva el recorrido Cocinando → ¿Lo has cocinado?, fondo rosa, superficies
crema, texto ciruela, pasos numerados y acción coral. La preview distingue
16→12, Queda poco y Sin cambios; la incertidumbre no se representa como una
cantidad inventada. Ajustar cantidades tiene menor jerarquía que confirmar.

Las recetas provisionales añaden el aviso y acknowledgment que exige el spec.
No se inventan fotografías, duración ni datos de preparación. Las unidades
canónicas de API se traducen a unidades/paquetes en el texto principal.

| Vista | 320 px | 393 px |
| --- | --- | --- |
| Pasos e ingredientes | [Cocinando](r4-session-320.png) | [Cocinando](r4-session-393.png) |
| Confirmación y preview | [Confirmar](r4-preview-320.png) | [Confirmar](r4-preview-393.png) |
| Resultado y deshacer | — | [Aplicado](r4-applied-393.png) |

No hay overflow horizontal en 320/393; botones tienen objetivos de al menos
44 px. Se comprueban foco al entrar en confirmación, progreso tras recarga y
movimiento reducido. La barra inferior fija y el indicador de Next pertenecen
al viewport de desarrollo, no a una composición final de producción.

## Recorridos y límites

Playwright verifica catálogo, import y favorito inmutable; progreso/recarga;
consumo exacto y cualitativo; unknown sin resta automática; ajuste manual;
respuesta perdida con replay; conflicto de despensa y reconfirmación; offline
pending/reconexión/plan caducado; undo, expiración/conflicto; aislamiento entre
cuentas, limpieza al cerrar sesión en Ajustes y rollback con flag false.

Los fixtures de navegador permanecen solo en local. Los fixtures SQL hacen
rollback y la prueba de concurrencia limpia únicamente sus UUIDs. No hay reset,
SQL remoto, push ni despliegue. Estas pruebas no acreditan extracción ni
Whisper/GCS reales. El benchmark humano de calidad, veinte ejecuciones warm,
WebKit/Firefox y smoke de proveedores pendientes de R3 siguen como gates de
activación general.
