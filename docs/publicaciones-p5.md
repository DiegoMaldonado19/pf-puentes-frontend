# Lectura P5 para preparación local

`PublicacionesP5` implementa `PuertoPublicacion` sin escribir IndexedDB. El dueño
local es quien descarga, no necesariamente el autor de la publicación.

## Contrato de lectura

1. Consultar `GET /api/v1/puentes/{id}/datos-permanentes` con la sesión vigente.
2. Solo `origen_inspeccion_id: null` explícito permite devolver ausencia válida.
3. Con origen, consultar su detalle autorizado en `GET /api/v1/inspecciones/{id}`.
4. Conservar ambos DTO completos en `ReferenciaLocal.datos`, bajo `precarga` y
   `publicacion`, incluidas sus extensiones. El formulario del detalle es un
   resumen, no el esquema histórico completo.

Una revisión de inspección entera `0` es válida; no es `modelo_version: 1`, que
versiona el envoltorio local. Se rechazan revisiones negativas o fraccionarias,
respuestas parciales y referencias incompatibles. HTTP 401/403/404 y cambios de
sesión nunca se convierten en ausencia. El consumidor no modifica la preparación
anterior: solo G3 publica cuando todos los proveedores terminan correctamente.

## Captura y lectura histórica en línea

La captura consulta `GET /api/v1/inspecciones/{id}/archivos` al abrir. Fotos y PDF
anteriores se muestran junto con los nuevos; las fotos reales del inventario
determinan el mínimo de envío y los límites. El autor puede quitar también un
archivo subido en otra sesión mientras la inspección siga siendo editable. Si el
inventario falla, se informa el error: no existe una casilla para declarar fotos
que el cliente no ha consultado. Una URL nula no genera un enlace descargable.

El autoguardado conserva una revisión por edición: la respuesta de un PUT nunca
limpia cambios posteriores. El guard de salida espera que se guarde la última
edición; si falla, impide salir. Un reintento de envío tras un corte de red
reutiliza tanto la clave de idempotencia como el cuerpo original, incluida su
fecha; un 422 permite corregir y genera un intento nuevo.

En solo lectura, **Imprimir** usa el formulario congelado y permite guardar PDF
desde el navegador. **Exportar JSON** descarga la inspección, el identificador y
código de su versión de formulario y su esquema histórico completo, no el activo.

El autor de un borrador puede **Estimar IC**: primero se guarda lo pendiente y el
resultado se rotula como preliminar. Una nueva edición invalida la estimación
mostrada. En una publicada, Catedrático y Administrador consultan recálculos;
solo el Administrador obtiene los juegos compatibles y puede ejecutar uno nuevo.

## Verificación

```sh
npx ng test --watch=false --include=app/offline/publicaciones-p5.spec.ts --include=app/offline/preparacion.spec.ts
```

Las pruebas usan HTTP simulado e IndexedDB aislado. No acreditan editor, captura,
sincronización real ni las V integrales. La composición y la acción estudiantil
se describen en la [guía de preparación](preparacion-local.md).
