# 0013. Vista de consulta de pesos

- Estado: propuesto para revisión; vista implementada, integración de acceso pendiente
- Fecha: 19/10/2026
- Historia: HU-P8-IC-04, lectura administrativa
- Reglas/directrices: RN-IC-03; DT-FE-01/02/03/04/05/06/11/12/13; DT-SEC-02/03

## Contexto

P8 ya tiene API y cliente HTTP de consulta. El usuario confirmó el 19/10 que P2 todavía no comparte sesión, interceptores ni guardias frontend. La selección de versiones y sus etiquetas reales corresponde al módulo de formularios de P4.

## Decisión

`features/admin/pesos/ConsultaPesos` es una vista standalone con entrada signal obligatoria `formularioVersionId`. Consulta el servidor mediante el `PesosService` existente. Muestra juegos paginados, referencia de acta, vigencia y elementos/pesos del juego elegido. No selecciona automáticamente un juego ni lo declara activo/aprobado. La ausencia de referencia de acta se presenta como calibración pendiente de documentar; una referencia presente no se certifica como firmada.

Cada colección tiene paginación de servidor con tamaño 20, carga, contenido vacío, errores en español y reintento. Los efectos cancelan peticiones al cambiar versión, selección o página y al destruir la vista; los `linkedSignal` reinician selección/páginas según su origen. Ante 401/403 se retiran también los metadatos privados mostrados. No se utiliza almacenamiento persistente para resultados o tokens.

Los textos están centralizados en `shared/textos.ts`. Fechas `dd/MM/yyyy` en UTC−6 (America/Guatemala), locale `es-GT`, pesos con hasta tres decimales, tablas con captions y encabezados, controles nativos, foco visible, regiones desplazables y mensajes de estado/error. CSS adaptable a móvil. Las comprobaciones de semántica y contraste no sustituyen una auditoría completa de accesibilidad.

Se habilitan `strict` y `strictTemplates` en la configuración base, conforme a DT-FE-01. Se comprobó primero la compilación estricta de las fuentes, pruebas y plantillas existentes; no hizo falta modificar otros módulos.

## Integración pendiente

La vista **no se registra aún en las rutas ni en la plantilla raíz**. DT-FE-11 exige guardia por rol, y `Equipo/01-division-de-trabajo.md` asigna sesión/interceptores/guardias a P2. Cuando entregue esa base, se integrará por `loadComponent`/`loadChildren` bajo Administrador, con el input tomado de la versión elegida en el flujo real de formularios. No se crea un acceso público, guardia ficticia, login paralelo ni selector con versiones fijas. El backend conserva su autorización efectiva independiente del frontend.

Por eso `npm start` aún no muestra esta vista ni acredita un recorrido autenticado. Puede comprobarse su comportamiento mediante las pruebas DOM/HTTP; completar el recorrido exige sesión real, guardia y selección de versión. La creación/edición sigue requiriendo metadatos confiables de P4 y los acuerdos de versiones/completitud y acta.

## Verificación

Las pruebas verifican carga y datos, selección explícita, fechas cercanas al cambio de día en Guatemala, referencias documentales, controles nativos y encabezados, colecciones vacías, ambas paginaciones, reinicio y cancelación al cambiar versión/juego, reintentos, 401/403/404/500, caída de red y limpieza al destruir. El transporte se sustituye solo dentro de las pruebas. Los resultados ejecutados se registran en el avance de P8. HU-P8-IC-04 continúa en progreso.

Resultado del 19/10: 53 pruebas unitarias (18 nuevas) y ocho e2e del harness offline existente aprobados, con ESLint, Prettier y build de producción correctos (67.84 kB de transferencia inicial estimada). Compilación estricta de fuentes, pruebas y plantillas comprobada. Contraste calculado: texto principal 14.68:1; botón 8.72:1; selección 8.49:1; error 8.31:1; foco 17.74:1. No se ejecutó un recorrido de pesos autenticado, ya que falta la base frontend de P2.
