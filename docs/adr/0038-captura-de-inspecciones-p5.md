# 0038. Captura de inspecciones en línea (P5)

- Estado: aceptado para el incremento de captura en línea (sprints F1–F5 del análisis).
- Fecha: 27/10/2026.
- Reglas: RN-INS-02/03/05/09/10/11/12/14, RN-REV-01/02, RN-FRM-05, DT-OFF-05, DT-SEC-04, DT-FE-05/12/13.

## Decisión

`features/inspecciones/` consume el backend de P5 sin reimplementar sus reglas:

- **DTO = JSON.** `modelos.ts` conserva el snake_case del backend; no hay mapeadores. `InspeccionDTO` marca como opcionales los campos que el servidor omite (`NON_NULL`), p. ej. el IC en un borrador.
- **Cliente HTTP** (`InspeccionApi`) 1:1 con la matriz del backend más los archivos de P1. `Idempotency-Key` es un parámetro de cada escritura (nunca va en un GET) y se recorta a 100 caracteres. `X-Sgp-Sync` existe en la API del cliente pero solo debe usarlo la cola de P6.
- **UUID v7 en el cliente** antes de cada alta y de cada foto (`dispositivo.ts`). Nunca `crypto.randomUUID()` (v4 → 400). El id de dispositivo reutiliza `sgp.dispositivo` de la cola offline.
- **Store por pantalla** (`InspeccionStore`, signals, provisto por componente). Tras cada respuesta reemplaza la inspección completa: la `version` de concurrencia sale del servidor, nunca se incrementa a mano.
- **Idempotencia.** Mismo cuerpo → misma clave (reintento de red); cuerpo distinto → clave nueva; tras un 422 de envío la clave se renueva porque el servidor cachea el 422.
- **Schema-driven.** P5 no declara secciones SIECA. El motor de P4 pinta el formulario; `esquema.ts` deriva del esquema (`x-permanente`, `x-elemento-ref`) el subesquema de datos permanentes, las referencias de fotos y el mapa de errores 422 → controles. Los daños nunca viajan en la confirmación de permanentes.
- **Editable** solo si `estado === 'BORRADOR'` y el usuario es el autor; el resto abre el mismo motor en lectura, con **la versión congelada** del formulario de la inspección.
- **Guardado parcial** con autoguardado (1,5 s) que nunca dispara el envío, y poda de nulos/blancos (el 0 y `false` se conservan). La validación completa es del servidor: el envío muestra todos los `errores[]` juntos.
- **409 `version-desactualizada`** no pisa en silencio: el usuario elige conservar lo suyo o usar la versión del servidor.
- **Copy por rol.** El estudiante nunca ve «publicada» al enviar; catedrático y profesional sí. El Administrador no ve el acceso ni entra a las rutas de alta/puentes inspeccionables.
- **404 opaco.** Cualquier 404 muestra el mismo mensaje genérico (RN-INS-05).

## Rutas

`/inspecciones` (mías), `/inspecciones/puentes`, `/inspecciones/nueva/:puenteId` (`?curso=` y `?corrige=`), `/inspecciones/:id` (captura o lectura), `/inspecciones/:id/permanentes`, `/inspecciones/:id/historial` y `/puentes/:id/inspecciones`. Todas son diferidas; el backend sigue siendo la autoridad.

## Límites conocidos

- **Offline (P6).** Esta entrega es en línea. La captura aún no escribe en Dexie ni encola con `X-Sgp-Sync`; la cola y su transporte ya existen en `offline/` y se integrarán en el sprint F6. La pantalla avisa cuando no hay red.
- **Fotos ya subidas.** No existe `GET /inspecciones/{id}/fotos`: la galería muestra solo lo subido en la sesión. Si hay menos de 4 fotos de esta sesión, el usuario puede declarar que ya subió ≥ 4 antes; el servidor sigue siendo la autoridad (`contarFotos`).
- **Validador provisional del backend.** Hasta que P5 cablee el esquema SIECA de P4, el servidor valida otras rutas (`identificacion.*`). El 422 de campos SIECA se cierra cuando el backend retire el provisional; el frontend no copia ese árbol. `grupos_sin_danos` se envía con el `x-grupo` del motor; si el servidor aún no lo conoce (`grupo-con-danos`), se reintenta sin la marca porque los ceros ya viajan en `datos`.
- **IC.** No se calcula en el cliente; se muestra el que devuelve el servidor al publicar.
- **Presupuesto del bundle.** Los textos (`TEXTOS.inspecciones`) viven en el paquete inicial (+~11 kB sin comprimir). El presupuesto inicial ya se superaba antes de este incremento.
