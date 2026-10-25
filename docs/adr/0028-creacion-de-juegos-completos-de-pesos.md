# 0028 — Creación de juegos completos de pesos

Fecha: 25/10/2026. Estado: implementado. Trazabilidad: RN-IC-03/08, RN-USR-10 y DT-FE-06/10/11. Política y autorización documentadas en backend [ADR 0040](../../../pf-puentes-backend/docs/adr/0040-creacion-completa-y-versionada-de-pesos.md).

## Decisión

Se amplía el panel de campos reales de `/admin/pesos` con **Configurar nuevo juego de pesos**, disponible para Administrador. Usa versión seleccionada desde P4, sesión/interceptores/guardia P2 y el POST real P8. No agrega autenticación ni almacenamiento offline de estas configuraciones.

El editor obtiene todas las páginas de referencias validadas por servidor (100 por página), detecta duplicados entre páginas y no ofrece una configuración parcial. Cada campo se muestra sin peso precargado; debe introducirse un valor positivo de hasta 999.999 y tres decimales. Acta opcional de hasta 300 caracteres Unicode: vacía se envía como null y se informa que el juego es provisional; una referencia escrita no acredita firma/calibración.

Mientras el POST está pendiente se deshabilitan formulario, cierre del editor/panel, selección/páginas/recarga de contexto y salida mediante `canDeactivate` en la ruta de pesos. El backend siempre vuelve a autorizar/validar. Confirmado el 201, se cierra el editor, se actualiza el catálogo de versiones con pesos y se monta la consulta de juegos de la versión; conserva los anteriores. No activa automáticamente un juego para publicar ni cambia resultados históricos.

400 permite corregir sin reintento automático. 401/403 bloquean el envío; 404/422 requieren volver a cargar campos. Error de red/5xx o resultado desconocido bloquea el reenvío y explica que se consulten los juegos guardados antes de abrir otra configuración. No hay cola offline ni reintento automático del POST por parte de este componente. La renovación de autenticación conserva el comportamiento global P2.

La autorización del responsable P8 para completitud/versiones está en el ADR backend compartido, no en documentación privada. La calibración académica y la selección del juego por P5 siguen pendientes; creación funcional no equivale a cerrar todo IC-04.

## Verificación

Pruebas DOM/HTTP de límites, campos vacíos, provisionales, errores y doble envío; integración con Bearer real del interceptor P2, guardia y recargas después del guardado. Playwright crea dos juegos completos contra backend/PostgreSQL reales y permite consultarlos después de recargar. Resultados finales en README.
