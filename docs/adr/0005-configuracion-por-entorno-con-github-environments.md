# 0005. Configuración por entorno con GitHub Environments

- Estado: aceptado
- Fecha: 03/10/2026
- Directriz o regla relacionada: DT-DEP-05

## Contexto

Cada entorno necesita su propio puerto y la referencia a la imagen. Los valores vienen de GitHub.

## Decisión

- Hay GitHub Environments `dev`, `stage` y `prod`. El job `deploy` genera el `.env` y lo copia al clon del entorno.
- Los secretos de repositorio son los mismos que en el backend.

| Nivel       | Nombre                                  | Tipo    | Valor                                      |
| ----------- | --------------------------------------- | ------- | ------------------------------------------ |
| Repositorio | `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`   | secreto | Igual que en el backend                    |
| Repositorio | `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` | secreto | Usuario y PAT (Read & Write) de Docker Hub |
| Environment | `HTTP_PORT`                             | secreto | `8082` (dev), `8081` (stage), `80` (prod)  |

## Consecuencias

- El frontend no tiene secretos propios: todo lo sensible vive en el backend.
- Agregar una variable implica tocar `.env.example`, `compose.yaml`, el heredoc del workflow y los Environments.
