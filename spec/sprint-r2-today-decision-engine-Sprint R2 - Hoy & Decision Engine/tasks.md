# Sprint R2 — Checklist propuesto (sin aprobar)

- [ ] T1 / R1: Con PRODUCT_V3=true, abrir /app autenticado calcula Hoy automáticamente, sin pulsar Actualizar sugerencias. Con flag ausente/false se conserva v2; las API v3 devuelven 404 y las cuotas legacy no se alteran.

- [ ] T2 / R2: Hoy devuelve y muestra como máximo tres opciones principales y tres secundarias distintas. A393x852 se ve encabezado, primera propuesta y su CTA antes de cualquier bloque secundario. A320 no hay overflow; controles>=44px, teclado/foco y reduced-motion verificables.

- [ ] T3 / R3: El universo R2 contiene recetas del catálogo activo con ingredientes e instrucciones no vacíos. Favoritos propios influyen si su recipe_id pertenece a ese catálogo. Snapshots privados/importados no se exponen ni se convierten en catálogo global; su integración corresponde a R3.

- [ ] T4 / R4: Resolver ingrediente por food_concept_id explícito o alias/nombre exacto único usando normalización caso/acentos/espacios de R1; colisiones quedan unknown. No fuzzy/substring/LLM ni normalización que escriba en inventario. Pantry proposed/unknown y precision legacy no se elevan a confirmed/exact.

- [ ] T5 / R5: Items eliminados, estado empty/absent o exact quantity=0 no aportan presencia ni frescura. Pantry con concepto confirmado y presencia positiva sirve aunque no tenga cantidad exacta; pantry ambiguo no justifica Tienes todo.

- [ ] T6 / R6: Agrupar líneas de receta por concepto; sumar cantidades positivas inequívocas de unidades compatibles antes de evaluar y sumar cada item disponible una sola vez. Unidad exacta en g/kg o ml/l permite conversión; unit y pack solo misma unidad. No asumir contenido de packs, densidad ni equivalencia de alimento. Measure textual ambiguo o ausente queda cantidad por comprobar.

- [ ] T7 / R7: have_enough exige requerimiento y stock exactos compatibles y stock>=total requerido. Presencia cualitativa o cantidad requerida no verificable produce have_presence_unknown_amount; exact insuficiente compatible es missing; unidad incompatible es unknown, sin afirmar suficiencia ni faltante numérico.

- [ ] T8 / R8: Sin concepto inequívoco, el ingrediente queda unknown y se lista por su nombre de receta con copy Por comprobar. Ausencia de un concepto identificado en pantry utilizable es missing. No ignorar ingredientes básicos, opcionales no estructurados ni sustituirlos.

- [ ] T9 / R9: Estado ready solo si todos los grupos son have_enough; quantity_to_check si no hay missing/unknown y algún grupo tiene presencia sin cantidad. missing_one/missing_many dependen de conceptos missing distintos; unknown sin missing tiene su propio estado. Si hay missing y unknown simultáneos, se muestran ambos conteos por separado.

- [ ] T10 / R10: Cards ready muestran Tienes todo; quantity_to_check muestra Tienes los ingredientes y Cantidad por comprobar. Missing muestra Te falta1/Te faltanN deduplicados y Por comprobarN cuando proceda. Unknown usa Hay ingredientes por comprobar. No porcentajes, scores ni confidence numéricos en UI o respuesta v3.

- [ ] T11 / R11: Orden determinista: ready, quantity_to_check, missing_one, missing_many (missingCount ascendente), unknown; dentro grupo unknownCount ascendente, frescura verificada antes de estimada antes de ninguna, favorito antes de no favorito y recipeId ASCII ascendente. R2 no usa recencia ni preferencias no persistidas. La versión recommendation cambia respecto al ranking inicial R0 si cambia su contrato.

- [ ] T12 / R12: Frescura verificada: expiry_date_exact con source package/user/retailer y fecha civil entre hoy y hoy+2 inclusive. Puede decir Gasta primeroX; fechas pasadas nunca generan consejo de uso urgente y muestran Comprueba su estado si se mencionan. No inferir seguridad alimentaria.

