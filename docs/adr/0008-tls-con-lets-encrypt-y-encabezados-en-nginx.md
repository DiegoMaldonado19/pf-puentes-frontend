# 0008. TLS con Let's Encrypt y encabezados de seguridad en nginx

- Estado: aceptado
- Fecha: 04/10/2026
- Directriz o regla relacionada: DT-DEP-04, DT-SEC-10, DT-SEC-11, DT-DEP-02

## Contexto

Sin HTTPS no funcionan el service worker, la cookie `Secure` del token de renovación, el GPS ni `storage.persist()`. Además, DT-DEP-04 y DT-SEC-10 lo exigen. Los tres entornos comparten una EC2 y el dominio gratuito `pf-puentes.duckdns.org`. DuckDNS guarda un solo registro TXT por dominio.

## Decisión

- **Un solo certificado** de Let's Encrypt para `pf-puentes.duckdns.org`. Cada entorno atiende https en su propio puerto:
  - prod en el 443, y además el 80, que solo redirige (`compose.prod.yaml`);
  - stage en el 8081;
  - dev en el 8082.

  Un certificado sirve en cualquier puerto.

- **Emisión y renovación:** se valida por DNS-01 con **lego** (`goacme/lego`, versión fija), que trae DuckDNS de serie. certbot necesitaría un plugin de terceros.
  - `scripts/certificado-tls.sh` corre en el host, una vez a mano y después desde el cron.
  - lego corre como `101:101`, el usuario de nginx-unprivileged, para que nginx pueda leer la llave.
- **`http://` al puerto de https** vuelve como `https://` al mismo puerto (`error_page 497`).
- **Todos los encabezados de seguridad viven en nginx:** HSTS, CSP, `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy`.
  - `add_header_inherit merge` los agrega también a los `location` que definen su caché.
  - En `/api/` se ocultan los que manda Spring Security, para no duplicarlos.
- **CSP base:** `default-src 'self'`.
  - `style-src` permite `'unsafe-inline'` porque Angular inyecta los estilos de los componentes.
  - El build no hace `inlineCritical`, porque su `onload` en línea sería bloqueado.

## Consecuencias

- Un solo certificado y ningún proxy adicional; el `compose.yaml` es el mismo en los tres entornos.
- Si el cron deja de correr, el certificado vence en unos 90 días. Hay que revisar `~/puentes/tls-renovacion.log`.
- Un feature que use un origen externo (p. ej. mosaicos del mapa) tiene que agregarlo a la CSP en `nginx.conf`.
- Para migrar al servidor de la universidad con su dominio, se cambian el `DOMINIO` del script y las dos rutas `ssl_certificate*`.
- El security group abre además el 443.
