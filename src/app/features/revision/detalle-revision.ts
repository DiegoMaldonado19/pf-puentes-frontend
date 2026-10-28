import { JsonPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth';
import { MarcaAnclada, MarcadorAnclado } from '../../shared/marcador-anclado/marcador-anclado';
import { EstadoCondicion } from '../../shared/estado-puente/estado-puente';
import { TEXTOS } from '../../shared/textos';
import { MotorFormularioComponent } from '../formulario/motor-formulario/motor-formulario';
import { ArchivoDTO } from './revision-api';
import { ConfirmacionEstado } from '../../shared/confirmacion-estado/confirmacion-estado';
import { IcPreliminar } from '../../shared/ic-preliminar/ic-preliminar';
import { CalificacionRevision } from './calificacion-revision';
import { HistorialRevisiones } from './historial-revisiones';
import {
  DetalleRevision as DatosRevision,
  EstimacionPreliminarIcDTO,
  ObservacionRevision,
  RevisionApi,
  Veredicto,
} from './revision-api';

@Component({
  selector: 'app-detalle-revision',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    JsonPipe,
    MotorFormularioComponent,
    MarcadorAnclado,
    CalificacionRevision,
    HistorialRevisiones,
    ConfirmacionEstado,
    IcPreliminar,
  ],
  templateUrl: './detalle-revision.html',
})
export class DetalleRevision {
  readonly t = TEXTOS.revision;
  readonly detalle = signal<DatosRevision | null>(null);
  readonly archivos = signal<ArchivoDTO[]>([]);
  readonly icPreliminar = signal<EstimacionPreliminarIcDTO | null>(null);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly seleccion = signal<ObservacionRevision | null>(null);
  readonly confirmacionValida = signal(false);
  private readonly api = inject(RevisionApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly parametros = toSignal(this.ruta.paramMap, {
    initialValue: this.ruta.snapshot.paramMap,
  });
  private readonly destruir = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private lectura?: Subscription;
  private generacion = 0;
  readonly decision = this.fb.nonNullable.group({
    veredicto: ['CAMBIOS_SOLICITADOS' as Veredicto, Validators.required],
    observacion: ['', Validators.maxLength(10000)],
    estado: ['' as '' | 'BUENO' | 'REGULAR' | 'MALO'],
    justificacion: ['', Validators.maxLength(10000)],
  });
  readonly observacion = this.fb.nonNullable.group({
    referencia: ['', Validators.required],
    texto: ['', [Validators.required, Validators.maxLength(10000)]],
  });

  constructor() {
    effect(() => {
      this.parametros();
      const usuario = this.auth.usuario();
      const permitido = this.auth.autenticado() && this.auth.rol() === 'CATEDRATICO';
      this.generacion++;
      this.lectura?.unsubscribe();
      this.detalle.set(null);
      this.archivos.set([]);
      this.icPreliminar.set(null);
      this.confirmacionValida.set(false);
      this.decision.reset();
      this.seleccion.set(null);
      this.guardando.set(false);
      if (usuario && permitido) untracked(() => this.cargar());
      else void this.router.navigateByUrl('/login');
    });
  }

  cargar() {
    this.lectura?.unsubscribe();
    const generacion = ++this.generacion;
    const id = this.parametros().get('revisionId');
    if (!id) return;
    this.detalle.set(null);
    this.archivos.set([]);
    this.icPreliminar.set(null);
    this.confirmacionValida.set(false);
    this.decision.reset();
    this.seleccion.set(null);
    this.error.set('');
    this.cargando.set(true);
    this.lectura = this.api
      .detalle(id)
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: (datos) => {
          if (generacion !== this.generacion) return;
          this.detalle.set(datos);
          this.observacion.reset({ referencia: datos.campos[0]?.referencia ?? '', texto: '' });
          this.api.archivos(id).subscribe({
            next: (arch) => {
              if (generacion === this.generacion) this.archivos.set(arch);
            },
            error: () => {
              if (generacion === this.generacion) this.archivos.set([]);
            },
          });
          this.api.icPreliminar(datos.inspeccion_id).subscribe({
            next: (ic) => {
              if (generacion === this.generacion) this.icPreliminar.set(ic);
            },
            error: () => {
              if (generacion === this.generacion) this.icPreliminar.set(null);
            },
          });
          this.cargando.set(false);
        },
        error: (error) => {
          if (generacion === this.generacion) {
            this.cargando.set(false);
            this.fallo(error);
          }
        },
      });
  }

  marcas(referencia: string): MarcaAnclada[] {
    return (this.detalle()?.observaciones ?? [])
      .filter((o) => o.elemento_ref === referencia)
      .map((o) => ({ id: o.id, tipo: 'observacion', etiqueta: o.texto }));
  }

  seleccionar(id: string) {
    this.seleccion.set(this.detalle()?.observaciones.find((o) => o.id === id) ?? null);
  }

  puedeDecidir(): boolean {
    const datos = this.decision.getRawValue();
    return (
      !this.decision.invalid &&
      (datos.veredicto === 'APROBADA' || !!datos.observacion.trim()) &&
      (datos.veredicto !== 'APROBADA' || this.confirmacionValida())
    );
  }

  onConfirmacionCambio(cambio: {
    estadoConfirmado: EstadoCondicion;
    justificacion: string | null;
    valida: boolean;
  }) {
    this.confirmacionValida.set(cambio.valida);
    if (cambio.estadoConfirmado !== this.decision.controls.estado.value) {
      this.decision.controls.estado.setValue(cambio.estadoConfirmado);
    }
    if ((cambio.justificacion ?? '') !== this.decision.controls.justificacion.value) {
      this.decision.controls.justificacion.setValue(cambio.justificacion ?? '');
    }
  }

  emitir() {
    const actual = this.detalle();
    if (!actual || actual.veredicto || this.guardando() || !this.puedeDecidir()) return;
    const datos = this.decision.getRawValue();
    const generacion = this.generacion;
    this.guardando.set(true);
    this.error.set('');
    this.api
      .decidir(actual.id, {
        veredicto: datos.veredicto,
        observacion: datos.observacion.trim(),
        estado_confirmado: datos.veredicto === 'APROBADA' ? datos.estado || null : null,
        justificacion_estado:
          datos.veredicto === 'APROBADA' ? datos.justificacion.trim() || null : null,
      })
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: (detalle) => {
          if (generacion === this.generacion) {
            this.guardando.set(false);
            this.detalle.set(detalle);
          }
        },
        error: (error) => {
          if (generacion === this.generacion) {
            this.guardando.set(false);
            this.fallo(error);
          }
        },
      });
  }

  agregar() {
    const actual = this.detalle();
    if (!actual || actual.veredicto || this.guardando() || this.observacion.invalid) return;
    const datos = this.observacion.getRawValue();
    if (!datos.texto.trim()) return;
    const generacion = this.generacion;
    this.guardando.set(true);
    this.error.set('');
    this.api
      .observar(actual.id, datos.referencia, datos.texto.trim())
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: (observacion) => {
          if (generacion !== this.generacion) return;
          this.guardando.set(false);
          this.detalle.set({ ...actual, observaciones: [...actual.observaciones, observacion] });
          this.observacion.controls.texto.reset();
        },
        error: (error) => {
          if (generacion === this.generacion) {
            this.guardando.set(false);
            this.fallo(error);
          }
        },
      });
  }

  private fallo(error: unknown) {
    if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
      this.detalle.set(null);
      this.seleccion.set(null);
      void this.router.navigateByUrl(error.status === 401 ? '/login' : '/puentes');
    }
    this.error.set(
      error instanceof HttpErrorResponse && error.status === 409
        ? this.t.conflicto
        : this.t.errorDecision,
    );
  }
}
