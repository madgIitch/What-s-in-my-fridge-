# sprint-1-supabase-platform-foundation · undefined — Tareas

Checklist de implementación. El agente marca [x] al completar; los gates verifican.

- [ ] (T1) Una base vacía alcanza el schema esperado ejecutando únicamente migraciones versionadas.  ↔ R1
- [x] (T2) El cliente de navegador solo utiliza URL y publishable key; el cliente privilegiado solo existe en módulos server-only.  ↔ R2
- [x] (T3) Una ruta privada de prueba valida sesión server-side y redirige a `/login` cuando no existe usuario.  ↔ R3
- [x] (T4) Dos usuarios de test no pueden SELECT/INSERT/UPDATE/DELETE filas del otro en ninguna tabla privada creada en el sprint.  ↔ R4
- [x] (T5) Un usuario no puede leer ni sobrescribir objetos de otro usuario en Storage; los paths comienzan por su UUID.  ↔ R5
- [x] (T6) La service/secret key no aparece en HTML, bundles, source maps, logs o respuestas.  ↔ R6
- [x] (T7) Los tipos generados forman parte del build y `pnpm typecheck` falla si sus consumidores divergen del schema.  ↔ R7
- [ ] (T8) `supabase db lint` y el test RLS/Storage terminan con código 0 contra Supabase local.  ↔ R8
- [x] (T9) Local, preview/staging y production usan proyectos/secretos separados y la documentación prohíbe reutilizar service roles.  ↔ R9
- [ ] Tests que cubran los criterios de aceptación
