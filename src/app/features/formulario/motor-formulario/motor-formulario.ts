import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Subscription } from 'rxjs';
import { TEXTOS } from '../../../shared/textos';
import { EsquemaFormulario, ModoFormulario, PropiedadEsquema } from '../modelos';
import { ControlDanoComponent } from './control-dano';

export interface SeccionMeta {
  clave: string;
  titulo: string;
  descripcion?: string;
  propiedades: { clave: string; esquema: PropiedadEsquema }[];
}

@Component({
  selector: 'app-motor-formulario',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ControlDanoComponent],
  templateUrl: './motor-formulario.html',
})
export class MotorFormularioComponent implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) esquema!: EsquemaFormulario;
  @Input() datos: Record<string, any> = {};
  @Input() modo: ModoFormulario = 'edicion';
  @Input() erroresServidor: Record<string, string> = {};

  @Output() datosChange = new EventEmitter<Record<string, any>>();
  @Output() validoChange = new EventEmitter<boolean>();

  readonly textos = TEXTOS.formulario.motor;

  formGroup: FormGroup = new FormGroup({});
  secciones: SeccionMeta[] = [];
  seccionActiva = 0;

  private subscripcionCambios?: Subscription;

  ngOnInit(): void {
    this.construirFormulario();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['esquema'] && !changes['esquema'].firstChange) {
      this.construirFormulario();
    } else if (changes['modo'] && !changes['modo'].firstChange) {
      this.ajustarModoLectura();
    } else if (changes['datos'] && !changes['datos'].firstChange) {
      this.aplicarDatos();
    }
  }

  ngOnDestroy(): void {
    this.subscripcionCambios?.unsubscribe();
  }

  cambiarSeccion(index: number): void {
    if (index >= 0 && index < this.secciones.length) {
      this.seccionActiva = index;
    }
  }

  /** RN-INS-11: Botón para calificar 0 en todos los campos de daño de un grupo o sección */
  marcarSinDanos(seccionClave: string, grupo?: string): void {
    if (this.modo === 'lectura') return;

    const seccionGroup = this.formGroup.get(seccionClave) as FormGroup;
    if (!seccionGroup) return;

    const seccion = this.secciones.find((s) => s.clave === seccionClave);
    if (!seccion) return;

    for (const prop of seccion.propiedades) {
      if (prop.esquema['x-dano']) {
        if (!grupo || prop.esquema['x-grupo'] === grupo) {
          const control = seccionGroup.get(prop.clave);
          if (control) {
            control.setValue(0);
            control.markAsDirty();
          }
        }
      }
    }
  }

  obtenerControl(seccionClave: string, campoClave: string): FormControl | null {
    return this.formGroup.get(`${seccionClave}.${campoClave}`) as FormControl;
  }

  obtenerError(seccionClave: string, campoClave: string): string | null {
    const ruta = `${seccionClave}.${campoClave}`;
    if (this.erroresServidor[ruta]) {
      return this.erroresServidor[ruta];
    }
    const control = this.obtenerControl(seccionClave, campoClave);
    if (control && control.touched && control.invalid) {
      if (control.hasError('required')) return this.textos.obligatorio;
      if (control.hasError('min') || control.hasError('max')) return this.textos.danoInvalido;
    }
    return null;
  }

  private construirFormulario(): void {
    this.subscripcionCambios?.unsubscribe();

    if (!this.esquema || !this.esquema.properties) {
      this.formGroup = new FormGroup({});
      this.secciones = [];
      return;
    }

    this.secciones = Object.entries(this.esquema.properties).map(([clave, prop]) => {
      const propiedadesHijas = prop.properties
        ? Object.entries(prop.properties)
            .map(([hijaClave, hijaProp]) => ({ clave: hijaClave, esquema: hijaProp }))
            .sort((a, b) => (a.esquema['x-orden'] ?? 99) - (b.esquema['x-orden'] ?? 99))
        : [];

      return {
        clave,
        titulo: prop.title || clave,
        descripcion: prop.description,
        propiedades: propiedadesHijas,
      };
    });

    const grupoRaiz: Record<string, any> = {};

    for (const seccion of this.secciones) {
      const controlesSeccion: Record<string, FormControl> = {};
      const valoresSeccion = this.datos ? this.datos[seccion.clave] : undefined;

      for (const prop of seccion.propiedades) {
        const valorInicial = valoresSeccion ? valoresSeccion[prop.clave] : null;
        const validadores: ValidatorFn[] = [];

        if (this.esquema.properties[seccion.clave]?.required?.includes(prop.clave)) {
          validadores.push(Validators.required);
        }
        if (prop.esquema.minimum !== undefined) {
          validadores.push(Validators.min(prop.esquema.minimum));
        }
        if (prop.esquema.maximum !== undefined) {
          validadores.push(Validators.max(prop.esquema.maximum));
        }

        const control = new FormControl(
          {
            value: valorInicial,
            disabled: this.modo === 'lectura' || Boolean(prop.esquema.readOnly),
          },
          validadores,
        );

        controlesSeccion[prop.clave] = control;
      }

      grupoRaiz[seccion.clave] = new FormGroup(controlesSeccion);
    }

    this.formGroup = new FormGroup(grupoRaiz);

    this.subscripcionCambios = this.formGroup.valueChanges.subscribe((valores) => {
      this.datosChange.emit(valores);
      this.validoChange.emit(this.formGroup.valid);
    });

    this.validoChange.emit(this.formGroup.valid);
  }

  private ajustarModoLectura(): void {
    if (this.modo === 'lectura') {
      this.formGroup.disable({ emitEvent: false });
    } else {
      this.formGroup.enable({ emitEvent: false });
      // Re-deshabilitar campos que son estrictamente de solo lectura en el esquema
      for (const seccion of this.secciones) {
        for (const prop of seccion.propiedades) {
          if (prop.esquema.readOnly) {
            this.formGroup.get(`${seccion.clave}.${prop.clave}`)?.disable({ emitEvent: false });
          }
        }
      }
    }
  }

  private aplicarDatos(): void {
    if (this.datos && this.formGroup) {
      this.formGroup.patchValue(this.datos, { emitEvent: false });
      this.validoChange.emit(this.formGroup.valid);
    }
  }
}
