# R2 · Hoy — dirección de interfaz

## Tesis visual

Una hoja de decisión cálida y serena: fondo rosa papel, tipografía ciruela y una sola acción coral; la incertidumbre se expresa en ámbar y texto explícito, nunca mediante porcentajes ni puntuaciones.

La composición toma de las referencias 06 y 10 el encabezado breve, la primera propuesta visible y el onboarding de tres entradas, pero conserva los tokens y la navegación ya aprobados en R0/R1. Es una superficie operativa, no una landing: la jerarquía sirve para decidir qué cocinar y qué revisar.

## Plan de contenido

1. **Orientación:** fecha civil y `¿Qué cenamos?`, con una explicación de una línea.
2. **Decisión principal:** hasta tres recetas; la primera propuesta y su CTA deben quedar antes de cualquier bloque secundario a 393 × 852.
3. **Contexto:** estado verificable (`Tienes todo`, `Cantidad por comprobar`, faltantes o ingredientes por comprobar) y una razón de frescura solo cuando existe evidencia.
4. **Alternativas:** `También podrías aprovechar` aparece únicamente con frescura útil, sin repetir propuestas principales ni incluir resultados `unknown`.
5. **Recuperación:** estados diferenciados para despensa vacía, conceptos sin resolver, catálogo ausente, sin candidatos, error y desconexión.
6. **Onboarding vacío:** ticket, escritura manual y ejemplo aislado. Saltar o elegir una entrada marca el dispositivo para esa cuenta sin escribir despensa, caché ni compra desde el ejemplo.

## Plan de interacción

- Entrada única y corta del contenido; se elimina bajo `prefers-reduced-motion`.
- Elevación/traslación mínima de CTA y propuestas al foco o puntero para reforzar la acción sin animación ornamental.
- Confirmación de compra en una hoja compacta: muestra los faltantes recalculables, exige un gesto explícito y conserva el mismo `clientMutationId` en error/reintento. Un nuevo gesto confirmado crea uno nuevo.

## Reglas de fidelidad y accesibilidad

- Objetivos táctiles de al menos 44 px y foco visible por teclado.
- Sin overflow horizontal a 320 px; a 393 × 852 el encabezado, la primera propuesta y su CTA preceden a alternativas secundarias.
- No se usan fotos o ilustraciones nuevas: las referencias contienen arte conceptual, pero R2 no dispone de un asset de receta aprobado y no debe fabricar uno. La jerarquía se sostiene con tipografía, espacio y estados semánticos.
- El modo offline puede conservar solo un resultado de la misma sesión, rotulado como anterior, y elimina acciones de escritura.
- La demostración está rotulada y vive únicamente en memoria de UI; no representa datos propios.

