# 0009. Persistencia y cola offline autónoma

- Estado: aceptado
- Fecha: 05/10/2026
- Directriz: DT-OFF-03..10, RN-OFF-03..08

## Contexto

P6 necesita una base independiente de los contratos pendientes de P2/P4/P5.
Las capturas y operaciones deben sobrevivir cierres y conservar versiones en vuelo.

## Decisión

Usar Dexie con modelos JSON versionados y UUID v7: `puentes`,
`esquemas_formulario`, `inspecciones`, `fotos`, `documentos` y `cola_sync`.
La versión 2 añade `bloqueos`, sin eliminar datos de la versión 1.
Cada escritura de captura y operación es una transacción; las operaciones son
inmutables y sus ACK incluyen propietario, id y versión local.
Cada edición o alta de archivo aumenta la versión local. Una captura posterior
a una intención de envío conserva la operación original y crea trabajo nuevo,
sin modificar su snapshot; una nueva intención pertenece a la versión nueva.
La futura integración deberá revalidar la editabilidad con P5 y conservar las
capturas rechazadas. La base no implementa esa máquina de estados.

Estados: pendiente, en_proceso, confirmada y requiere_intervencion. Las
dependencias calculan los bloqueos. Backoff tras fallos 1..4: 2/4/8/16 segundos;
el quinto detiene la automatización. Manual reinicia el ciclo sin cambiar clave.
Rechazos de negocio requieren intervención; sesión inválida pausa el motor.
Un lease por base/propietario en IndexedDB dura 15 segundos y se renueva cada
3 segundos. Un transporte recibe AbortSignal y debe cancelar al perder lease;
un ACK tardío se rechaza mediante el token de ejecución. Un cierre libera por
vencimiento y recupera operaciones en_proceso con las mismas claves.

## Consecuencias

No se guardan credenciales, peticiones HTTP ni FormData. Propietario explícito
en cada API y consulta. Sin transporte configurado no hay confirmaciones.
Los blobs confirmados se conservan en esta base; no se introduce purga automática.
Los adaptadores reales deberán respetar cancelación, idempotencia y ACK versionado.
