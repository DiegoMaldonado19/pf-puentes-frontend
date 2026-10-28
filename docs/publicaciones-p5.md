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

## Verificación

```sh
npx ng test --watch=false --include=app/offline/publicaciones-p5.spec.ts --include=app/offline/preparacion.spec.ts
```

Las pruebas usan HTTP simulado e IndexedDB aislado. No acreditan editor, captura,
sincronización real ni las V integrales. La composición y la acción estudiantil
se describen en la [guía de preparación](preparacion-local.md).
