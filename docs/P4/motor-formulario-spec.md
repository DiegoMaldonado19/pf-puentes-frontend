# Especificación Técnica: Componente `<app-motor-formulario>` (Contrato 7)

- **Dueño:** P4 (Motor de Formularios y Versionado)
- **Consumidores:** P5 (Inspecciones), P7 (Revisión Docente), P9 (Foro), Impresión / Reportes
- **Fecha de Congelamiento:** 07/10 (H1) — _Actualizado con mejoras de dinamismo de Hito P4_
- **Estado:** 🔒 CONGELADO

---

## 1. Firma del Componente

```typescript
@Component({
  selector: 'app-motor-formulario',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ControlDanoComponent],
  templateUrl: './motor-formulario.html',
})
export class MotorFormularioComponent implements OnInit, OnChanges, OnDestroy {
  /** Esquema JSON Schema oficial (versión activa o histórica) */
  @Input({ required: true }) esquema!: EsquemaFormulario;

  /** Respuestas capturadas en la inspección (JSONB) */
  @Input() datos: Record<string, any> = {};

  /** Modo de operación: 'edicion' permite interactuar; 'lectura' deshabilita controles */
  @Input() modo: ModoFormulario = 'edicion';

  /** Errores autoritativos del backend RFC 7807 indexados por ruta de campo */
  @Input() erroresServidor: Record<string, string> = {};

  /** Emite el estado reactivo actualizado de las respuestas mediante getRawValue() */
  @Output() datosChange = new EventEmitter<Record<string, any>>();

  /** Emite si el formulario cumple todas las validaciones de conveniencia en cliente */
  @Output() validoChange = new EventEmitter<boolean>();

  /** Formulario reactivo generado */
  formGroup: FormGroup = new FormGroup({});

  /** Métodos públicos para interacción de plantilla */
  cambiarSeccion(index: number): void;
  marcarSinDanos(seccionClave: string, grupo?: string): void;
  agregarFilaArray(seccionClave: string): void;
  eliminarFilaArray(seccionClave: string, index: number): void;
}
```

---

## 2. Mapeo: JSON Schema ➔ Controles de Angular

El input `impresion` renderiza todas las secciones con los mismos controles, datos y
esquema congelado. Captura lo activa antes de `window.print()` y restaura la pestaña
activa al terminar; no cambia el modo `lectura` ni crea otro editor. La prueba del motor
comprueba ocho secciones imprimibles y la de captura comprueba el modo durante la llamada.

Revisión de restricciones del esquema SIECA distribuido en
`pf-puentes-backend/src/main/resources/formulario/formulario-sieca-v1.json`: utiliza
`required`, `minimum`, `maximum`, tipos y `enum`, ya cubiertos por el motor. No declara
`minLength`, `maxLength`, `pattern`, `format` ni límites de arrays; no se añaden reglas
cliente inventadas para esas restricciones.

| Tipo en JSON Schema     | Metadatos Adicionales                          | Control Angular Generado                                         | Validadores / Comportamiento                                                                            |
| ----------------------- | ---------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `object`                | —                                              | `FormGroup` anidado                                              | Subagrupación por `x-grupo`                                                                             |
| `array` (e.g. `tramos`) | `items.properties`                             | `FormArray<FormGroup>` dinámico                                  | Tarjetas repetibles, botones agregar/eliminar, renumeración automática de `numero_tramo`                |
| `string`                | `enum: [...]`                                  | `<select>` desplegable accesible                                 | `Validators.required`                                                                                   |
| `string`                | `format: "date"`                               | `<input type="date">`                                            | `Validators.required`                                                                                   |
| `string`                | Clave contiene `observacion` o `recomendacion` | `<textarea rows="3">` multilínea                                 | `required`, `maxLength`                                                                                 |
| `string`                | General                                        | `<input type="text">`                                            | `required`, `pattern`, `maxLength`                                                                      |
| `integer`               | `x-dano: true` (0 a 4)                         | **`<app-control-dano>`** (Grilla táctil de 5 botones ≥ 44×44 px) | `Validators.min(0)`, `Validators.max(4)`. Incluye badge preventivo si posee `x-anulacion-critica: true` |
| `number` / `integer`    | `x-unidad: "m" \| "km"`                        | `<input type="number">` con sufijo                               | `min`, `max`, padding derecho `pr-12`                                                                   |
| `boolean`               | —                                              | `<input type="checkbox">`                                        | —                                                                                                       |

