# 0004. Versión y promoción de imágenes por contenido

- Estado: aceptado
- Fecha: 03/10/2026
- Directriz o regla relacionada: DT-DEP-06

## Contexto

La imagen se construye una sola vez, se identifica con el número de build y se promueve de dev a stage y a prod sin reconstruirla.

## Decisión

Es el mismo mecanismo que en el backend (su ADR 0003):

- la identidad de la imagen es el árbol git;
- cada imagen se publica con `:<run_number>` y `:tree-<hash>`, y con el label `org.opencontainers.image.version`;
- si el árbol ya tiene imagen, se promueve;
- si no, se construye, salvo en prod, donde el job falla.

## Consecuencias

- Es posible porque la imagen no lleva configuración por entorno ([0001](0001-spa-sin-ssr-servida-por-nginx.md)).
- prod corre los mismos bytes que stage, y un hotfix directo a `main` tiene que pasar antes por `develop`.
