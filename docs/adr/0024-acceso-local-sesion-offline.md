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

Implementación local G2: la fábrica de `AccesoLocal` se instancia antes de
hidratar P2 y registra su liberación con `DestroyRef`. Al terminar esa hidratación
reconcilia una identidad remota distinta de la preparada: en ese arranque P2 no
tenía usuario anterior para emitir `cambio`. Después, únicamente los eventos de
sesión y una nueva preparación modifican la habilitación; consultar desde una
pestaña con identidad antigua no puede volver a revocar un login legítimo.
Esa pestaña sigue sin poder consultar capturas del otro propietario.

Dexie `liveQuery` observa habilitación y capturas para limpiar/actualizar vistas.
La revocación durable también invalida el adaptador `SesionOffline`, que reutiliza
la cancelación generacional y `AbortSignal` de `MotorSync`. Antes y después de
renovar, el adaptador comprueba la revocación durable. No se concede acceso
mediante mensajes o UUID recibidos de otra pestaña. Las pruebas con HTTP de
prueba y transporte simulado aislado cubren cierre/cambio en otra instancia
durante ejecución, sin aplicar ACK ni consumir intentos de la operación siguiente.

La ruta productiva diferida `/offline/local` consulta únicamente capturas del
dueño habilitado y se vacía al invalidar. No exige ni concede sesión remota.
Es consultiva: P5 aún no integra su edición; no se inventa un editor productivo
ni Preparar salida. El harness `/offline/demo?sesion=1` sí acredita edición con
la persistencia existente, preparación ficticia y base exclusiva
`puentes-offline-sesion-demo`. Playwright sustituye HTTP de `AuthService`, no
instala una autenticación alternativa. La demo B01–B08 conserva su ruta y base.

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