---

## 3. Comportamientos Dinámicos Específicos

### 3.1 Soporte para Secciones Array (`tramos`)

El manual regional SIECA modela los claros del puente como una lista dinámica en la Sección 3.

- Si `seccion.tipo === 'array'`, el motor inicializa un `FormArray<FormGroup>`.
- En modo `'edicion'`, provee un botón `+ Agregar Tramo` y botones `Eliminar Tramo` individuales (deshabilitado si solo queda 1 tramo).
- Al agregar o eliminar un tramo, `numero_tramo` se renumera correlativamente en todos los elementos.

### 3.2 Ordenamiento Canónico de Pestañas (`calcularOrdenSeccion`)

La columna `jsonb` de PostgreSQL reordena las claves del objeto sin conservar el orden de inserción. Para evitar pestañas desordenadas:

1. Prioridad 1: Valor numérico explícito en `x-orden` a nivel de sección (`x-orden: 1..8`).
2. Prioridad 2: Expresión regular sobre `title` (e.g., `"Sección 3: ..."` ➔ `3`).
3. Prioridad 3: Array canónico fallback: `['identificacion', 'datos_generales', 'tramos', 'subestructura', 'superestructura', 'elementos_no_estructurales', 'caracteristicas_cauce', 'otros']`.

### 3.3 Agrupación Granular y Botón "Sin daños en este elemento" (`RN-INS-11`)

En lugar de una única acción por sección, las secciones con daños agrupan sus campos por `x-grupo`:

- `estribos`, `pilas`, `cimentacion` (Subestructura)
- `vigas`, `losa`, `juntas`, `apoyos` (Superestructura)
- `seguridad_vial`, `aceras`, `drenajes` (Elementos No Estructurales)
- `hidraulica` (Cauce)

Cada grupo renderiza su encabezado descriptivo y un botón individual "Sin daños en este elemento" que asigna `0` a todos los controles con `x-dano: true` pertenecientes a ese grupo específico.

### 3.4 Insignia de Anulación Crítica (`x-anulacion-critica`)

Para asistir al inspector y alinearse con las reglas de P8 (Índice de Condición), los campos con `x-anulacion-critica: true` despliegan una insignia visual destacada de advertencia (`rose-100`) indicando que un daño severo en dicho elemento fuerza la condición global del puente a "Malo".

### 3.5 Preservación de Datos con `formGroup.getRawValue()`

En Angular Reactive Forms, `formGroup.value` omite automáticamente los campos deshabilitados (`disabled: true`). Debido a que los campos de inventario permanente (P3) se marcan como `readOnly: true` / `disabled: true`, el motor emite siempre `this.formGroup.getRawValue()` para garantizar que los datos del puente persistan íntegros en las emisiones de `(datosChange)`.

---

## 4. Ranuras de Anclaje por `elemento_ref`

El componente provee ranuras (slots) dinámicas junto a cada control o grupo para que los módulos consumidores incrusten marcadores o información contextual sin acoplarse:

```html
<!-- Estructura simplificada del template -->
<div class="campo-contenedor" [attr.data-elemento-ref]="elementoRef">
  <label [for]="idControl">{{ pregunta.title }}</label>

  <!-- Renderizado del control dinámico -->
  <ng-container [ngSwitch]="tipoControl"> ... </ng-container>

  <!-- Ranura de anclaje contextual -->
  <div class="ranura-anclaje">
    <ng-content select="[slot=anclaje]" />
    <!-- 
      P1 proyecta: <app-captura-foto [elementoRef]="..." />
      P7 proyecta: <app-marcador-revision [elementoRef]="..." />
      P9 proyecta: <app-marcador-foro [elementoRef]="..." />
    -->
  </div>
</div>
```

---

## 5. Comportamiento en Modo Sin Conexión (Offline - P6)

- El componente es **100% agnóstico de la red**. Recibe el `esquema` y los `datos` vía `@Input()`.
- Cuando el usuario ejecuta "Preparar salida" (`RN-OFF-01`), el servicio de P6 almacena en Dexie (`db.formularios.put(esquemaActivo)`).
- Al abrir una inspección en campo sin internet, el contenedor pasa el esquema local al `<app-motor-formulario>`.
- El motor emite `(datosChange)` que el contenedor persiste en la cola local de Dexie con cada modificación.
