# 0037. Bandeja protegida e inicio de revisión

- Estado: aceptado para el incremento de bandeja/apertura.
- Fecha: 27/10/2026.
- Renumeración: desde 0034 para conservar el ADR de Cursos integrado en develop.
- Reglas: RN-REV-01/03 y DT-SEC-04.

`/revisiones` es una ruta diferida para Catedrático, protegida por `rolGuard`, con enlace en la cabecera por rol. Usa la sesión y los interceptores existentes; no persiste credenciales. Consume el GET paginado y el POST de apertura del backend, sin inferir autorizaciones por nombres ni datos del navegador.

El filtro de estado reinicia la página y cancela la lectura anterior. Mientras abre un ciclo se bloquean acciones que puedan duplicar o alterar la selección; el POST no se reintenta por conflictos ni fallos de red. Cambiar identidad o perder permiso limpia resultados y descarta respuestas tardías. La apertura confirmada muestra el identificador del ciclo y recarga la bandeja.

El editor de evidencia/veredictos pertenece al siguiente incremento. No se crea una ruta de detalle ficticia ni se presenta el inicio como aprobación/publicación. Se usa la paleta azul/slate y los componentes standalone del proyecto. Los textos se centralizan en `TEXTOS.revision`.
