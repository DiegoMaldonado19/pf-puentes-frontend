# 0043 — Constructor de formularios sobre el esquema base

- Estado: aceptado.
- Fecha: 11/11/2026.
- Trazabilidad: RN-FRM-03, RN-FRM-05, RN-FRM-07. Backend: [0068](../../../pf-puentes-backend/docs/adr/0068-esquema-base-y-composicion-de-campos-adicionales.md).

## Contexto
El administrador editaba el JSON Schema completo. Un error de sintaxis o de estructura solo
se veía al guardar, y el motor no distinguía los campos base de los adicionales.

## Decisión
- **Base fija.** La pantalla lista las secciones del esquema base (`GET /formularios/base`).
  Las que no admiten campos aparecen con candado; las demás reciben campos nuevos.
- **Campos adicionales.** El formulario "Añadir campo" pide sección, título, clave, tipo y
  opciones, límites, unidad, ayuda y obligatoriedad. La clave se sugiere desde el título y el
  administrador puede cambiarla.
- **Validación en el servidor.** Cada cambio llama a `POST /formularios/validacion`. Los errores
  llegan con su ruta (`campos_extra[i].clave`) y se muestran en la fila correspondiente.
  El guardado nunca depende de una validación local.
- **Vista previa y JSON de solo lectura.** La vista previa usa el motor con el esquema compuesto.
  La pestaña Avanzado muestra el JSON, sin editarlo.
- **Edición.** Al abrir un borrador, sus campos adicionales se reconstruyen desde las
  propiedades con `x-extra`. Una versión que ya no es borrador se muestra de solo lectura.
- **Motor.** Un campo con `x-control: textarea` se pinta como área de texto, y uno con
  `format: date` como selector de fecha.

## Consecuencias
- La composición de la vista previa replica la del servidor solo para mostrarla; el servidor
  sigue siendo quien compone, valida y guarda.
- Quedan pendientes el resumen de errores al pulsar Enviar en el motor (pestañas con contador
  de errores y salto al primero) y el aviso «no es la vigente» en la captura.
