# 0025. Consulta administrativa de pesos con sesión P2

- Fecha: 23/10/2026
- Estado: implementado; resultados locales en README
- Trazabilidad: HU-P8-IC-04, RN-IC-03, DT-FE-02/03/04/05/06/10/11

## Decisión

`/admin/pesos` carga `AccesoPesos` de forma diferida bajo la guardia Administrador del padre P2. El menú ofrece el enlace solo a ese rol; la autorización efectiva sigue en backend. El host comprueba sesión hidratada, token/usuario y rol antes de montar las consultas. Al perder acceso retira datos y cancela lecturas.

El nuevo GET P8 `/api/v1/juegos-pesos/formularios` entrega referencias paginadas de versiones con pesos guardados. Permite seleccionar por código sin pedir UUID manual ni sustituir el futuro catálogo/motor de P4. No expone esquema, mapeo, versiones activas supuestas o datos ficticios.

La selección alimenta `ConsultaPesos`, que mantiene juegos por versión, acta/vigencia, selección explícita y elementos paginados. Cambiar de versión, página o recargar retira la selección anterior; las lecturas obsoletas se cancelan. El catálogo distingue carga, vacío, error y acceso denegado; el estado se gestiona con signals y el transporte con los interceptores P2. No se guardan tokens fuera de memoria ni se calcula IC localmente.

## Uso y límites

Con backend y frontend levantados, entrar como Administrador y pulsar **Pesos del índice de condición** en el menú, o abrir `/admin/pesos`. Seleccionar código de versión y después **Ver pesos** en un juego. Sin configuraciones guardadas se muestra un vacío real; no se crean versiones/juegos para llenar la pantalla. Crear/calibrar pesos sigue esperando metadatos P4 y acuerdos correspondientes; esta consulta no acredita calibración ni cierra IC-04 completa.

Pruebas DOM/HTTP con AuthService/interceptor/guardia reales y respuestas controladas: versión → juego → elementos, paginación, cambio de contexto/cancelación, vacío, reintento, sesión perdida, 403, bloqueo de otros roles y guardia del padre. Se actualizan las expectativas de navegación de App y de rutas P2 para incluir la nueva opción conservando las anteriores. No acredita CI remoto ni navegador contra backend real.
