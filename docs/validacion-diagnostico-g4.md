# Validación G4 — indicador y diagnóstico offline

## Alcance observado

- **S1:** la navegación consulta `EstadoLocal`, que obtiene el dueño de
  `AccesoLocal.propietarioActual()` y lee la cola mediante
  `AccesoLocal.consultarPropias`. `/offline/local` reutiliza la ruta G2 y muestra
  capturas y diagnóstico solo para ese dueño. El indicador cuenta inspecciones
  y archivos distintos pendientes.
- **S2:** estados y errores se exponen como texto con roles `status`/`alert`,
  también cuando aún no hay dueño habilitado. La prueba fuerza persistencia no
  concedida y verifica el mensaje textual y la cuota; el color no es la única
  señal.
- **S3:** la vista es consultiva. Sin `MotorSync` no hay botones de reintento;
  cerrar sesión limpia la vista, pero la captura, archivos y operaciones siguen
  en IndexedDB. Conflictos, permisos no acordados y caché privada se mantienen
  como pendientes de G11.

El escenario de navegador usa `/offline/demo?sesion=1` únicamente como fixture
G2 con IndexedDB aislada (`puentes-offline-sesion-demo`) y respuestas HTTP de
sesión sustituidas por Playwright. `VistaLocal`, `DiagnosticoOffline`,
`AccesoLocal` y la persistencia consultiva son los componentes/servicios reales;
la preparación de referencia sigue siendo ficticia. El test no inicia ni invoca
el motor/transporte y comprueba que la cola no recibe ACK. No acredita captura,
Preparar salida ni sincronización productivas de P4/P5.

## TDD y regresión

- RED inicial: el indicador de navegación no existía, el diagnóstico lanzaba
  `NG0950` al omitir el motor, el estado del indicador no tenía `aria-live` y
  `/offline/local` no componía el diagnóstico. Resultado observado: 4 fallos,
  7 aprobaciones, con la siguiente orden:
  `npx ng test --watch=false --include=app/app.spec.ts --include=app/offline/diagnostico.spec.ts --include=app/offline/indicador.spec.ts --include=app/offline/vista-local.spec.ts`.
- RED adicional de S2: tras revocar al dueño no había estado de almacenamiento
  accesible en la vista. Resultado observado: 1 fallo y 2 aprobaciones con
  `npx ng test --watch=false --include=app/offline/vista-local.spec.ts`.
- GREEN: el conjunto focal final pasó 14 pruebas en 5 archivos; `EstadoLocal`
  incluye pruebas de cambio de dueño, cola conservada y emisión viva tardía
  descartada.
- PRESERVE: B06 del diagnóstico con motor simulado sigue pasando; B04/B05 y los
  escenarios G2 también pasan dentro del proyecto E2E completo.

## Comandos y resultados

| Comando                                                                                                                                                                                                                      | Resultado observado                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npx ng test --watch=false --include=app/app.spec.ts --include=app/offline/diagnostico.spec.ts --include=app/offline/indicador.spec.ts --include=app/offline/estado-local.spec.ts --include=app/offline/vista-local.spec.ts` | Exit 0; 5 archivos y 14 pruebas aprobadas.                                                                                                                                                                                                             |
| `npm run test:e2e:base -- --grep 'G4'`                                                                                                                                                                                       | Exit 0; 1 escenario G4 aprobado.                                                                                                                                                                                                                       |
| `npm run test:e2e:base -- --grep 'B06'`                                                                                                                                                                                      | Exit 0 en la rama y en la copia base `8511db2`; 1 escenario aprobado en cada ejecución y el mismo aviso de consola 404. Las diferencias observables fueron los tiempos del runner; no se observó un fallo de stderr ni cambio del resultado funcional. |
| `npx ng test --watch=false`                                                                                                                                                                                                  | Exit 0; suite completa: 63 archivos y 564 pruebas aprobadas.                                                                                                                                                                                           |
| `npx ng lint`                                                                                                                                                                                                                | Exit 0; todos los archivos pasan lint.                                                                                                                                                                                                                 |
| `npm run build`                                                                                                                                                                                                              | Exit 0; build de producción generado.                                                                                                                                                                                                                  |
| `npm run test:e2e:base`                                                                                                                                                                                                      | Exit 0; 12 escenarios aprobados, incluidos B01–B08 y G2–G4. El runner imprimió avisos de consola 404 y 504 durante las pruebas de red/app shell; no falló ningún escenario.                                                                            |

## Verificación independiente y cierre

La verificación independiente aprobó S1–S3 sin bloqueantes. Además de las 14
pruebas focalizadas existentes, ejecutó seis casos aislados con la navegación y
la política G2 reales: cierre y cambio de cuenta, almacenamiento ausente o con
error, lectura de cola rechazada y descarte de lectura tardía. Resultado final:
20/20, exit 0, sin cambiar el código del repositorio. Un fallo intermedio del
fixture de prueba Dexie se corrigió en el scratch, no en producción. Esas seis
pruebas exploratorias no se incorporaron a la suite versionada.

La revisión nativa no emitió veredicto: START del primer rango de commit fue
rechazado con `native-start-retained-selection-candidate-mismatch`, sin crear
lineage ni mutar autoridad. El usuario decidió «Completar el cierre con las
verificaciones aprobadas», dejando las dos unidades de G4 sin revisión nativa.
No se deshabilitó el switch global ni se presenta esta decisión como aprobación
nativa. La aceptación funcional se apoya en los checks y la verificación
independiente indicados arriba, no en sincronización remota real.

La entrega local sigue una cadena sobre `feature/offline-diagnostico-g4`:

1. `feature/offline-diagnostico-g4-1`: diagnóstico reusable sin transporte,
   regresiones y contrato de componentes; commit `a8ddc03`, 286 líneas.
2. `feature/offline-diagnostico-g4-2`, basada en la anterior: navegación,
   propietario G2, vista local, regresiones y evidencia. Esta unidad excede
   400 líneas para conservar la integración y sus pruebas juntas.

Las ramas quedan locales, sin push, PR ni integración a `develop`/`main`.
Los scratch de las pruebas no forman parte de la entrega; no se eliminaron
rutas externas al proyecto.
