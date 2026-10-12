import { Component, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TEXTOS } from '../../shared/textos';
import { CursoDTO, GuardarCursoDTO } from './modelos';

@Component({
  selector: 'app-formulario-curso',
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="formulario" (ngSubmit)="enviar()">
      <fieldset [disabled]="ocupado()">
        <legend>{{ curso() ? textos.editar : textos.nuevo }}</legend>
        <label
          >{{ textos.nombre }} <input formControlName="nombre" maxlength="150" required
        /></label>
        <label
          >{{ textos.anio }}
          <input type="number" formControlName="anio" min="2020" max="2100" required
        /></label>
        <label
          >{{ textos.semestre }}
          <select formControlName="semestre">
            <option [ngValue]="1">1</option>
            <option [ngValue]="2">2</option>
          </select>
        </label>
        <label><input type="checkbox" formControlName="vigente" /> {{ textos.vigente }}</label>
        @if (formulario.touched && formulario.invalid) {
          <p role="alert">{{ textos.formularioInvalido }}</p>
        }
        <button type="submit" [disabled]="formulario.invalid || ocupado()">
          {{ textos.guardar }}
        </button>
      </fieldset>
    </form>
  `,
  styles: `
    fieldset {
      display: grid;
      gap: 1rem;
      border: 1px solid #64748b;
      border-radius: 0.5rem;
      padding: 1rem;
    }
    label {
      display: grid;
      gap: 0.4rem;
    }
    input,
    select,
    button {
      min-height: 44px;
    }
    input[type='checkbox'] {
      min-height: auto;
    }
  `,
})
export class FormularioCurso {
  readonly textos = TEXTOS.cursos;
  readonly curso = input<CursoDTO | null>(null);
  readonly ocupado = input(false);
  readonly guardado = output<GuardarCursoDTO>();
  readonly formulario = inject(FormBuilder).nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(150), Validators.pattern(/\S/)]],
    anio: [
      2026,
      [
        Validators.required,
        Validators.min(2020),
        Validators.max(2100),
        Validators.pattern(/^\d+$/),
      ],
    ],
    semestre: [2, [Validators.required, Validators.pattern(/^[12]$/)]],
    vigente: [true],
  });

  constructor() {
    effect(() => {
      const curso = this.curso();
      if (curso)
        this.formulario.reset({
          nombre: curso.nombre,
          anio: curso.anio,
          semestre: curso.semestre,
          vigente: curso.vigente,
        });
    });
  }

  enviar() {
    this.formulario.markAllAsTouched();
    if (this.formulario.valid && !this.ocupado()) {
      const datos = this.formulario.getRawValue();
      this.guardado.emit({ ...datos, nombre: datos.nombre.trim() });
    }
  }
}
