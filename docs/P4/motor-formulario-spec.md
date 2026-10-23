# Especificación Técnica: Componente `<app-motor-formulario>` (Contrato 7)

* **Dueño:** P4 (Motor de Formularios y Versionado)
* **Consumidores:** P5 (Inspecciones), P7 (Revisión Docente), P9 (Foro), Impresión / Reportes
* **Fecha de Congelamiento:** 07/10 (H1)
* **Estado:** 🔒 CONGELADO

---

## 1. Firma del Componente

```typescript
@Component({
  selector: 'app-motor-formulario',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './motor-formulario.html'
})
export class MotorFormularioComponent implements OnChanges {
  /** Esquema JSON Schema oficial (versión activa o histórica) */
  @Input({ required: true }) esquema!: any;

  /** Respuestas capturadas en la inspección (JSONB) */
  @Input() datos: Record<string, any> = {};

  /** Modo de operación: 'edicion' permite interactuar; 'lectura' deshabilita controles */
  @Input() modo: 'edicion' | 'lectura' = 'edicion';

  /** Emite el estado reactivo actualizado de las respuestas */
  @Output() datosChange = new EventEmitter<Record<string, any>>();

  /** Emite si el formulario cumple todas las validaciones de conveniencia en cliente */
  @Output() validoChange = new EventEmitter<boolean>();

  /** Formulario reactivo generado */
  formGroup: FormGroup = new FormGroup({});
}
```

---

## 2. Mapeo: JSON Schema ➔ Controles de Angular

| Tipo en JSON Schema | Metadatos Adicionales | Control Angular Generado | Validadores Aplicados |
|---|---|---|---|
| `object` | — | `FormGroup` anidado | — |
| `array` | — | `FormArray` | `minItems`, `maxItems` |
| `string` | `enum: [...]` | `<select>` o radio buttons | `Validators.required` |
| `string` | `format: "date"` | `<input type="date">` | `Validators.required` |
| `string` | — | `<input type="text">` | `required`, `pattern`, `maxLength` |
| `integer` | `x-dano: true` (0 a 4) | **Grilla táctil de 5 botones ≥ 44×44 px** | `Validators.min(0)`, `Validators.max(4)` |
| `number` / `integer` | — | `<input type="number">` | `min`, `max` |
| `boolean` | — | `<input type="checkbox">` o switch | — |

---

## 3. Ranuras de Anclaje por `elemento_ref`

El componente provee ranuras (slots) dinámicas junto a cada control o grupo para que los módulos consumidores incrusten marcadores o información contextual sin acoplarse:

```html
<!-- Estructura simplificada del template -->
<div class="campo-contenedor" [attr.data-elemento-ref]="elementoRef">
  <label [for]="idControl">{{ pregunta.title }}</label>
  
  <!-- Renderizado del control dinámico -->
  <ng-container [ngSwitch]="tipoControl">
    ...
  </ng-container>

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

## 4. Comportamiento en Modo Sin Conexión (Offline - P6)

* El componente es **100% agnóstico de la red**. Recibe el `esquema` y los `datos` vía `@Input()`.
* Cuando el usuario ejecuta "Preparar salida" (`RN-OFF-01`), el servicio de P6 almacena en Dexie (`db.formularios.put(esquemaActivo)`).
* Al abrir una inspección en campo sin internet, el contenedor pasa el esquema local al `<app-motor-formulario>`.
* El motor emite `(datosChange)` que el contenedor persiste en la cola local de Dexie con cada modificación.
