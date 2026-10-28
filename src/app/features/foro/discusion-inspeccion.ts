import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth';
import { TEXTOS } from '../../shared/textos';
import { esUuid, formatearFechaUtc } from './modelos';
import {
  ComentarioForoInspeccion,
  ContextoForoInspeccion,
  FORO_INSPECCION_API,
  FORO_INSPECCION_MUTACIONES_API,
  ResultadoLecturaForoInspeccion,
} from './puertos';

type EstadoVista =
  'CARGANDO' | 'PUBLICADA' | 'NO_PUBLICADA' | 'SIN_PERMISOS' | 'ERROR' | 'NO_INTEGRADO';

@Component({
  selector: 'app-discusion-inspeccion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './discusion-inspeccion.html',
})
export class DiscusionInspeccion {
  protected readonly textos = TEXTOS.inspeccionForo;
  protected readonly estado = signal<EstadoVista>('CARGANDO');
  protected readonly mensajeError = signal<string | null>(null);
  protected readonly resultado = signal<ResultadoLecturaForoInspeccion | null>(null);
  protected readonly publicando = signal(false);
  protected readonly errorComentario = signal('');
  protected readonly formulario = new FormGroup({
    texto: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(10000)],
    }),
    elementoRef: new FormControl('', { nonNullable: true }),
  });
  protected readonly auth = inject(AuthService);

  private readonly ruta = inject(ActivatedRoute);
  private readonly api = inject(FORO_INSPECCION_API);
  private readonly mutaciones = inject(FORO_INSPECCION_MUTACIONES_API);
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
  protected readonly pagina = computed(() => {
    const actual = this.resultado();
    return actual?.estado === 'PUBLICADA' ? actual.pagina : null;
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
      this.formulario.reset();
      this.publicando.set(false);
      this.errorComentario.set('');
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

  protected comentar(): void {
    const id = this.inspeccionId;
    const entrada = this.formulario.getRawValue();
    if (
      !id ||
      !this.auth.usuario() ||
      this.contexto()?.cerrado ||
      this.publicando() ||
      this.formulario.invalid ||
      !entrada.texto.trim()
    )
      return;
    const carga = this.carga;
    this.publicando.set(true);
    this.errorComentario.set('');
    this.mutaciones
      .crear(id, { texto: entrada.texto.trim(), elementoRef: entrada.elementoRef || null })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          if (carga !== this.carga) return;
          this.publicando.set(false);
          if (resultado.estado === 'OK') {
            this.formulario.reset();
            this.cargar(id);
          } else {
            const mensajes = {
              SIN_PERMISOS: 'Inicia sesión con una cuenta autorizada para comentar.',
              NO_PUBLICADA: 'La inspección ya no está disponible para comentarios.',
              CERRADO: 'El hilo está cerrado.',
              FUERA_DE_PLAZO: 'El plazo para editar ha vencido.',
              MOTIVO_REQUERIDO: 'Debes indicar un motivo.',
              NO_INTEGRADO: 'El servicio de comentarios no está disponible.',
            };
            this.errorComentario.set(
              resultado.estado === 'ERROR' ? resultado.mensaje : mensajes[resultado.estado],
            );
            if (resultado.estado === 'CERRADO') this.reintentar();
          }
        },
        error: () => {
          if (carga !== this.carga) return;
          this.publicando.set(false);
          this.errorComentario.set(
            'No se pudo publicar el comentario. El texto se conserva para reintentar.',
          );
        },
      });
  }

  protected cargarMas(): void {
    const cursor = this.pagina()?.siguienteCursor;
    if (this.inspeccionId && cursor) this.cargar(this.inspeccionId, cursor);
  }

  private cargar(inspeccionId: string, cursor?: string): void {
    const carga = ++this.carga;
    const anteriores = cursor ? this.comentarios() : [];
    this.estado.set('CARGANDO');
    this.mensajeError.set(null);
    if (!cursor) this.resultado.set(null);

    this.api
      .leer(inspeccionId, cursor)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          if (carga !== this.carga) {
            return;
          }
          this.aplicar(
            resultado.estado === 'PUBLICADA' && cursor
              ? {
                  ...resultado,
                  pagina: {
                    ...resultado.pagina,
                    comentarios: [...anteriores, ...resultado.pagina.comentarios],
                  },
                }
              : resultado,
            inspeccionId,
          );
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
