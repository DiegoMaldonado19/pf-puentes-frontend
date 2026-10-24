# ADR 0024 — Habilitación local durable separada de P2

Estado: propuesto; coordinación con P2 pendiente (G6).

## Decisión

Añadir en IndexedDB v3 un registro único `acceso_local` con propietario y
revocación, sin tokens. Conservar todos los almacenes anteriores. Solo una
preparación completa con sesión remota válida puede habilitar la identidad;
G2 no implementa esa preparación productiva (G3/G9).

El servicio local observa los eventos de `AuthService`: cierre/cambio revocan,
login online del mismo propietario restaura una habilitación existente. Fallo
de red o renovación inválida no equivalen a cierre explícito. Una renovación
no restaura una habilitación revocada. Las lecturas consultan el registro durable
y filtran por propietario mediante `PersistenciaOffline`; no aceptan un UUID
como desbloqueo. Cada pestaña vuelve a comprobar ese registro, no una copia
persistente en memoria. Las escrituras se serializan con transacciones Dexie.

## Límites y entrega incremental

Primera unidad: servicio y migración con pruebas HTTP aisladas. Aún no se
instancia desde producción ni conecta navegación, preparación o motor. La
siguiente unidad debe cancelar ejecución/limpiar vistas entre pestañas al
revocar, conectar el servicio antes de hidratar P2, ofrecer navegación local
separada y verificar el harness en navegador. No conectar un servicio parcial.

La identidad preparada nunca modifica `AuthService.autenticado()`, roles ni
permisos. No hay transporte HTTP, caché genérica, purga ni simulador productivo.
G2 es integración parcial; no acredita V09 completo.

Se presupone control del dispositivo y perfil del navegador. No se incorpora
PIN ni cifrado; alguien con acceso directo a IndexedDB puede leer o modificar
sus datos. El mecanismo no garantiza confidencialidad en un perfil compartido.

## Alternativas descartadas

- Persistir JWT o tratar la identidad preparada como sesión P2: concede acceso
  remoto indebido y expone credenciales.
- Desbloquear seleccionando propietario: elude la revocación explícita.
- Borrar la base al cerrar sesión: pierde capturas y cola pendientes.
