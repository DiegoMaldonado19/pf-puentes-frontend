# 0002. Despliegue en EC2

- Estado: aceptado
- Fecha: 03/10/2026
- Directriz o regla relacionada: DT-DEP-01, DT-DEP-02, DT-DEP-06, pendiente #15

## Contexto

Los tres entornos (dev, stage y prod) viven en una sola EC2 junto al backend: ver el ADR 0001 del backend. Solo nginx puede publicar puertos.

## Decisión

- Cada entorno tiene su clon en `~/puentes/<entorno>/pf-puentes-frontend`, su proyecto Compose `puentes-<entorno>-frontend` y su `.env`.
- El contenedor se une a la red externa `puentes-<entorno>`, donde vive el backend del mismo entorno.
- El puerto del host sale de `HTTPS_PORT`: 8082 en dev, 8081 en stage y 443 en prod. Prod publica además el 80 para redirigir a https ([0008](0008-tls-con-lets-encrypt-y-encabezados-en-nginx.md)).

## Consecuencias

- Cada entorno se abre en `https://pf-puentes.duckdns.org:<puerto>` (prod sin puerto) y no ve el backend de otro entorno.
- Frontend y backend se despliegan por separado. El pipeline crea la red si no existe, así que el orden no importa.
- Con el dominio se eligió un puerto por entorno con TLS en cada nginx, en lugar de un proxy con subdominios ([0008](0008-tls-con-lets-encrypt-y-encabezados-en-nginx.md)).
