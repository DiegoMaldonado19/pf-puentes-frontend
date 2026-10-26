# Preparación local completa por propietario

`PreparacionLocal` publica un snapshot durable y habilita el acceso G2 en una sola
transacción. Una descarga parcial, un proveedor ausente o la ausencia de esquema
activo nunca sustituye la última preparación completa. Un puente sin publicación
previa sí puede prepararse: P5 es historial opcional, no el esquema activo P4. Esta entrega es
infraestructura G3 con consumidor P4 G9.1: **no conecta Preparar salida productivo ni implementa P5**.

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

## Proveedor P4 por propietario (G9.1)

Inyectar `EsquemasP4` como `esquema` en el constructor anterior. Implementa
`PuertoEsquema` sin escribir caché ni llamar a `FormularioService.obtenerActivo()`
(que mantiene su caché de mejor esfuerzo bajo `sistema`). Solo el coordinador G3
publica los datos junto con el resto de la preparación.

| Método                              | Consulta P4                                  |
| ----------------------------------- | -------------------------------------------- |
| `descargar(propietario_id)`         | `GET /api/v1/formularios/activo`             |
| `porCodigo(propietario_id, codigo)` | `GET /api/v1/formularios/versiones/{codigo}` |
| `porId(propietario_id, id)`         | `GET /api/v1/formularios/{id}`               |

Los segmentos se codifican con `encodeURIComponent`. Las consultas exactas
comprueban que el código/id recibido coincida con el solicitado. Se conserva el
DTO JSON completo en `datos`: `id`, `codigo`, `esquema`, `mapeo`, `estado`, fechas y
extensiones desconocidas. `modelo_version: 1` versiona el envoltorio local, no la
versión P4. El adaptador comprueba la integridad de ese envoltorio HTTP; no
reimplementa el motor ni la validación de respuestas de P4.

Solo HTTP 404 con ProblemDetail `type` igual a
`https://sgp.cunoc.usac.edu.gt/errores/formulario-activo-no-encontrado` en la consulta
activa devuelve `null` y produce `sin_esquema` en G3. Otros 404, errores HTTP,
respuestas parciales o cambios/revocación de sesión fallan sin publicar.
Las consultas históricas nunca convierten un 404 en ausencia válida.
Se renueva/comprueba la sesión antes y después de una descarga exitosa.

La recuperación histórica queda disponible por código/id explícito; no se infiere
una versión desde el JSON opaco P5 ni se agrega precarga automática. G3 continúa
seleccionando el activo independientemente del historial P5.
**Sin API P5 disponible, omitir `publicacion`: nunca instalar un proveedor que
siempre devuelva `null`.** La preparación no queda completa y conserva la última
completa. Los dobles P3/P5 utilizados para acreditar G9.1 viven solo en pruebas.

G9.1 acredita el consumidor y su integración atómica aislada, no V01/V02/V16,
captura real ni Preparar salida completo. Las pruebas usan el contrato de rutas,
DTO y ProblemDetail contrastado con el código backend; HTTP está simulado, no se
ha probado contra un servidor desplegado.

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
npx ng test --watch=false --include=app/offline/esquemas-p4.spec.ts
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

### Evidencia G9.1 — 26/10/2026

- RED: test del adaptador rechazado por módulo `esquemas-p4` inexistente (exit 1).
- GREEN inicial: 17/17 del adaptador; con renovación final añadida, verificación
  independiente: 18/18 del adaptador y 29/29 de preparación (47/47, exit 0).
- Suite Angular global: 669/669; lint y build: exit 0.
- E2E base: 14/14, exit 0; regresión del harness, no prueba P4 en servidor.
  La consola registra 404 de recursos sin fallos en los escenarios.
- Build advierte 501,68 kB de bundle inicial frente al presupuesto de 500 kB.
- `prettier --check .`: exit 1 por cinco archivos ajenos sin modificar
  (`.atl/.skill-registry.cache.json`, `.atl/skill-registry.md`,
  `.review-g2-t2a/odd/tasks/sesion-offline-p2.md`,
  `.review-g2-t2a/src/app/offline/sesion-offline.spec.ts`,
  `odd/tasks/offline-diagnostico-g4.md`).
- Sin revisión nativa aprobada: `gentle-ai` no está en PATH (exit 127) y
  el facade `assess` devuelve `nativeRisk: unassessable` por archivos nuevos
  sin declaración de alcance. Se ejecutó verificación independiente por
  riesgo de identidad (item 2), aprobada S1–S3. No hay recibo ni consentimiento
  nativo de cierre. La persona usuaria decidió explícitamente: «Cierra g9.1 sin
  revisión nativa». G9.1 queda cerrado en su alcance aislado, sin aprobación
  nativa y sin deshabilitar RDD para otros candidatos.

No cambia código compartido de comandos/servicios existentes; no corresponde
comparación diferencial de CLI. No hubo migraciones, commits ni push.

Decisión y alternativas: [ADR 0025](adr/0025-preparacion-local-referencia.md).
