# 0003. Pipeline CI/CD por etapas en GitHub Actions

- Estado: aceptado
- Fecha: 03/10/2026
- Directriz o regla relacionada: DT-CAL-05, DT-CAL-06, DT-CAL-07

## Contexto

Cada PR debe compilar, probarse y pasar Prettier y ESLint. Solo hay dos ramas, `develop` y `main`.

## Decisión

El workflow `.github/workflows/ci-cd.yml` tiene cuatro jobs encadenados. Son los mismos que en el backend; solo cambian `build` y `test`.

| Job      | Qué hace                                                                                       |
| -------- | ---------------------------------------------------------------------------------------------- |
| `build`  | `npm ci`, `prettier --check`, `ng lint` y `ng build`                                           |
| `test`   | `ng test --watch=false` (Vitest)                                                               |
| `push`   | Publica o promueve la imagen en Docker Hub ([0004](0004-version-y-promocion-de-imagenes.md))   |
| `deploy` | Por SSH: actualiza el clon del entorno, escribe su `.env` y ejecuta `docker compose up --wait` |

| Evento             | Entorno |
| ------------------ | ------- |
| PR hacia `develop` | dev     |
| push a `develop`   | stage   |
| push a `main`      | prod    |
| PR hacia `main`    | solo CI |

## Consecuencias

- No se puede fusionar código sin formato ni lint (DT-CAL-07).
- Se usa ssh nativo, sin acciones de terceros con acceso a la llave, y hay un solo deploy por entorno a la vez.
- Los jobs `push` y `deploy` están copiados en los dos repos. Si se cambian, hay que cambiarlos en ambos.
