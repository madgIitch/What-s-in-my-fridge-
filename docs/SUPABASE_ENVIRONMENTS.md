# Entornos Supabase

## GitHub Actions

El workflow `Web CI` valida web y reconstruye una base local aislada en cada PR/push. Ejecuta lint con warnings bloqueantes, pgTAP RLS/Storage y regeneración de tipos comparada con Git. Solo un push a `main` con ambos jobs verdes puede aplicar migraciones a staging `bwscshjtwmsfscbjbndq`. Los despliegues están serializados y no se cancelan durante una migración.

En GitHub, crear **Settings → Environments → staging** y limitar las ramas de deployment a `main`. Añadir estos environment secrets:

- `SUPABASE_ACCESS_TOKEN`: token de acceso de una cuenta autorizada para staging (no una service role).
- `SUPABASE_DB_PASSWORD`: contraseña PostgreSQL del proyecto staging.

No introducir secretos en archivos, logs ni mensajes de chat. Sin estos secretos el job falla explícitamente antes de enlazar/desplegar. Las PR no reciben credenciales remotas. Este workflow no despliega a producción; ese entorno requerirá su proyecto independiente y aprobación manual.

| Entorno | Proyecto | Configuración pública | Secretos |
|---|---|---|---|
| Local | Supabase CLI/Docker por desarrollador | salida de `supabase status` | claves locales efímeras |
| Preview/Staging | proyecto dedicado no productivo | Vercel Preview | Vercel Preview + secrets del proyecto staging |
| Production | proyecto exclusivo de producción | Vercel Production | Vercel Production + secrets del proyecto production |

No se copian service roles entre entornos. La publishable/anon key puede llegar al navegador y está protegida por RLS; `SUPABASE_SERVICE_ROLE_KEY` nunca usa `NEXT_PUBLIC_`, solo se importa desde módulos con `server-only` y no es necesaria para compilar o renderizar la shell pública.

## Flujo local reproducible

```powershell
supabase start
supabase db reset
cd apps/web
corepack pnpm types:supabase
corepack pnpm db:lint
corepack pnpm test:rls
```

`supabase db reset` reconstruye el esquema únicamente desde `supabase/migrations` y `seed.sql`. Las credenciales mostradas por `supabase status` se copian a un `.env.local` ignorado por Git.

## Preview y producción

Cada entorno se enlaza explícitamente con su propio project ref. Las migraciones se prueban primero en local, después en staging y solo se aplican a producción desde CI/CD aprobado. Ningún comando de desarrollo usa un project ref de producción por defecto.
