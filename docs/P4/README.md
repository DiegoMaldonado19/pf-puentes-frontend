# Manual Técnico de P4 (Frontend) — Motor de Formularios y Versionado

Ubicación del módulo: `src/app/features/formulario`.  
Reglas de negocio asociadas: **RN-FRM-01**, **RN-FRM-05**, **RN-FRM-07**, **RN-FRM-08**.  
Directrices técnicas: **DT-FE-07** (generación dinámica desde JSON Schema), **DT-FE-08** (`ReactiveFormsModule` dinámico), **DT-FE-09** (controles táctiles ≥ 44×44 px), **DT-FE-12** (`textos.ts`), **DT-OFF-01**.

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

### 2.2 Vistas Administrativas del Formulario
* **Navegación:** Enlace directo **Formularios** en la cabecera principal (`app.html`), visible exclusivamente para usuarios con rol `ADMINISTRADOR`.
* **Listado de Versiones (`/admin/formularios`):** Visualización reactiva con `signal()` de versiones vigentes (`ACTIVA`), borradores (`BORRADOR`) y retiradas (`RETIRADA`). Incluye botón de publicación rápida de borradores.
* **Editor de Esquemas (`/admin/formularios/nuevo` y `/admin/formularios/:id/editar`):**
  * Editor JSON Schema en tiempo real con validación sintáctica.
  * Precarga automática del formulario oficial activo (V1.0.0 con 8 secciones) al crear nuevas versiones.
  * Botón directo de publicación inmutable con modal de mapeo (`RN-FRM-06`).
  * Pestaña de **Vista Previa en Vivo** renderizada dinámicamente mediante `<app-motor-formulario>`.
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
  Para cada grupo con metadato `x-grupo`, el motor provee un botón rápido que asigna calificación `0` a todos los campos de daño pertenecientes al grupo.

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
