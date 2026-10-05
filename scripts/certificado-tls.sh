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

# Como 101:101, el usuario de nginx-unprivileged: así nginx puede leer la llave.
# Se monta en /tls porque en la imagen /lego es el ejecutable.
lego() {
  docker run --rm -u 101:101 -e DUCKDNS_TOKEN -v "$TLS:/tls" goacme/lego:v4.35.2 \
    --path /tls "$@"
}

# El host no ve dentro de la carpeta (lego la deja en 700); se lo pregunta a lego.
# Si esto falla, set -e corta: nunca se pide un certificado nuevo por error.
certificados=$(lego list)
case "$certificados" in
  *"$DOMINIO"*) accion=renew ;;
  *) accion=run ;;
esac
lego --accept-tos --email "$CORREO_TLS" --dns duckdns --domains "$DOMINIO" "$accion"

docker ps -q --filter label=com.docker.compose.service=frontend |
  xargs -r -I{} docker exec {} nginx -s reload
