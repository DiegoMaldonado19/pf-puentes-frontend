# 0007. Imágenes base con versión fija

- Estado: aceptado
- Fecha: 03/10/2026
- Directriz o regla relacionada: DT-DEP-01

## Contexto

`latest` y los tags móviles hacen que dos builds del mismo código den imágenes distintas.

## Decisión

- Las imágenes y las actions van con versión exacta: `node:24.21.0-alpine` y `nginxinc/nginx-unprivileged:1.30.5-alpine` (rama estable de nginx), y las actions con su versión completa.
- El listado está en el README.

## Consecuencias

- Los builds son reproducibles, y actualizar una versión es un cambio explícito en un PR.
- Las actualizaciones de seguridad hay que revisarlas a mano.
