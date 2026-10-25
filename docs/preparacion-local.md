# Preparación local completa por propietario

`PreparacionLocal` publica un snapshot durable y habilita el acceso G2 en una sola
transacción. Una descarga parcial, un proveedor ausente o la ausencia de esquema
activo nunca sustituye la última preparación completa. Un puente sin publicación
previa sí puede prepararse: P5 es historial opcional, no el esquema activo P4. Esta entrega es
infraestructura G3: **no conecta Preparar salida productivo ni implementa P4/P5**.

## API para el harness G3/T3

Construir el coordinador con la misma base, `AccesoLocal` y `SesionOffline` del
harness; no crear una segunda política de sesión:

```typescript
const preparacion = new PreparacionLocal(db, acceso, sesion, {
  referencia, // PuertoReferenciaP3: descargar(propietario_id)
  publicacion, // PuertoPublicacion: consultar(propietario_id, puente_id)
  esquema, // PuertoEsquema: descargar(propietario_id) → esquema activo P4
});
const resultado = await preparacion.preparar(propietario_id, actualizarProgreso);
if (resultado.completa) {
  const referenciaLocal = await preparacion.consultar(propietario_id);
  // referenciaLocal.preparacion: asignaciones con contexto y versión activa exacta.
  // .publicaciones: [{ puente_id, publicacion: ReferenciaLocal | null }]
  // referenciaLocal.puentes / esquemas_formulario: contrato ReferenciaOffline.
}
```

Los puertos ficticios se instalan exclusivamente en pruebas/harness. No hay
proveedores por defecto ni endpoints inventados. La referencia real se obtiene
con el adaptador `ReferenciaP3` de T1, que reutiliza P7 y `PuentesService`.

| Puerto            | Respuesta requerida                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Referencia        | Todas las asignaciones P7 y fichas P3 completas; una lista vacía es válida.                                                                                              |
| Publicación P5    | Última `ReferenciaLocal` de cada puente asignado, con id y `modelo_version` exactos y `datos` JSON opaco; `null` significa que no existe publicación previa y es válido. |
| Esquema activo P4 | `ReferenciaLocal` del dueño con id exacto, `modelo_version` entero positivo y `datos` JSON opaco; `null` significa esquema activo no disponible e impide completar.      |

Un puerto omitido no equivale a `null`: no poder consultar P5 es un impedimento;
consultarlo con éxito y recibir `null` no lo es (RN-OFF02, «cuando exista»).
Se conserva ese `null` por puente dentro de la preparación, no como error.
Se consulta una sola vez cada puente asignado, conservando cada contexto de
curso/asignación aunque varias asignaciones apunten al mismo puente.
El esquema activo se obtiene por separado; su id se guarda sin renombrarlo en
`formulario_version_id`, aunque las publicaciones P5 usen versiones históricas.
No interpreta ni precarga campos, no valida formularios y no concede autorización
de captura usando el inventario de puentes.

## Progreso y resultado

`preparar(owner, progreso?)` devuelve `{ completa, proveedores, error? }`.
`proveedores` contiene siempre `referencia`, `publicacion` y `esquema`:

- `pendiente`: todavía no se intentó; se detiene tras el primer impedimento.
- `descargando` y `completo`: avance por proveedor; el callback recibe ambos.
- `ausente`: no se inyectó el puerto requerido.
- `sin_esquema`: respuesta explícita `null` del esquema activo requerido.
- Para P5, `null` cuenta como `completo`; su ausencia explícita se conserva por puente.
- `fallo`: descarga rechazada, identidad invalidada durante ella o datos incompatibles.

**Solo `completa: true` acredita publicación y habilitación.** Los tres proveedores
pueden estar `completo` y aun fallar el commit o la renovación final; en ese caso
`completa` es `false` y `error` describe el impedimento. Esos estados no son una
sesión remota, un ACK de envío ni una acreditación de V01/V02/V16.

## Persistencia, identidad y migración

IndexedDB v4 añade `preparaciones` por `propietario_id`. v1–v3 no se transforman:
se conservan referencias históricas, habilitación, capturas, fotos, PDF y cola.
No se inventa una preparación a partir de los registros anteriores. El esquema
histórico de un borrador nunca se elimina; reutilizar su id con otro contenido
hace fallar la nueva preparación.

Descargas y renovación G2 ocurren fuera de la transacción. La ampliación opcional
`habilitarPreparada(owner, { tablas, publicar, vigente })` integra únicamente
escrituras locales; **el callback no debe hacer red ni efectos externos**.
Sin el segundo argumento mantiene el comportamiento anterior. La publicación
reutiliza `guardarReferencias` y revierte conjuntamente snapshot, referencias y
habilitación si falla cualquier escritura o cambia la sesión.

`consultar(owner)` implementa `ReferenciaOffline`, con `preparacion` opcional.
Devuelve listas vacías si no existe snapshot completo o no hay acceso al dueño.
Delega a `AccesoLocal.consultarPropias` la comprobación final de identidad y
revisión, sin confundir notificaciones de actualización con revocaciones. Reabrir sin red permite leer
la última completa habilitada, no seleccionar un UUID para desbloquear otra
cuenta. Cierre/cambio conservan datos pero revocan acceso conforme al ADR 0024.
No se persisten tokens; el límite de confidencialidad del perfil sigue vigente.

## Verificación focal

```sh
npx ng test --watch=false --include=app/offline/preparacion.spec.ts
npx ng test --watch=false --include=app/offline/acceso-local.spec.ts
npx ng test --watch=false --include=app/offline/sesion-offline.spec.ts
npx ng test --watch=false --include=app/offline/vista-local.spec.ts
```

Las pruebas cubren ausencia válida de historial P5, publicaciones distintas por
puente, esquema activo independiente, resultados por proveedor, puertos ausentes,
fallo parcial, reapertura, aislamiento, invalidación durante descarga/lectura/commit,
rollback y migración v3 con archivos y operaciones reales de la API local.
La migración comprueba también los bytes de foto, miniatura y PDF con blobs
nativos clonables; el Blob de jsdom pierde contenido al atravesar fake-IDB.
Verificación T2 observada: 24 pruebas de preparación, 15 de acceso local, 11 de
sesión offline y 2 de vista local pasan. El RED conductual previo confirmó el
rechazo incorrecto de `null` P5 y la falta de publicaciones por puente.
La evidencia de comandos exactos se entrega en el informe T2.

Decisión y alternativas: [ADR 0025](adr/0025-preparacion-local-referencia.md).
