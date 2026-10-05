# 0005. Configuración por entorno con GitHub Environments

- Estado: aceptado
- Fecha: 03/10/2026
- Directriz o regla relacionada: DT-DEP-05

## Contexto

Cada entorno necesita su propio puerto y la referencia a la imagen. Los valores vienen de GitHub.

## Decisión

- Hay GitHub Environments `dev`, `stage` y `prod`. El job `deploy` genera el `.env` y lo copia al clon del entorno.
- Reglas de rama de cada Environment (Deployment branches and tags): `dev` sin restricción, `stage` solo `develop` y `prod` solo `main`.
- Los secretos de repositorio son los mismos que en el backend.

| Nivel       | Nombre                                  | Tipo    | Valor                                      |
| ----------- | --------------------------------------- | ------- | ------------------------------------------ |
| Repositorio | `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`   | secreto | Igual que en el backend                    |
| Repositorio | `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` | secreto | Usuario y PAT (Read & Write) de Docker Hub |
| Environment | `HTTPS_PORT`                            | secreto | `8082` (dev), `8081` (stage), `443` (prod) |

## Consecuencias

- El frontend no tiene secretos propios: todo lo sensible vive en el backend.
- Se crean como **secretos**, no como variables del Environment: el workflow solo lee `secrets.*`. Si `HTTPS_PORT` llega vacío, `compose.yaml` detiene el deploy; sin esa guarda, Compose publicaría el 8443 en un puerto al azar.
- Agregar una variable implica tocar `.env.example`, `compose.yaml`, el heredoc del workflow y los Environments.
- dev no puede limitarse a `develop`: sus deploys corren en `refs/pull/<n>/merge` y GitHub los rechaza (`Branch "refs/pull/1/merge" is not allowed to deploy to dev`). El workflow ya filtra qué PR despliega a dev (`github.base_ref == 'develop'`).
