# ADR 0025 — Publicación atómica de preparación local por propietario

Estado: aceptado para la integración parcial G3; proveedores P4/P5 productivos pendientes.

## Decisión

IndexedDB v4 añade `preparaciones`, con clave `propietario_id`, sin eliminar ni
transformar almacenes de v1–v3. Cada registro contiene exclusivamente una
preparación completa: asignaciones con todos sus contextos, fichas P3, esquema
activo P4 versionado y última publicación P5 por puente cuando exista.
El esquema activo se obtiene independientemente del historial P5: su id exacto
se guarda en `formulario_version_id`. Ambos contenidos son referencias JSON
opacas; no se interpretan campos ni se implementa el motor P4. Las versiones
históricas de esquema permanecen disponibles para los borradores.

`PreparacionLocal` implementa y extiende `ReferenciaOffline`. Recibe puertos
explícitos de referencia, publicación y esquema. La ausencia de cualquier puerto
o de esquema activo impide completar. En cambio, `null` del puerto P5 significa
«este puente no tiene publicación previa» y es un resultado válido (RN-OFF02:
«cuando exista»). Se consulta una vez cada puente asignado y se guarda
`publicaciones: { puente_id, publicacion: ReferenciaLocal | null }[]`, sin perder
los contextos de asignación repetidos. No se usa P5 para seleccionar el esquema.
No se suministran proveedores ficticios en producción ni se conecta Preparar salida.

Todas las descargas terminan antes de abrir la transacción. Se amplía
`AccesoLocal.habilitarPreparada` con una publicación opcional y sus tablas:
conserva su renovación y política G2, después escribe referencias, snapshot y
habilitación en una única transacción. El callback solo admite persistencia
local; nunca red. Recomprueba identidad/revisión/revocación antes y después
del callback; la invalidación aborta también sus escrituras. Los llamadores
anteriores sin callback conservan el contrato booleano.

Se reutiliza `PersistenciaOffline.guardarReferencias` dentro de esa transacción
para conservar validación de propietario y retención de versiones. Un esquema
con el mismo identificador pero distinto contenido se rechaza antes de guardar:
no debe vincularse una preparación a un contenido diferente del histórico.

Las lecturas de preparación usan `AccesoLocal.consultarPropias`, que encapsula
la habilitación durable G2, el propietario y la comprobación final de identidad/
revisión. No se usa `alInvalidar` como token de revisión: ese canal también
notifica actualizaciones ordinarias y podría ocultar una primera lectura válida. Una reapertura sin red puede leer
la última completa del dueño habilitado; cierre/cambio no purgan datos pero los
ocultan. Nunca se persisten tokens ni se habilita sesión remota mediante snapshot.

## Alternativas descartadas y límites

- Sobrescribir referencias durante descargas: expone resultados parciales.
- Habilitar antes o después en otra transacción: admite snapshot huérfano o
  acceso concedido tras un fallo de disco.
- Duplicar reglas de autenticación: diverge de revocación y reapertura G2.
- Vaciar almacenes al migrar o preparar: destruye pendientes e históricos.
- Exigir publicación previa o derivar de ella el esquema activo: impide preparar
  puentes sin historial y confunde los contratos independientes P4/P5.

No acredita sincronización real, contratos P4/P5, V01/V02/V16 ni confidencialidad
frente a alguien con acceso directo al perfil del navegador (límite del ADR 0024).
