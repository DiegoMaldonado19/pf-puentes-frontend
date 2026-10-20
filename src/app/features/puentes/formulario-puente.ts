import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable, of } from 'rxjs';
import { TEXTOS } from '../../shared/textos';
import { CatalogoService } from './catalogo.service';
import { AdvertenciaDuplicado } from './advertencia-duplicado';
import { mensajeDeError, puentesCercanos } from './errores';
import { Coordenadas, MapaUbicacion } from './mapa/mapa-ubicacion';
import { PuenteCercanoDTO, PuenteDTO, SolicitudPuenteDTO } from './modelos';
import { PuentesService } from './puentes.service';
import { SolicitudesService } from './solicitudes.service';

export type ModoFormulario = 'alta' | 'edicion' | 'solicitud';

const ENTERO = /^-?\d+$/;

/** RN-INV-04: obligatorios nombre, departamento, municipio, ruta y ubicación. */
export function crearFormularioPuente() {
  return new FormGroup({
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200), Validators.pattern(/\S/)],
    }),
    departamento: new FormControl('', { nonNullable: true, validators: Validators.required }),
    municipio: new FormControl('', { nonNullable: true, validators: Validators.required }),
    ruta: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)],
    }),
    // Guatemala: así la zona UTM siempre es 15N o 16N (RN-INV-05); el backend valida igual
    latitud: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(13.5),
      Validators.max(18),
    ]),
    longitud: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(-92.5),
      Validators.max(-88),
    ]),
    anio: new FormControl<number | null>(null, [
      Validators.min(1800),
      Validators.max(2100),
      Validators.pattern(ENTERO),
    ]),
  });
}

@Component({
  selector: 'app-formulario-puente',
  imports: [AdvertenciaDuplicado, MapaUbicacion, ReactiveFormsModule, RouterLink],
  templateUrl: './formulario-puente.html',
})
export class FormularioPuente {
  /** Viene de data de la ruta. */
  readonly modo = input<ModoFormulario>('alta');
  /** Parámetro :id en edición. */
  readonly id = input<string>();

  protected readonly t = TEXTOS.puentes;
  protected readonly f = TEXTOS.puentes.formulario;
  protected readonly form = crearFormularioPuente();
  protected readonly enviando = signal(false);
  protected readonly error = signal('');
  protected readonly cercanos = signal<readonly PuenteCercanoDTO[] | null>(null);
  protected readonly solicitudEnviada = signal(false);

  private readonly puentes = inject(PuentesService);
  private readonly solicitudes = inject(SolicitudesService);
  private readonly catalogo = inject(CatalogoService);
  private readonly router = inject(Router);

  protected readonly titulo = computed(
    () =>
      ({
        alta: this.f.tituloAlta,
        edicion: this.f.tituloEdicion,
        solicitud: this.f.tituloSolicitud,
      })[this.modo()],
  );
  protected readonly textoEnviar = computed(
    () =>
      ({ alta: this.f.guardar, edicion: this.f.guardarEdicion, solicitud: this.f.enviarSolicitud })[
        this.modo()
      ],
  );

  protected readonly original = rxResource({
    params: () => (this.modo() === 'edicion' ? this.id() : undefined),
    stream: ({ params }) => this.puentes.detalle(params),
  });
  protected readonly departamentos = rxResource({ stream: () => this.catalogo.departamentos() });
  private readonly departamento = toSignal(this.form.controls.departamento.valueChanges, {
    initialValue: '',
  });
  protected readonly municipios = rxResource({
    params: () => this.departamento(),
    stream: ({ params }) => (params ? this.catalogo.municipios(params) : of([])),
  });
  private readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.value });
  protected readonly latitud = computed(() => this.valores().latitud ?? null);
  protected readonly longitud = computed(() => this.valores().longitud ?? null);

  constructor() {
    // Municipio depende del departamento (RN-INV-04): al cambiar uno se limpia el otro
    this.form.controls.departamento.valueChanges.subscribe(() => {
      if (this.modo() !== 'edicion') this.form.controls.municipio.setValue('');
    });
    effect(() => {
      const puente = this.original.value();
      if (puente) this.cargarEdicion(puente);
    });
  }

  private cargarEdicion(puente: PuenteDTO): void {
    this.form.patchValue({
      nombre: puente.nombre,
      departamento: puente.departamento.codigo,
      municipio: puente.municipio.codigo,
      ruta: puente.ruta,
      latitud: puente.latitud,
      longitud: puente.longitud,
      anio: puente.anio_construccion,
    });
    // RN-INV-02: el municipio forma parte del código inmutable
    this.form.controls.departamento.disable();
    this.form.controls.municipio.disable();
  }

  protected elegirUbicacion(punto: Coordenadas): void {
    this.form.patchValue({ latitud: punto.latitud, longitud: punto.longitud });
    this.form.controls.latitud.markAsTouched();
    this.form.controls.longitud.markAsTouched();
  }

  protected invalido(campo: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[campo];
    return control.invalid && (control.touched || control.dirty);
  }

  protected mensaje(campo: keyof typeof this.form.controls): string {
    const control = this.form.controls[campo];
    if (control.hasError('required') || control.hasError('pattern')) {
      if (campo === 'anio') return this.f.errores.anio;
      return this.f.errores.requerido;
    }
    if (control.hasError('maxlength')) return this.f.errores.maximo;
    if (campo === 'latitud') return this.f.errores.latitud;
    if (campo === 'longitud') return this.f.errores.longitud;
    return this.f.errores.anio;
  }

  protected enviar(confirmarDuplicado = false): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.error.set('');
    this.peticion(confirmarDuplicado).subscribe({
      next: (resultado) => {
        this.enviando.set(false);
        this.cercanos.set(null);
        if (this.modo() === 'solicitud') {
          this.solicitudEnviada.set(true);
          this.form.reset();
        } else {
          void this.router.navigate(['/puentes', (resultado as PuenteDTO).id]);
        }
      },
      error: (error: unknown) => {
        this.enviando.set(false);
        const cercanos = puentesCercanos(error);
        if (cercanos) {
          this.cercanos.set(cercanos);
        } else {
          this.error.set(mensajeDeError(error));
        }
      },
    });
  }

  private peticion(confirmar: boolean): Observable<PuenteDTO | SolicitudPuenteDTO> {
    const v = this.form.getRawValue();
    const comunes = {
      nombre: v.nombre.trim(),
      ruta: v.ruta.trim(),
      latitud: Number(v.latitud),
      longitud: Number(v.longitud),
      confirmar_duplicado: confirmar,
    };
    const anio = v.anio === null || String(v.anio) === '' ? null : Number(v.anio);
    switch (this.modo()) {
      case 'edicion':
        return this.puentes.editar(this.id() ?? '', { ...comunes, anio_construccion: anio });
      case 'solicitud':
        return this.solicitudes.solicitar({
          ...comunes,
          departamento_codigo: v.departamento,
          municipio_codigo: v.municipio,
        });
      default:
        return this.puentes.crear({
          ...comunes,
          departamento_codigo: v.departamento,
          municipio_codigo: v.municipio,
          anio_construccion: anio,
        });
    }
  }
}
