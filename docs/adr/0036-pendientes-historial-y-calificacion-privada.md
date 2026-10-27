# 0036. Pendientes, historial y calificación privada

- Fecha: 27/10/2026.
- Estado: aceptado para el incremento de seguimiento.
- Reglas: RN-REV-05/06/07/08.

`/mis-revisiones` usa la guardia de Estudiante y muestra pendientes emitidos junto con el catálogo paginado de sus inspecciones con ciclos. El catálogo no desaparece al resolver el último pendiente. `/historial-revisiones/:inspeccionId` requiere sesión y delega la autorización por fila al backend. El detalle del revisor también incorpora el historial sin sustituir ciclos anteriores.

Resolver declara que el autor ya corrigió su borrador; no edita datos, no reenvía ni altera la máquina de estados. Solo se ofrece la acción para BORRADOR. Durante el PATCH se bloquean nuevas resoluciones y la lista se recarga tras éxito. La fecha se conserva y los estados terminales permanecen consultables.

La calificación se solicita por el endpoint privado de cada ciclo, nunca se toma del historial genérico. Un 404 de nota privada no rompe la consulta del resto del historial. El autor tiene lectura; solo el detalle del revisor presenta edición opcional con rango/precisión y retiro mediante null. Las respuestas tardías se descartan al cambiar de contexto o cerrar sesión.

Los avisos del job aparecen en la campana compartida y conducen a la bandeja existente. No se implementa otro sistema de notificaciones. Se mantienen la paleta azul/slate, textos centralizados y las pantallas de autenticación del proyecto.
