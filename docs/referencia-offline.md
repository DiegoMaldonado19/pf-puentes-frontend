# Descarga de referencia asignada P7/P3

`ReferenciaP3.descargar(propietario_id)` descarga asignaciones y fichas de puentes con
sesión remota G2. Es una pieza de preparación, **no una salida lista**: no persiste,
no publica snapshots y no sustituye la última preparación completa. La coordinación
durable y los proveedores P4/P5 quedan para los siguientes cortes del grupo 3.

## Integración

1. Inyectar `ReferenciaP3` (implementa `PuertoReferenciaP3`). Usa el adaptador
   `SesionOffline` existente, conectado a `AuthService`, sin otra autenticación.
2. Esperar `descargar(propietario_id)`. Devuelve `ReferenciaAsignadaP3` con
   `asignaciones: AsignacionP7DTO[]` y `puentes: PuenteDTO[]` solo tras completar
   las descargas y comprobar de nuevo la sesión remota.
3. Ante un rechazo, conservar la preparación anterior. Un resultado de este puerto
   por sí solo tampoco acredita esquema/publicación disponible ni autoriza captura.

## Contratos y límites

| Pieza                                                 | Comportamiento                                                                                                                                                             |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AsignacionesP7` / `PuertoAsignacionesP7.consultar()` | Observable frío con una única lista al completar todas las páginas.                                                                                                        |
| P7                                                    | `GET /api/v1/mis-asignaciones?page=0&size=20`, páginas sucesivas desde cero; tamaño fijo 20, inferior al máximo 100.                                                       |
| Página P7                                             | `content`, `number`, `size`, `total_elements`, `total_pages`; no reutiliza la página P3 (`contenido`, `pagina`, etc.).                                                     |
| Asignación                                            | Conserva `id`, `inscripcion_id`, `curso_id`, `estudiante_id`, `puente_id`, `curso_nombre`, `puente_codigo`, `puente_nombre`, `creado_en`.                                  |
| Fichas P3                                             | Reutiliza `PuentesService.detalle(id)`, una descarga por puente distinto. No consulta `todosActivos()` ni lo usa como autorización.                                        |
| Contextos                                             | Dos asignaciones del mismo puente en cursos distintos permanecen separadas; solo se deduplican las fichas.                                                                 |
| Lista vacía                                           | Devuelve ambas listas vacías; no solicita fichas. No acredita preparación completa.                                                                                        |
| Fallo HTTP                                            | Propaga el error, incluidos 401/403 no recuperados por los interceptores existentes; no devuelve acumulados parciales ni usa datos ficticios.                              |
| Sesión                                                | G2 comprueba acceso remoto antes y después. Cambios de propietario o invalidaciones durante la descarga impiden devolver el resultado, aunque llegue una respuesta tardía. |

Las peticiones en vuelo pueden terminar tras una invalidación; sus resultados se
descartan. El consumidor P7 aislado no comprueba sesión: la frontera de descarga por
propietario es `ReferenciaP3`. No se añade transporte P4/P5 ni fallback de producción.
Los dobles de sesión se limitan a pruebas.

No cambia el modelo local G1 ni el esquema Dexie: no se necesita migración/ADR en
este corte y no se purgan capturas ni operaciones pendientes. Este puerto no
implementa `ReferenciaOffline` de G1: ese contrato también exige esquemas de
formulario, que deberá reunir el coordinador sin inventar endpoints.

## Verificación focalizada

```sh
npx ng test --watch=false --include=app/offline/asignaciones-p7.spec.ts
npx ng test --watch=false --include=app/offline/referencia-p3.spec.ts
```

Las pruebas cubren páginas múltiples, lista vacía, dos cursos por puente, fallos
intermedios y 401/403, pérdida de sesión y conexión real entre los adaptadores G2 y
`AuthService` con HTTP controlado. No sustituyen la verificación con backend y una
cuenta estudiante activa ni prueban todavía la conservación durable del snapshot.