- [ ] T13 / R13: Frescura estimada: acquired_on válido + ventana documentada cuyo final está entre hoy y hoy+2 inclusive; solo señal débil y copy Buena opción para aprovecharX · conservación estimada. No Caduca/Gasta primero. Sin fecha, ventana pasada, source desconocido o expiry legacy no hay señal. No usar score de confianza inventado.

- [ ] T14 / R14: También podrías aprovechar aparece únicamente con señal útil de frescura, excluye las principales y no ofrece recetas unknown. Si no hay candidatos adecuados desaparece. Razones retornadas se limitan a códigos semánticos documentados con alimentos públicos del concepto.

- [ ] T15 / R15: Selección acotada y reproducible: hasta200 recetas con mayor número de conceptos de pantry coincidentes, desempate recipeId ASCII; integrar hasta50 favoritos propios del catálogo y completar hasta50 recetas iniciales del catálogo si no hay coincidencias. Deduplicar, max250. El ranking evalúa ingredientes completos del conjunto; no promete óptimo global del catálogo ni consulta N+1 por receta.

- [ ] T16 / R16: GET /api/recommendations/today admite únicamente date civil válida opcional (fallback fecha civilEurope/Madrid del servidor). Respuesta200 {contract:today-v2,date,generatedAt,state:ready|empty_pantry|unresolved_pantry|no_candidates,main,secondary,snapshotKey,catalogVersion,matcherVersion,recommendationVersion}; main/secondary incluyen recipeId,name,availability,missingCount,unknownCount,quantityToCheck,missingIngredients,unknownIngredients,reasons. Sin aceptar userId/plan/inventario ni devolver private raw.

- [ ] T17 / R17: GET errores:401 AUTH_REQUIRED,400 INVALID_REQUEST,409 CATALOG_NOT_READY,503 TODAY_UNAVAILABLE retryable. Sin catálogo activo no responder vacío como si fuera despensa vacía. HTTP private,no-store; respuesta visible distingue carga/error/catálogo/sinresultados con Reintentar.

- [ ] T18 / R18: Cache privada por usuario con TTL<=60min y clave que cubre pantry relevante, conceptos/aliases, catálogo, favoritos, fecha civil y matcher/recommendationVersion. Mismos inputs mismo ranking; cantidad/estado/tombstone/normalización/frescura/favorito/catálogo/día invalida. Leer resultado recomprueba sesión; usuario distinto no reutiliza cache. snapshotKey no sustituye ownership.

- [ ] T19 / R19: Hoy nunca ejecuta consume_usage(recipe_suggestions), begin_recipe_suggestion ni crea/incrementa usage. Free con cuota legacy ya agotada recibe recomendaciones tras al menos seis cambios de pantry y reaperturas; contadores y OCR/import/billing permanecen intactos.

- [ ] T20 / R20: Cocinar esto en ready o quantity_to_check abre /app/recipes/[id] existente; quantity_to_check conserva aviso antes de navegar. No descuenta stock ni registra comida. Unknown ofrece Revisar receta/Despensa. Modo cocina guiado queda R4.

- [ ] T21 / R21: Añadir a la compra en recetas con missing presenta los faltantes actuales y pide confirmación explícita. POST /api/recommendations/shopping recibe solo {recipeId,snapshotKey,clientMutationId}; servidor recalcula bajo sesión y catálogo, rechaza snapshot distinto con409 SNAPSHOT_CONFLICT y devuelve {status:applied,itemIds}. No acepta nombres/cantidades del cliente.

- [ ] T22 / R22: Compra escribe todos los conceptos faltantes de una receta en una sola transacción con IDs/clave idempotentes. Replay idéntico devuelve mismos IDs; mismo clientMutationId con otra receta/snapshot=409 MUTATION_CONFLICT. Exact insuficiente guarda déficit real en unidad canónica; falta sin cantidad exacta guarda quantity/unit null. Unknown nunca se añade automáticamente. Error/red perdida no muestra éxito ni deja escritura parcial; reintento mantiene mutationId.

- [ ] T23 / R23: Tras compra aplicada se muestran confirmación y enlace /app/shopping-list. Repetir mismo envío no duplica filas. Un nuevo gesto confirmado tiene nueva mutationId (no implica agregación automática entre compras); lista/procedencia avanzada quedan R5.

