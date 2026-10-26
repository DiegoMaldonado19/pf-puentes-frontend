import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { TEXTOS } from '../../shared/textos';
import { esUuid, formatearFechaUtc } from './modelos';
import { ComentarioForoInspeccion, ContextoForoInspeccion, FORO_INSPECCION_API, ResultadoLecturaForoInspeccion } from './puertos';

type EstadoVista =
  'CARGANDO' | 'PUBLICADA' | 'NO_PUBLICADA' | 'SIN_PERMISOS' | 'ERROR' | 'NO_INTEGRADO';

@Component({
  selector: 'app-discusion-inspeccion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './discusion-inspeccion.html',
})
export class DiscusionInspeccion {
  protected readonly textos = TEXTOS.inspeccionForo;
  protected readonly estado = signal<EstadoVista>('CARGANDO');
  protected readonly mensajeError = signal<string | null>(null);
  protected readonly resultado = signal<ResultadoLecturaForoInspeccion | null>(null);

  private readonly ruta = inject(ActivatedRoute);
  private readonly api = inject(FORO_INSPECCION_API);
  private readonly destroyRef = inject(DestroyRef);
  private carga = 0;
  private inspeccionId: string | null = null;

  protected readonly contexto = computed<ContextoForoInspeccion | null>(() => {
    const actual = this.resultado();
    return actual?.estado === 'PUBLICADA' ? actual.contexto : null;
  });

  protected readonly comentarios = computed<readonly ComentarioForoInspeccion[]>(() => {
    const actual = this.resultado();
    return actual?.estado === 'PUBLICADA' ? actual.pagina.comentarios : [];
  });

  constructor() {
    this.ruta.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((parametros) => {
      const inspeccionId = parametros.get('inspeccionId');
      if (!inspeccionId || !esUuid(inspeccionId)) {
        this.carga++;
        this.inspeccionId = null;
        this.resultado.set(null);
        this.estado.set('ERROR');
        this.mensajeError.set(this.textos.noEncontrado);
        return;
      }
      this.inspeccionId = inspeccionId;
      this.cargar(inspeccionId);
    });
  }

  protected reintentar(): void {
    if (this.inspeccionId) {
      this.cargar(this.inspeccionId);
    }
  }

  protected fechaUtc(iso: string): string {
    return formatearFechaUtc(iso);
  }

  private cargar(inspeccionId: string): void {
    const carga = ++this.carga;
    this.estado.set('CARGANDO');
    this.mensajeError.set(null);
    this.resultado.set(null);

    this.api
      .leer(inspeccionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          if (carga !== this.carga) {
            return;
          }
          this.aplicar(resultado, inspeccionId);
        },
        error: () => {
          if (carga !== this.carga) {
            return;
          }
          this.estado.set('ERROR');
          this.mensajeError.set(this.textos.error);
        },
      });
  }

  private aplicar(resultado: ResultadoLecturaForoInspeccion, inspeccionId: string): void {
    if (resultado.estado === 'PUBLICADA' && resultado.contexto.inspeccionId !== inspeccionId) {
      this.estado.set('ERROR');
      this.mensajeError.set(this.textos.contextoInvalido);
      return;
    }
    this.resultado.set(resultado);
    this.estado.set(resultado.estado);
    this.mensajeError.set(resultado.estado === 'ERROR' ? resultado.mensaje : null);
  }
}
