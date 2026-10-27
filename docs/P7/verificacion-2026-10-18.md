# P7 — Verificación del frontend, 18/10/2026

Entorno: Node **24.22.0**, npm del runtime temporal en `/tmp/opencode/p7-runtime`. No se cambió el runtime del sistema, el lockfile ni las dependencias.

| Chequeo                      | Resultado                                       |
| ---------------------------- | ----------------------------------------------- |
| `npx ng test --watch=false`  | **58 pruebas**, 7 archivos, todas correctas     |
| `npm run build`              | Correcto                                        |
| `npm run build:base-offline` | Correcto; conserva la compilación de la base P6 |
| `npm run lint`               | Correcto                                        |
| `npx prettier --check .`     | Correcto                                        |

Se comprueban la regresión de textos compartidos, restauración antes de autorizar, entrada por rol, limpieza por pérdida de identidad/permisos y ausencia de Authorization/reintentos duplicados al conectar P2. Los proveedores/interceptor de P2 usados en pruebas son dobles exclusivos de pruebas, no código de autenticación de producción.

**Límite:** AuthService e interceptores reales siguen pendientes de P2. No se ha probado ni se declara terminado el recorrido de autenticación/renovación automático completo en un navegador. P7 entrega el puerto y sus pruebas de consumidor, no una sesión ficticia ni un servicio alternativo.

Contrato: [integración de sesión](integracion-sesion.md). Decisión: [ADR 0033](../adr/0033-integracion-de-sesion-en-cursos.md), renumerado posteriormente.
