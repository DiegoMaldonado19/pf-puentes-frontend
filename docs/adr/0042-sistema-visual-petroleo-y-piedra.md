# 0042 — Sistema visual "Petróleo y piedra"

- Estado: aceptado.
- Fecha: 11/11/2026.
- Revisa: [0011](0011-componente-compartido-de-estado-del-puente.md) y el kit `hvc-*` existente.

## Contexto

La interfaz usaba azul marino con naranja y tenía el chrome oscuro. El texto de las tarjetas
dentro de la barra superior heredaba el color claro, y el texto secundario tenía poco
contraste. Las pantallas fijaban colores de Tailwind (`text-slate-600`, `bg-emerald-50`, …),
así que cualquier cambio de paleta exigía tocar muchos archivos.

## Decisión

- **Tokens únicos.** Todo color sale de `src/styles.css`: primario petróleo (700/800/900 y
  tintes), neutros piedra (lienzo, superficie, bordes, textos) y estados (bueno, regular,
  malo, info, sin evaluar), cada uno con texto, tinte y sólido.
- **Chrome claro.** Barra superior y menú lateral sobre superficie blanca, con texto oscuro y
  activo en `#E6F2F0` con indicador `#7FD1C7`.
- **Kit sin estilos por feature.** `src/styles/components.css` define botones, campos, tarjetas,
  tablas, insignias, avisos, pestañas, modal, toasts, encabezado de página y el shell. Las
  pantallas usan clases del kit y utilidades con los tokens nuevos.
- **Tabla responsiva.** Bajo 640 px, `.hvc-tabla-responsiva` convierte cada fila en tarjeta y
  cada celda muestra su etiqueta desde `data-etiqueta`.
- **Menú agrupado.** El cajón del menú pasa a 1023 px. Los grupos son Inicio, Puentes,
  Inspecciones, Mantenimiento y Administración.
- **Prohibido el `dark:`.** Sin modo oscuro: la variante por defecto de Tailwind seguiría al
  sistema operativo, así que se quitó `@custom-variant dark`.

## Consecuencias

- Cambiar la paleta es editar una sola vez `styles.css`.
- Los contrastes de texto sobre los tintes de estado superan 4.5:1. Los sólidos llevan texto
  blanco. Falta la auditoría automática con axe.
- Quedan por migrar a tokens 13 hojas heredadas por feature (`cursos.css`,
  `mantenimiento/*.css`, `consulta-pesos.css`, …): usan variables nuevas, pero no se han
  integrado todavía al kit.
