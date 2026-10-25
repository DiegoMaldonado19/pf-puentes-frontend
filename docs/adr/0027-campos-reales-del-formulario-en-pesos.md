# 0027 — Campos reales del formulario en pesos

Fecha: 24/10/2026. Estado: implementado. Trazabilidad: RN-IC-02/03, RN-USR-10, DT-FE-06/10/11.

## Decisión

En `/admin/pesos`, un panel desplegable permite consultar los campos de daño de cualquier versión P4, incluso sin juegos guardados. Reutiliza `FormularioService.listar` y su contrato `contenido/pagina/total_paginas`; el servicio P8 consulta referencias validadas por servidor en `GET /formularios/{id}/elementos-dano`, con contrato `content/page/total_pages`. No se extraen referencias del esquema en el navegador ni se mezclan ambos formatos de página.

El catálogo existente de versiones con pesos sigue separado y conserva su significado. El panel no pide UUID al usuario, precarga pesos, crea versiones ni escribe configuraciones. Se elige el código de la versión, incluido su estado; listado y campos se paginan. No implica disponibilidad de un cálculo oficial ni calibración académica.

El acceso usa la ruta/guardia administrativa, sesión e interceptores P2 existentes; el componente también evita consultas con un rol ajeno. Cambio de versión/página, recarga de versiones, pérdida de acceso y cierre del panel cancelan las consultas correspondientes y retiran datos previos. Se muestran carga, vacío y errores, con reintento de lectura. La pérdida de permiso devuelve un resultado local vacío sin pedir datos al servidor y cancela la petición anterior; no se interpreta ese resultado como ausencia real de campos.

La creación sigue pendiente de las decisiones que el usuario prefirió consultar al grupo: completitud del juego y relación con versiones publicadas. El backend vuelve a autorizar y validar cada consulta; no se modifica la administración P4 ni la sesión offline P2/P6.

## Verificación

Casos DOM/HTTP para selección sin pesos, históricos, paginación, cancelación/contexto, errores, reintentos, roles y panel integrado con Bearer P2. El recorrido Playwright añade la lectura de los 19 campos de la semilla real a través de login/API/BD reales; resultados finales en los README de los repositorios.
