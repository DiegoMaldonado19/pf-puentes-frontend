# G2 — Adaptar sesión P2
Objetivo: implementar únicamente G2 de `../../specs/2026-10-05-offline-y-sincronizacion/plan.md`.
Rama: `feature/offline-sesion-p2`; entrega: unidades revisables secuenciales; pruebas: Angular/Vitest y Playwright base.

## Specs

- S1: «Implementar `SesionOffline` sobre `AuthService.usuario()`/`renovar()` para sesión remota; comprobar identidad antes y después de preparar y antes de drenar. Sin sesión vigente del propietario, no enviar operaciones.»
- S2: «Persistir la habilitación de acceso local de la última identidad preparada con sesión válida, sin tokens. Recuperar sus capturas tras reiniciar sin red y distinguir ese acceso de `AuthService.autenticado()`, coordinando la navegación con P2.»
- S3: «Al cerrar sesión explícitamente o cambiar de cuenta, revocar acceso local del propietario anterior y pausar/cancelar su ejecución sin purgar datos. Exigir login online de ese propietario para recuperar acceso; no desbloquearlo seleccionando un UUID ni al reabrir sin red.»
- S4: «Probar con HTTP de prueba y transporte aislado renovación compartida, 401, arranque sin red, cierre/cambio durante ejecución y revocación tras reapertura. Distinguir fallo de red de cierre explícito; verificar ausencia de tokens persistidos y que acceso local nunca habilite drenaje remoto. La preparación ficticia habilita estos casos solo en el harness; G9/G11/V17 los acreditan con el flujo real.»
- S5: «Salida parcial: adaptación y pausa probadas con HTTP de prueba y transporte aislado; no habilita drenaje real ni acredita V09 completo.»

El contrato detallado de identidad local está en requirements.md §5 del mismo directorio de specs. No ampliar hacia G3, transporte real ni captura P5.

## Tasks

- T1 [S1,S3,S4,S5] delegated (context backstop): done (37/37 pruebas, lint y verifier independiente aprobados); ciclo P2, adaptador remoto y cancelación del motor con pruebas; commit: pendiente.
- T2 [S2,S3,S4,S5] delegated (context backstop): pending; habilitación local durable, navegación local separada y harness aislado, ADR/guía y pruebas; commit: pendiente.
- T3 [S1-S5] inline + independent verifier (Risk 2/4): pending; checks integrados, evaluación nativa, verificación y cierre; commit: pendiente.

## Log

- L7: `npm ci` exit 0, sin cambios package.json/lock; reporta 9 vulnerabilidades (no audit fix). Worker mvmwiuo2-2-jfyd completó T1: RED baseline 3 regresiones y RED 2 ACK; GREEN 37/37, lint 0, diferencial baseline/candidato preserva 23 pruebas anteriores. Padre repitió 37/37 exit 0. Verifier mvmwuvwd-3-p053: T1 aprobado sin blockers, baseline 23/23 y candidato 44/44 con sondas aisladas, lint 0. Cobertura local durable/navegación aún T2. Diff T1 405 añadidas/20 eliminadas: ligera superación por pruebas indivisibles de cancelación/ACK, sin compactar código. ASSESS preliminar no evaluable por untracked; shell gentle-ai no disponible (127); pendiente evaluación del commit con facade.

- L6: El usuario respondió «Procede» a restaurar dependencias con `npm ci`, sin modificar package.json/package-lock.json, y retomar comprobaciones. Instalación iniciada en segundo plano; no acredita todavía pruebas ni cierre de T1.

- L5: T1 writer mvmw7qbp-1-kyss ejecutado desde frontend. Cambió auth.ts/auth.spec.ts, modelos.ts, motor-sync.ts y añadió sesion-offline.ts/sesion-offline.spec.ts; adaptador remoto, eventos y cancelación generacional, sin transporte real. Pruebas enfocadas: exit 1 en ambos intentos, bundling falla con `Could not resolve "node_modules/maplibre-gl/dist/maplibre-gl.css"`; no RED conductual ni GREEN. Lint exit 0 y git diff --check exit 0; parent repitió diff --check exit 0 y npm ls maplibre-gl --depth=0 exit 1 (empty). Diferencial pendiente. ASSESS: nativeRisk unassessable por archivos untracked sin declarar; escalación item 4 exige verifier. Verifier/review/commits no ejecutados: primero falta prueba funcional, no se acredita T1 ni V09. Needs your decision: restaurar dependencias con npm ci para desbloquear comprobaciones; sin cambios a package.json/lock ni instalaciones durante este intento.

- L4: «Retoma odd/tasks/sesion-offline-p2.md». Sesión reanudada en frontend; rama feature/offline-sesion-p2 en e26db0e, sin cambios fuente. El usuario autorizó «Procede con la lectura» de specs/2026-10-05-offline-y-sincronizacion/ y docs/ del workspace (solo lectura). requirements §5 y G2 leídos; se reanuda T1 con el alcance original.

- L1: «Implementa el punto 2: Adaptar sesión disponible de P2 — habilitado del @specs/2026-10-05-offline-y-sincronizacion/plan.md. (Recuerda que codegraph se usa a nivel de proyecto no a nivel de raiz)»
- L3: Writer no iniciado: con workspace_root frontend devolvió `Writer bootstrap requires the original safe project root.`; sin selector devolvió `Writer repository preparation was unavailable or its session/target changed.` No se modificó código fuente ni se ejecutaron pruebas. Para continuar hace falta abrir la sesión con pf-puentes-frontend como raíz de trabajo y reanudar este documento. No hay herramienta Agent alternativa disponible.
- L2: Exploración read-only completada. Frontend limpio en develop e26db0e, rama feature creada. Codegraph CLI ejecutado dentro de frontend; consulta compuesta sin resultados útiles. Explorer usó lecturas al no poder seleccionar repositorio hijo. Políticas definidas por requirements §5, coordinación externa pendiente no equivale a decisión de producto abierta. Risk: item 2 (acceso local), item 4 (cancelación concurrente). Delegación por backstop explícito de contexto, tareas dependientes secuenciales.