- [ ] T24 / R24: Despensa sin items activos muestra Aún no sabemos qué tienes con Añadir compra a /app/add-purchase y Trae una receta que te guste a /app/recipes/import en un toque. Items existentes sin conceptos utilizables muestran Revisa tu despensa con acceso real; no se inventan tres ejemplos como recomendaciones propias.

- [ ] T25 / R25: Onboarding se muestra solo con cero items activos y estado no visto para usuario/dispositivo; se puede saltar y queda marcado visto al saltar o elegir entrada. Escanear ticket abre /app/scan; escribir abre /app/add-purchase; Ver ejemplo abre demostración claramente marcada y aislada sin escribir pantry/cache/compra. Cuentas migradas con items no reciben onboarding; cambio de cuenta no comparte estado.

- [ ] T26 / R26: Offline no genera ranking nuevo ni permite compra. Un Hoy previamente cargado en la misma sesión puede mantenerse marcado Resultado anterior · Sin conexión y sin CTA de escritura; una recarga no soportada usa fallback PWA existente sin prometer Hoy offline completo. Al reconectar o volver desde cambio de pantry se solicita snapshot nuevo; outbox pendiente evita presentar ranking remoto como datos locales ya guardados.

- [ ] T27 / R27: TTMD: inicio al entrar Hoy, fin una sola vez al mostrar primera propuesta accionable o salida empty/unresolved/no_candidates; error no emite éxito. Eventos CustomEvent neverita:today-metric {eventId,sessionId,phase:opened|decision_visible,outcome?,timestamp,durationMs?}, IDs efímeros sin persistencia ni PII; duración monotónica no negativa y StrictMode/retry no duplica fin. R2 instrumenta, no incorpora backend analytics nuevo.

- [ ] T28 / R28: Pruebas unit/domain cubren alias ambiguo, deduplicación/suma, unidades, empty/tombstone/legacy, unknown frente a missing, orden estable permutando input, frescura exacta/estimada/pasada y cambios de cache. SQL prueba dos usuarios, privilegios, transacción/replay y contadores sin cambios. E2E cubre los estados principales, CTA real/compra, onboarding, errores/retry, offline, Freeagotado, flagfalse y TTMD sin PII.

- [ ] T29 / R29: Capturas reales localhost320/393 con DB sintética aislada documentan comparación con06/10: encabezado, decisiones/razones/CTA, incertidumbre, empty y onboarding. No snapshots de maqueta como evidencia. Pasan gates harness, build, domain typecheck/tests, dblint y pgTAP. Ningún reset DB, producción, cambios destructivos ni implementación R3-R8.

- [ ] T30 / R30: Parser de cantidades de receta R2 limitado a un número positivo entero o decimal (coma/punto) seguido de g, kg, ml, l, unidad/unidades/unit o pack/packs; normalizar a g/ml/unit/pack. Fracciones, rangos, al gusto, envases con contenido y unidades no admitidas quedan por comprobar. Dentro de un concepto, requerimientos exactos de dimensiones distintas producen unknown; exactos más línea de cantidad desconocida nunca producen have_enough. Si hay una línea de cantidad desconocida y presencia positiva, el grupo permanece have_presence_unknown_amount sin afirmar un déficit numérico total; la ausencia de presencia sí sigue siendo missing.

- [ ] T31 / R31: La compra valida snapshot actual dentro de la transacción, incluyendo cambios concurrentes de pantry/catálogo, sin escribir parcialmente. Un replay ya aplicado se resuelve antes de comprobar el snapshot nuevo y devuelve los IDs originales incluso si cambió pantry después. snapshotKey referencia exclusivamente el resultado propio autorizado; no se acepta un snapshot de otra cuenta. 400 INVALID_REQUEST,401 AUTH_REQUIRED,404 RECIPE_NOT_FOUND,409 SNAPSHOT_CONFLICT|MUTATION_CONFLICT y503 SHOPPING_UNAVAILABLE distinguen los errores.

- [ ] T32 / R32: La selección consulta índices/conteos en DB y carga ingredientes completos solo de los candidatos acotados; no descarga las decenas de miles de recetas para filtrar en servidor/navegador. Orden y cardinalidad son comprobables con fixtures y benchmark local reproducible; registrar tiempos y tamaño del dataset sin convertir el benchmark en promesa de rendimiento de producción.
