import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { v7 as uuidv7 } from 'uuid';
import { CapturaFoto, FotoCapturada } from '../../shared/captura-foto/captura-foto';
import { TEXTOS } from '../../shared/textos';
import { MantenimientoService } from './mantenimiento.service';
import { OrdenMantenimientoDTO, PaginaEvidencias } from './modelos';

@Component({
  selector: 'app-evidencia-y-cierre',
  imports: [CapturaFoto, ReactiveFormsModule],
  templateUrl: './evidencia-y-cierre.html',
  styleUrls: ['./bandeja-propuestas.css', './evidencia-y-cierre.css'],
})
export class EvidenciaYCierre {
  readonly orden = input.required<OrdenMantenimientoDTO>();
  readonly puedeConsultar = input.required<boolean>();
  readonly puedeSubir = input(false);
  readonly puedeCerrar = input(false);
  readonly bloqueada = input(false);
  readonly cerrada = output<OrdenMantenimientoDTO>();
  readonly accesoDenegado = output<number>();
  readonly actualizarOrden = output<'foto' | 'cierre'>();
  private readonly servicio = inject(MantenimientoService);
  private readonly destruccion = inject(DestroyRef);
  protected readonly t = TEXTOS.mantenimiento.evidencia;
  private readonly contexto = computed(() => ({
    puente: this.orden().puente_id,
    id: this.orden().id,
    estado: this.orden().estado,
    lectura: this.puedeConsultar(),
    subida: this.puedeSubir(),
    cierre: this.puedeCerrar(),
  }));
  protected readonly denegado = linkedSignal({ source: this.contexto, computation: () => false });
  protected readonly pagina = linkedSignal({
    source: this.contexto,
    computation: (): PaginaEvidencias | null => null,
  });
  protected readonly aviso = linkedSignal({
    source: this.contexto,
    computation: (): string | null => null,
  });
  protected readonly errorConsulta = linkedSignal({
    source: this.contexto,
    computation: (): string | null => null,
  });
  protected readonly foto = linkedSignal({
    source: this.contexto,
    computation: (): { id: string; datos: FotoCapturada } | null => null,
  });
  private readonly consulta = linkedSignal({
    source: this.contexto,
    computation: () => ({ page: 0, intento: 0 }),
  });
  protected readonly cargando = signal(false);
  protected readonly enviando = signal<'foto' | 'cierre' | null>(null);
  readonly envioPendiente = computed(() => this.enviando() !== null);
  protected readonly editable = computed(() =>
    ['PROGRAMADA', 'EN_EJECUCION'].includes(this.orden().estado),
  );
  protected readonly formulario = new FormGroup({
    fecha_ejecucion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)],
    }),
    responsable: new FormControl('', {
      nonNullable: true,
      validators: [
        (control) => {
          const valor = String(control.value);
          return !valor.trim() || [...valor].length > 150 ? { responsable: true } : null;
        },
      ],
    }),
  });

  constructor() {
    effect(() => {
      this.contexto();
      this.formulario.reset();
    });
    effect((limpiar) => {
      const contexto = this.contexto();
      const consulta = this.consulta();
      this.pagina.set(null);
      this.errorConsulta.set(null);
      if (!contexto.lectura) {
        this.cargando.set(false);
        return;
      }
      this.cargando.set(true);
      const peticion = this.servicio
        .listarEvidencias(contexto.puente, contexto.id, consulta.page)
        .subscribe({
          next: (pagina) => {
            if (this.contexto() !== contexto || this.consulta() !== consulta) return;
            this.cargando.set(false);
            if (pagina.puente_id !== contexto.puente || pagina.orden_id !== contexto.id) {
              this.errorConsulta.set(this.t.incompatible);
              return;
            }
            this.pagina.set(pagina);
          },
          error: (error: unknown) => {
            if (this.contexto() !== contexto || this.consulta() !== consulta) return;
            this.cargando.set(false);
            this.errorConsulta.set(this.t.errorConsulta);
            this.denegar(error);
          },
        });
      limpiar(() => peticion.unsubscribe());
    });
  }

  protected capturar(datos: FotoCapturada) {
    if (
      this.denegado() ||
      !this.puedeConsultar() ||
      !this.puedeSubir() ||
      !this.editable() ||
      this.envioPendiente() ||
      this.bloqueada()
    )
      return;
    this.foto.set({ id: uuidv7(), datos });
    this.aviso.set(null);
  }

  protected consultar(page = this.pagina()?.page ?? 0) {
    if (
      this.denegado() ||
      !this.puedeConsultar() ||
      this.envioPendiente() ||
      this.bloqueada() ||
      this.cargando() ||
      page < 0
    )
      return;
    this.consulta.update((actual) => ({ page, intento: actual.intento + 1 }));
  }

  protected subir() {
    const foto = this.foto();
    const contexto = this.contexto();
    if (
      this.denegado() ||
      !foto ||
      !contexto.lectura ||
      !contexto.subida ||
      !this.editable() ||
      this.envioPendiente() ||
      this.bloqueada()
    )
      return;
    const datos = new FormData();
    datos.append('id', foto.id);
    datos.append(
      'foto',
      foto.datos.archivo,
      foto.datos.archivo.type === 'image/webp' ? 'foto.webp' : 'foto.jpg',
    );
    datos.append(
      'miniatura',
      foto.datos.miniatura,
      foto.datos.miniatura.type === 'image/webp' ? 'miniatura.webp' : 'miniatura.jpg',
    );
    datos.append('capturada_en', foto.datos.capturada_en);
    if (foto.datos.latitud !== null && foto.datos.longitud !== null) {
      datos.append('latitud', String(foto.datos.latitud));
      datos.append('longitud', String(foto.datos.longitud));
    }
    if (this.orden().elemento_ref) datos.append('elemento_ref', this.orden().elemento_ref!);
    this.enviando.set('foto');
    this.aviso.set(null);
    this.servicio
      .subirEvidencia(contexto.puente, contexto.id, datos)
      .pipe(
        takeUntilDestroyed(this.destruccion),
        finalize(() => this.enviando.set(null)),
      )
      .subscribe({
        next: (resultado) => {
          if (this.contexto() !== contexto) return;
          if (resultado.id !== foto.id) {
            this.aviso.set(this.t.errorSubida);
            return;
          }
          this.foto.set(null);
          this.aviso.set(this.t.guardada);
          this.consulta.update((actual) => ({ page: 0, intento: actual.intento + 1 }));
        },
        error: (error: unknown) => {
          if (this.contexto() !== contexto || this.denegar(error)) return;
          const status = error instanceof HttpErrorResponse ? error.status : 500;
          this.aviso.set(
            status === 413 || status === 422
              ? this.t.archivoInvalido
              : status === 409
                ? this.t.conflicto
                : this.t.errorSubida,
          );
          // Conserva UUID y blobs para un reintento explícito ante respuesta incierta.
          if (status === 404 || status === 409) this.actualizarOrden.emit('foto');
        },
      });
  }

  protected cerrar() {
    const contexto = this.contexto();
    if (
      this.denegado() ||
      !contexto.lectura ||
      !contexto.cierre ||
      contexto.estado !== 'EN_EJECUCION' ||
      this.envioPendiente() ||
      this.bloqueada()
    )
      return;
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.aviso.set(this.t.camposInvalidos);
      return;
    }
    if (this.cargando() || !this.pagina()?.total_elements) {
      this.aviso.set(this.t.faltaFoto);
      return;
    }
    this.aviso.set(null);
    this.enviando.set('cierre');
    this.servicio
      .cerrar(contexto.puente, contexto.id, this.formulario.getRawValue())
      .pipe(
        takeUntilDestroyed(this.destruccion),
        finalize(() => this.enviando.set(null)),
      )
      .subscribe({
        next: (resultado) => {
          if (this.contexto() !== contexto) return;
          if (
            resultado.id !== contexto.id ||
            resultado.puente_id !== contexto.puente ||
            resultado.estado !== 'EJECUTADA'
          ) {
            this.aviso.set(this.t.errorCierre);
            this.actualizarOrden.emit('cierre');
            return;
          }
          this.cerrada.emit(resultado);
        },
        error: (error: unknown) => {
          if (this.contexto() !== contexto || this.denegar(error)) return;
          const status = error instanceof HttpErrorResponse ? error.status : 500;
          this.aviso.set(
            status === 400 || status === 422
              ? this.t.datosInvalidos
              : status === 409
                ? this.t.conflicto
                : this.t.errorCierre,
          );
          if (status === 400 || status === 422) {
            this.consulta.update((actual) => ({ ...actual, intento: actual.intento + 1 }));
          } else this.actualizarOrden.emit('cierre');
        },
      });
  }

  private denegar(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse) || ![401, 403].includes(error.status)) return false;
    this.denegado.set(true);
    this.pagina.set(null);
    this.foto.set(null);
    this.errorConsulta.set(this.t.sinAcceso);
    this.accesoDenegado.emit(error.status);
    return true;
  }
}
