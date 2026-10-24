# Manual Técnico de P4 (Frontend) — Motor de Formularios y Versionado

Ubicación del módulo: `src/app/features/formulario`.  
Reglas de negocio asociadas: **RN-FRM-01**, **RN-FRM-05**, **RN-FRM-07**, **RN-FRM-08**.  
Directrices técnicas: **DT-FE-07** (generación dinámica desde JSON Schema), **DT-FE-08** (`ReactiveFormsModule` dinámico), **DT-FE-09** (controles táctiles ≥ 44×44 px), **DT-FE-12** (`textos.ts`), **DT-OFF-01**.  
📋 **Guía de Verificación Interactiva con Casillas y Payloads:** [docs-analisis/guia-interaccion-y-pruebas-p4.md](../../../docs-analisis/guia-interaccion-y-pruebas-p4.md).

---

## 1. Responsabilidad y Arquitectura del Módulo

El módulo de Frontend de P4 resuelve el desafío central de la evaluación: **el formulario SIECA no está escrito como HTML estático**. Se genera dinámicamente en tiempo de ejecución a partir del JSON Schema provisto por el backend.

```
                  JSON Schema (Backend / Cache Dexie)
                                  │
                                  ▼
                    ┌───────────────────────────┐
                    │  <app-motor-formulario>   │
                    │   - ReactiveFormsModule   │
                    │   - FormGroup dinámico    │
                    └─────────────┬─────────────┘
                                  │
                ┌─────────────────┴─────────────────┐
                ▼                                   ▼
        [modo]="'edicion'"                  [modo]="'lectura'"
     - Inputs habilitados                - Controles deshabilitados
     - Grilla táctil 0-4 (≥44px)        - Resumen estilizado
     - Validaciones reactivas            - Consulta histórica (RN-FRM-05)
     - Botón "Sin daños en elemento"     - Impresión y exportación
```

---

## 2. Componentes Principales

### 2.1 Componente Central: `<app-motor-formulario>` (Contrato 7)
Componente reutilizable en `src/app/features/formulario/motor-formulario/`:
* Usado por **P5 (Inspecciones)** en modo `'edicion'` para levantar evaluaciones en campo.
* Usado por **P7 (Revisión)**, **P9 (Foro)** e impresión en modo `'lectura'` para auditoría y visualización.
* **Soporte Dinámico de Listas (`FormArray`):** Procesa secciones de tipo arreglo (como Sección 3 de Tramos Individuales), permitiendo agregar y eliminar tramos dinámicamente con renumeración correlativa automática.
* **Ordenamiento Canónico de Pestañas:** Implementa `calcularOrdenSeccion()` para garantizar la secuencia estricta 1 a 8 independientemente de la reordenación interna de PostgreSQL `jsonb`.
* **Emisión Íntegra:** Emite `formGroup.getRawValue()` para que los campos de inventario permanente (P3) deshabilitados permanezcan en el objeto final.

### 2.2 Vistas Administrativas del Formulario
* **Navegación:** Enlace directo **Formularios** en la cabecera principal (`app.html`), visible exclusivamente para usuarios con rol `ADMINISTRADOR`.
* **Listado de Versiones (`/admin/formularios`):** Visualización reactiva con `signal()` de versiones vigentes (`ACTIVA`), borradores (`BORRADOR`) y retiradas (`RETIRADA`). Incluye botón de publicación rápida de borradores.
* **Editor de Esquemas (`/admin/formularios/nuevo` y `/admin/formularios/:id/editar`):**
  * **Validación de sintaxis en tiempo real:** Evaluación reactiva continua en cada pulsación (`(ngModelChange)="validarSintaxis($event)"`) en el `<textarea>` del JSON Schema. Provee retroalimentación visual inmediata con mensaje descriptivo de la falla (`errorSintaxis`), contorno de advertencia (`border-rose-500`) e insignia de confirmación (`✓ Sintaxis JSON válida`) al normalizarse. Deshabilita reactivamente los botones "Guardar borrador" y "Publicar como ACTIVA" mientras persistan errores sintácticos.
  * **Precarga oficial:** Carga automática del esquema activo oficial (V1.0.0 con 8 secciones) al inicializar nuevas versiones.
  * **Publicación inmutable directa:** Modal de mapeo de campos (`RN-FRM-06`) integrado desde la barra superior de acciones.
  * **Vista Previa en Vivo:** Pestaña interactiva sincronizada que compila el esquema y lo renderiza mediante `<app-motor-formulario>`, exigiendo sintaxis válida previa.
* **Modal de Publicación (`modal-publicar.ts`):** Confirmación de inmutabilidad y declaración de equivalencias JSON (`{"antiguo": "nuevo"}`) para comparabilidad histórica.

