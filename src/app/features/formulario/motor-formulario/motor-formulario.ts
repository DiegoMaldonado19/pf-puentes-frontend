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

export interface GrupoPropiedades {
  clave: string;
  nombre: string;
  propiedades: { clave: string; esquema: PropiedadEsquema }[];
}

export interface SeccionMeta {
  clave: string;
  titulo: string;
  descripcion?: string;
  tipo: 'object' | 'array';
  orden: number;
  propiedades: { clave: string; esquema: PropiedadEsquema }[];
  itemPropiedades: { clave: string; esquema: PropiedadEsquema }[];
  itemRequired: string[];
  grupos: GrupoPropiedades[];
  tieneDanos: boolean;
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

  obtenerTituloPestana(seccion: SeccionMeta, index: number): string {
    if (/^Secci[oó]n\s+\d+/i.test(seccion.titulo)) {
      return seccion.titulo;
    }
    return `${index + 1}. ${seccion.titulo}`;
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

    this.datosChange.emit(this.formGroup.getRawValue());
    this.validoChange.emit(this.formGroup.valid);
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

  obtenerFormArray(seccionClave: string): FormArray<FormGroup> {
    return this.formGroup.get(seccionClave) as FormArray<FormGroup>;
  }

  agregarFilaArray(seccionClave: string): void {
    if (this.modo === 'lectura') return;
    const array = this.obtenerFormArray(seccionClave);
    const seccion = this.secciones.find((s) => s.clave === seccionClave);
    if (!array || !seccion) return;

    const nuevoNumero = array.length + 1;
    const nuevoGrupo = this.crearFormGroupItemArray(seccion, { numero_tramo: nuevoNumero });
    array.push(nuevoGrupo);
    array.markAsDirty();
    this.datosChange.emit(this.formGroup.getRawValue());
    this.validoChange.emit(this.formGroup.valid);
  }

  eliminarFilaArray(seccionClave: string, index: number): void {
    if (this.modo === 'lectura') return;
    const array = this.obtenerFormArray(seccionClave);
    if (!array || array.length <= 1) return;

    array.removeAt(index);
    // Renumerar numero_tramo correlativamente
    array.controls.forEach((group, i) => {
      const numCtrl = group.get('numero_tramo');
      if (numCtrl) {
        numCtrl.setValue(i + 1);
      }
    });
    array.markAsDirty();
    this.datosChange.emit(this.formGroup.getRawValue());
    this.validoChange.emit(this.formGroup.valid);
  }

  obtenerErrorArray(seccionClave: string, index: number, campoClave: string): string | null {
    const ruta = `${seccionClave}[${index}].${campoClave}`;
    if (this.erroresServidor[ruta]) {
      return this.erroresServidor[ruta];
    }
    const array = this.obtenerFormArray(seccionClave);
    if (!array) return null;
    const grupo = array.at(index);
    if (!grupo) return null;
    const control = grupo.get(campoClave);
    if (control && control.touched && control.invalid) {
      if (control.hasError('required')) return this.textos.obligatorio;
      if (control.hasError('min') || control.hasError('max')) return 'Valor fuera de rango';
    }
    return null;
  }

  crearFormGroupItemArray(seccion: SeccionMeta, valoresItem?: Record<string, any>): FormGroup {
    const controlesItem: Record<string, FormControl> = {};

    for (const prop of seccion.itemPropiedades) {
      const valorInicial = valoresItem ? valoresItem[prop.clave] : null;
      const validadores: ValidatorFn[] = [];

      if (seccion.itemRequired.includes(prop.clave)) {
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

      controlesItem[prop.clave] = control;
    }

    return new FormGroup(controlesItem);
  }

  private calcularOrdenSeccion(clave: string, prop: PropiedadEsquema): number {
    if (prop['x-orden'] !== undefined && typeof prop['x-orden'] === 'number') {
      return prop['x-orden'];
    }
    const match = prop.title?.match(/Secci[oó]n\s+(\d+)/i);
    if (match) {
      return parseInt(match[1], 10);
    }
    const ordenCanonico = [
      'identificacion',
      'datos_generales',
      'tramos',
      'subestructura',
      'superestructura',
      'elementos_no_estructurales',
      'caracteristicas_cauce',
      'otros',
    ];
    const idx = ordenCanonico.indexOf(clave);
    return idx >= 0 ? idx + 1 : 99;
  }

  private agruparPropiedades(
    propiedades: { clave: string; esquema: PropiedadEsquema }[],
  ): GrupoPropiedades[] {
    const tieneDanos = propiedades.some((p) => p.esquema['x-dano']);
    if (!tieneDanos) {
      return [
        {
          clave: 'general',
          nombre: '',
          propiedades,
        },
      ];
    }

    const gruposMap = new Map<
      string,
      { clave: string; nombre: string; propiedades: { clave: string; esquema: PropiedadEsquema }[] }
    >();

    for (const prop of propiedades) {
      const grupoClave = prop.esquema['x-grupo'] || 'general';
      if (!gruposMap.has(grupoClave)) {
        gruposMap.set(grupoClave, {
          clave: grupoClave,
          nombre: this.formatearNombreGrupo(grupoClave),
          propiedades: [],
        });
      }
      gruposMap.get(grupoClave)!.propiedades.push(prop);
    }

    return Array.from(gruposMap.values());
  }

  formatearNombreGrupo(clave: string): string {
    const nombres: Record<string, string> = {
      estribos: 'Estribos y Muros de Entrada/Salida',
      pilas: 'Pilas Intermedias',
      cimentacion: 'Cimentación y Asentamientos',
      vigas: 'Vigas y Elementos Portantes Principales',
      losa: 'Losa y Tablero de Rodadura',
      juntas: 'Juntas de Dilatación',
      apoyos: 'Aparatos de Apoyo',
      seguridad_vial: 'Seguridad Vial y Barandas',
      aceras: 'Aceras y Pasos Peatonales',
      drenajes: 'Drenajes y Bajantes Pluviales',
      hidraulica: 'Protección Hidráulica y Dinámica de Cauce',
      general: 'Datos Generales',
    };
    return nombres[clave] || (clave.charAt(0).toUpperCase() + clave.slice(1)).replace(/_/g, ' ');
  }

  private construirFormulario(): void {
    this.subscripcionCambios?.unsubscribe();

    if (!this.esquema || !this.esquema.properties) {
      this.formGroup = new FormGroup({});
      this.secciones = [];
      return;
    }

    this.secciones = Object.entries(this.esquema.properties).map(([clave, prop]) => {
      const esArray = prop.type === 'array';
      const orden = this.calcularOrdenSeccion(clave, prop);

      let propiedadesHijas: { clave: string; esquema: PropiedadEsquema }[] = [];
      let itemPropiedades: { clave: string; esquema: PropiedadEsquema }[] = [];
      let itemRequired: string[] = [];

      if (esArray && prop.items?.properties) {
        itemPropiedades = Object.entries(prop.items.properties)
          .map(([hijaClave, hijaProp]) => ({ clave: hijaClave, esquema: hijaProp }))
          .sort((a, b) => (a.esquema['x-orden'] ?? 99) - (b.esquema['x-orden'] ?? 99));
        itemRequired = prop.items.required ?? [];
      } else if (prop.properties) {
        propiedadesHijas = Object.entries(prop.properties)
          .map(([hijaClave, hijaProp]) => ({ clave: hijaClave, esquema: hijaProp }))
          .sort((a, b) => (a.esquema['x-orden'] ?? 99) - (b.esquema['x-orden'] ?? 99));
      }

      const grupos = this.agruparPropiedades(propiedadesHijas);
      const tieneDanos = propiedadesHijas.some((p) => p.esquema['x-dano']);

      return {
        clave,
        titulo: prop.title || clave,
        descripcion: prop.description,
        tipo: esArray ? 'array' : 'object',
        orden,
        propiedades: propiedadesHijas,
        itemPropiedades,
        itemRequired,
        grupos,
        tieneDanos,
      };
    });

    // Ordenar las secciones para que se muestren estrictamente en orden 1 a 8
    this.secciones.sort((a, b) => a.orden - b.orden);

    const grupoRaiz: Record<string, any> = {};

    for (const seccion of this.secciones) {
      const valoresSeccion = this.datos ? this.datos[seccion.clave] : undefined;

      if (seccion.tipo === 'array') {
        const arrayForm = new FormArray<FormGroup>([]);
        const valoresArray = Array.isArray(valoresSeccion) ? valoresSeccion : [];

        if (valoresArray.length > 0) {
          for (const itemVal of valoresArray) {
            arrayForm.push(this.crearFormGroupItemArray(seccion, itemVal));
          }
        } else if (this.modo === 'edicion') {
          // Si está en edición y no hay datos, inicializar con el primer tramo
          arrayForm.push(this.crearFormGroupItemArray(seccion, { numero_tramo: 1 }));
        }

        grupoRaiz[seccion.clave] = arrayForm;
      } else {
        const controlesSeccion: Record<string, FormControl> = {};

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
    }

    this.formGroup = new FormGroup(grupoRaiz);

    if (this.modo === 'lectura') {
      this.formGroup.disable({ emitEvent: false });
    }

    this.subscripcionCambios = this.formGroup.valueChanges.subscribe(() => {
      this.datosChange.emit(this.formGroup.getRawValue());
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
        if (seccion.tipo === 'array') {
          const array = this.obtenerFormArray(seccion.clave);
          if (array) {
            array.controls.forEach((itemGroup) => {
              for (const prop of seccion.itemPropiedades) {
                if (prop.esquema.readOnly) {
                  itemGroup.get(prop.clave)?.disable({ emitEvent: false });
                }
              }
            });
          }
        } else {
          for (const prop of seccion.propiedades) {
            if (prop.esquema.readOnly) {
              this.formGroup.get(`${seccion.clave}.${prop.clave}`)?.disable({ emitEvent: false });
            }
          }
        }
      }
    }
  }

  private aplicarDatos(): void {
    if (this.datos && this.formGroup) {
      for (const seccion of this.secciones) {
        if (seccion.tipo === 'array' && Array.isArray(this.datos[seccion.clave])) {
          const formArray = this.obtenerFormArray(seccion.clave);
          if (formArray) {
            formArray.clear();
            const items = this.datos[seccion.clave] as Record<string, any>[];
            for (const item of items) {
              formArray.push(this.crearFormGroupItemArray(seccion, item));
            }
          }
        }
      }
      this.formGroup.patchValue(this.datos, { emitEvent: false });
      this.validoChange.emit(this.formGroup.valid);
    }
  }
}
