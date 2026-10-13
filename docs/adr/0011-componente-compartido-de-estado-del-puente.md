# 0011. Componente compartido de estado del puente

- Estado: propuesto para revisión del equipo; componente implementado
- Fecha: 12/10/2026
- Reglas/directrices: RN-IC-04, RN-INV-09/10, DT-ARQ-06, DT-FE-02/03/05/12/13
- Historia: HU-P8-IC-02, componente frontend del contrato 10

## Contexto

P8 entrega a P3 un componente reutilizable para ficha, mapa y listados. Debe comunicar condición mediante texto y color con contraste AA; el estado autoritativo lo calcula el backend. P3 todavía no ha confirmado el contrato de datos de sus pantallas.

## Decisión

`shared/estado-puente/EstadoPuente` es standalone y tiene la entrada signal obligatoria `estado`: `BUENO | REGULAR | MALO | null`. Los tres valores coinciden con el enum existente del backend. La propuesta de entrada del componente usa `null` para un puente sin inspección publicada; no añade un estado persistido y debe confirmarse con P3 al adaptar su DTO. La entrada se refiere al componente, no define el formato de la API.

El componente muestra Bueno/verde, Regular/amarillo, Malo/rojo o Sin evaluar/gris. Los textos viven en `shared/textos.ts`. No recibe IC ni lo recalcula, de modo que un estado Malo por anulación conserva su visualización aunque el IC sea alto.

La etiqueta es texto normal accesible; el punto de color es decorativo y lleva `aria-hidden`. No es un botón ni introduce paradas de teclado. Texto y borde usan un color oscuro sobre fondo claro; contraste calculado sobre los valores del CSS: Bueno 6.49:1, Regular 8.07:1, Malo 6.80:1, Sin evaluar 9.37:1, superiores al mínimo 4.5:1 de texto normal. Estos valores no sustituyen la revisión de accesibilidad de las pantallas integradas.

## Uso para P3

Importar `EstadoPuente` en los `imports` del componente standalone consumidor:

```html
<app-estado-puente [estado]="estadoActual" /> <app-estado-puente [estado]="null" />
```

`estadoActual` tiene tipo `EstadoCondicion | null` (tipo exportado en `estado-puente.ts`). P3 debe suministrar el estado derivado de la inspección publicada. Mientras carga los datos, la pantalla debe gestionar la carga; `null` no significa petición en curso ni error HTTP. Se muestran siempre las etiquetas recibidas, sin clasificación numérica en frontend.

## Verificación y consecuencias

Pruebas DOM con las herramientas existentes de Angular: cuatro etiquetas/variantes, cambios de entrada, regreso a Sin evaluar y varias instancias independientes. Comando: `npm test -- --watch=false`.

Verificación del 12/10/2026: seis pruebas del componente y 24 casos unitarios de toda la aplicación aprobados; Prettier, ESLint y build de producción correctos. También pasaron los ocho escenarios Playwright del harness offline preexistente, como regresión del CI. No equivalen a pruebas de integración de IC con pantallas de inventario. La transferencia inicial estimada del build de producción fue 62.74 kB; el componente todavía no está integrado en una ruta de aplicación.

Falta que P3 confirme la entrada y lo integre en ficha, mapa y listados con datos reales, además de revisión y PR con CI verde. No se crean pantallas de inventario, rutas demo ni API para esta entrega del componente. HU-P8-IC-02 sigue en progreso.