---

## 3. Requisitos de Experiencia de Usuario y Accesibilidad

* **DT-FE-09 (Grilla Táctil para Daños):**
  Cada pregunta de evaluación de daño (`x-dano: true`) en escala 0 a 4 se renderiza como una botonera horizontal con tamaño mínimo de **44 × 44 px** por botón:
  ```html
  <div class="flex gap-2" role="radiogroup" [attr.aria-label]="pregunta.title">
    @for (valor of [0, 1, 2, 3, 4]; track valor) {
      <button
        type="button"
        class="min-w-[44px] min-h-[44px] flex items-center justify-center rounded font-semibold border"
        [class.bg-blue-600]="control.value === valor"
        [class.text-white]="control.value === valor"
        (click)="setValor(valor)">
        {{ valor }}
      </button>
    }
  </div>
  ```
* **Botón "Sin daños en este elemento" (RN-INS-11):**
  Para cada grupo con metadato `x-grupo` (e.g. estribos, pilas, cimentación, vigas, losa, etc.), el motor provee un botón rápido contextual que asigna calificación `0` exclusivamente a los campos de daño pertenecientes a dicho grupo.
* **Insignia de Anulación Crítica (`x-anulacion-critica`):**
  Identifica visualmente mediante una insignia de advertencia (`rose-100`) aquellos campos de daño que activan las 4 anulaciones críticas de P8 (socavación, asentamiento, elemento cortado, ausencia).
* **Unidades Físicas y Textareas:**
  Los campos numéricos con metadato `x-unidad` muestran su unidad fija (`m`, `km`) y padding `pr-12`. Los campos de observaciones y recomendaciones se renderizan como `<textarea rows="3">`.

---

## 4. Convenciones de Integración con el Equipo

1. **Textos de Interfaz (DT-FE-12):**
   Ningún texto se escribe plano en los templates HTML. Todo texto vive centralizado en `src/app/shared/textos.ts`:
   ```typescript
   export const TEXTOS = {
     // ...
     formulario: {
       motor: {
         sinDanosEnElemento: 'Sin daños en este elemento',
         modoLecturaAviso: 'Esta inspección fue capturada con la versión {codigo}. Vista de solo lectura.',
         guardandoBorrador: 'Guardando datos en borrador local…',
         errorValidacion: 'Por favor corrija los campos marcados en rojo antes de continuar.'
       }
     }
   };
   ```
2. **Seguridad y Guardias:**
   Uso de `rolGuard` y `sesionGuard` desde `src/app/core/auth/`.
3. **Mapeo de Errores ProblemDetail (RFC 7807):**
   Integración con `src/app/core/errores/problema.ts`: cuando el backend retorna `422`, los errores del arreglo `errores[].campo` se asocian directamente al `FormControl` correspondiente mediante su ruta semántica.
4. **Pruebas Automatizadas del Módulo (27 pruebas pasando):**
   * `control-dano.spec.ts` (5 pruebas): Botones táctiles de calificación de daño ≥ 44×44 px (`DT-FE-09`), estados deshabilitados y `ControlValueAccessor`.
   * `motor-formulario.spec.ts` (7 pruebas): Renderizado dinámico (`DT-FE-07`), `FormArray` de tramos (agregar, eliminar, renumeración correlativa), ordenamiento canónico contra PostgreSQL `jsonb`, agrupación de daños `x-grupo`, botón "Sin daños en este elemento" (`RN-INS-11`), badges de `x-anulacion-critica` y emisión segura con `getRawValue()`.
   * `editor-formulario.spec.ts` (4 pruebas): Navegación entre editor y vista previa en vivo, validación de sintaxis en tiempo real al tipear con reporte inmediato de errores (`errorSintaxis`), restablecimiento reactivo al corregir JSON y bloqueo del botón "Guardar borrador".
   * `formulario.service.spec.ts` (5 pruebas): Peticiones HTTP tipadas (`GET /activo`, `GET /versiones/:codigo`, `POST /versiones`, `PUT`, `POST /publicar`) y persistencia local en Dexie.js para modo offline (`DT-OFF-01`).
   * `listado-versiones.spec.ts` (3 pruebas): Carga de versiones, renderizado de badges de estado (`ACTIVA`, `BORRADOR`, `RETIRADA`), botón de publicación condicional sólo en borradores y apertura del modal.
   * `modal-publicar.spec.ts` (3 pruebas): Modal de publicación, advertencia de inmutabilidad (`RN-FRM-03`), validación de sintaxis del mapeo JSON (`RN-FRM-06`) y emisión al confirmar.
