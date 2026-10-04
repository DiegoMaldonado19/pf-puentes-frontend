#!/bin/sh
# DT-DEP-04: emite o renueva el certificado de Let's Encrypt por DNS de DuckDNS y recarga los nginx.
# Una vez a mano y después desde el cron del host (README, ADR 0008).
# Lee DUCKDNS_TOKEN y CORREO_TLS de ~/puentes/duckdns.env.
set -eu

DOMINIO=pf-puentes.duckdns.org
TLS="$HOME/puentes/tls"
set -a
. "$HOME/puentes/duckdns.env"
set +a

# Como 101:101, el usuario de nginx-unprivileged: así nginx puede leer la llave
lego() {
  docker run --rm -u 101:101 -e DUCKDNS_TOKEN -v "$TLS:/lego" goacme/lego:v4.35.2 \
    --path /lego "$@"
}

# El host no ve dentro de la carpeta (lego la deja en 700); se lo pregunta a lego
accion=run
lego list | grep -q "$DOMINIO" && accion=renew
lego --accept-tos --email "$CORREO_TLS" --dns duckdns --domains "$DOMINIO" "$accion"

docker ps -q --filter label=com.docker.compose.service=frontend |
  xargs -r -I{} docker exec {} nginx -s reload
