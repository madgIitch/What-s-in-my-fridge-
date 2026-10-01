# R2: configuración necesaria para el motor compartido

Durante la verificación real, Turbopack no pudo resolver el motor aprobado de
`packages/domain` desde `apps/web`: la raíz anterior estaba limitada a la app.
Se añade exclusivamente `apps/web/next.config.ts` al alcance de implementación
para resolver la raíz del monorepo. Este ajuste soporta el requisito aprobado de
un motor de dominio compartido; no añade comportamiento ni amplía R2 a otra
feature. Requisitos y aprobación del spec permanecen iguales.
