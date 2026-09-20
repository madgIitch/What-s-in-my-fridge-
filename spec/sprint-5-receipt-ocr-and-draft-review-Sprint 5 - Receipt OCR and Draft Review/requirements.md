# sprint-5-receipt-ocr-and-draft-review · undefined — Requisitos

- name: `Sprint 5 - Receipt OCR and Draft Review` · priority: P0 · sdd: true
- aprobado por: peorr · 2026-09-20T13:45:46.115Z

## Contexto



## Requisitos funcionales

R1. En navegadores compatibles, la UI permite captura con cámara y selección de archivo; si getUserMedia o capture no están disponibles o se deniegan, la selección de archivo sigue operativa sin bloquear el flujo.
R2. El servidor acepta únicamente JPEG, PNG o WebP decodificables cuyo MIME y firma binaria coincidan y cuyo tamaño no supere MAX_RECEIPT_IMAGE_BYTES; rechaza extensiones renombradas, contenido corrupto y exceso de tamaño antes de invocar Vision.
R3. Cada imagen se almacena en un bucket privado bajo una ruta derivada server-side que incluye auth.uid() y el draft_id; las políticas impiden a otro usuario leer, listar, firmar o borrar el objeto.
R4. El endpoint OCR exige una sesión válida, obtiene el owner desde auth.uid(), comprueba que draft y objeto pertenecen al mismo usuario y nunca acepta un user_id suministrado por el cliente como autoridad.
R5. El contrato versionado del parser produce merchant, purchaseDate, currency, total, items y unrecognizedLines; fixtures sintéticos equivalentes a todos los casos legacy verifican igualdad semántica y normalización determinista.
R6. Una respuesta vacía o sin líneas utilizables guarda un draft revisable sin items inventados y con el texto no reconocido disponible; repetir el mismo request_id para el mismo usuario y draft devuelve el resultado persistido sin una segunda llamada facturable ni consumo adicional de cuota.
R7. La cuota Free se reserva atómicamente en servidor por usuario y mes natural, con máximo de cinco solicitudes OCR facturables; dos solicitudes concurrentes no pueden superar el límite, y el entitlement Pro autoritativo omite la restricción.
R8. Los intentos rechazados antes de Vision, los retries idempotentes y las respuestas recuperadas desde caché no consumen cuota; se documenta explícitamente si un fallo facturable de Vision consume o libera la reserva.
R9. La revisión permite editar, aceptar o excluir cada línea reconocida antes de confirmar; la operación de confirmación inserta en una única transacción exactamente los inventory_items aceptados con sus valores editados y registra confirmed_at.
R10. Confirmar dos veces o enviar confirmaciones concurrentes para el mismo draft devuelve el resultado canónico de la primera operación y no crea filas adicionales de inventario.
R11. Tras confirmar, el draft queda inmutable para edición y nuevas confirmaciones; cualquier fallo transaccional deja tanto el draft como el inventario sin efectos parciales.
R12. Las credenciales de Vision y la service role solo se importan desde módulos server-only, no usan NEXT_PUBLIC_, no aparecen en artefactos cliente y se redactan junto con URLs firmadas, cabeceras y contenido OCR sensible en logs y errores.
R13. Las URLs firmadas son de alcance exclusivo al objeto autorizado, tienen TTL documentado y no se persisten en base de datos ni se incluyen en telemetría o bundles estáticos.
R14. Los cambios de base de datos son aditivos; no se modifica destructivamente el cliente Expo, Firebase ni el backend legacy, y un deployment web anterior puede ignorar las nuevas filas y columnas sin perder datos.
R15. Tests unitarios cubren parser, MIME por firma, OCR vacío e idempotencia; tests de base de datos/Storage con dos usuarios cubren RLS, listado, cuota concurrente y confirmación única; tests de integración usan un adaptador Vision mock sin red.
R16. Playwright en viewport móvil cubre selección de archivo, fallback sin cámara, crop, OCR mock, edición y exclusión de líneas, confirmación, doble submit, cuota agotada y error recuperable de Vision, verificando tanto la UI como las filas canónicas resultantes.
R17. `MAX_RECEIPT_IMAGE_BYTES` vale 10 MiB; se comprueba sobre los bytes recomprimidos que se enviarán y también en servidor.
R18. La UI vive en `/app/scan`. `POST /api/ocr` recibe multipart con `image`, `draftId`, `requestId` UUID y `locale`; responde `{draftId,requestId,status,draft}` o el error estable. `POST /api/ocr/confirm` recibe `{draftId,lines}` y responde `{draftId,status:"confirmed",itemIds}`; ambos rechazan campos de ownership del cliente.
R19. El parser `receipt-v1` usa campos nullable: draft `{merchant,purchaseDate,currency,total,items,unrecognizedLines}`; cada item `{lineId,rawText,name,quantity,unit,unitPrice,totalPrice,confidence,accepted}`. Fechas son `YYYY-MM-DD`, moneda ISO-4217 e importes strings decimales no negativos de dos posiciones como máximo. Nombre no vacío y cantidad positiva son obligatorios para confirmar una línea aceptada.
R20. El corpus legacy mínimo contiene fixtures sintéticos para supermercado español con coma decimal, ticket con punto decimal, descuentos, cantidad y precio unitario, fecha ambigua, moneda implícita, línea parcial, texto sin líneas utilizables y OCR vacío; igualdad semántica compara el JSON canónico `receipt-v1`.
R21. Una línea es utilizable si tiene nombre no vacío y al menos cantidad o precio reconocible. OCR vacío significa texto normalizado vacío; texto no vacío sin líneas utilizables se conserva íntegro en `unrecognizedLines`. Ninguno crea items automáticamente.
R22. `requestId` es un UUID generado por el cliente para un usuario y draft. Reutilizarlo con el mismo hash de imagen y locale devuelve el resultado persistido; reutilizarlo con otra imagen, locale o draft devuelve 409 `IDEMPOTENCY_MISMATCH` sin invocar Vision ni consumir cuota.
R23. El periodo mensual de cuota se calcula en UTC. Una vez invocado Vision, éxito o fallo confirma un único consumo; validación previa, replay y caché no consumen.
R24. La autoridad temporal de plan es `user_entitlements(user_id, plan, status)`, creada aditivamente en este sprint con defaults `free` y `active`; solo `plan='pro' AND status='active'` omite el límite. Toda ausencia o estado distinto se trata como Free.
R25. Las URLs firmadas de lectura expiran a los 60 segundos.
R26. El crop es obligatorio antes del primer upload, permite rotaciones de 90 grados y recorte rectangular dentro de la imagen; el resultado recomprimido sustituye el original para upload y cancelar no persiste draft, cuota ni objeto.
R27. En review se editan `name`, `quantity`, `unit`, `unitPrice`, `totalPrice` y `accepted`. Reglas: name trim no vacío y quantity positiva para aceptadas; importes no negativos; una excluida usa `accepted=false` y no genera item. La confirmación rechaza el payload completo si alguna aceptada es inválida.

## Restricciones

- **error_states:** Se establece un contrato de error estable con códigos HTTP, retryable y requestId; se distinguen fallos de validación, autorización, ownership, estado, cuota, respuesta OCR y disponibilidad de Vision. Los reintentos reutilizan request_id, no repiten consumo ni llamadas facturables, y la confirmación es atómica.
- **auth_secrets:** Las URLs firmadas se emiten exclusivamente en servidor tras validar sesión y ownership, quedan limitadas a lectura de un objeto durante 60 segundos y no se persisten. Se define una política explícita de redacción para credenciales, sesión, URLs, imágenes, OCR y datos personales.
- **rollback_compat:** Los cambios quedan limitados a extensiones SQL/Storage aditivas y rutas PWA nuevas, sin alterar contratos legacy. El rollback conserva drafts, cuotas e imágenes, evita down migrations destructivas y exige una política documentada de expiración que no elimine objetos todavía necesarios.

