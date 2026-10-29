import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth';
import { TEXTOS } from '../../shared/textos';
import { CompositorMenciones } from './compositor-menciones';
import { DialogoModeracion } from './dialogo-moderacion';
import {
  dentroDeVentanaEdicion,
  esUuid,
  formatearFechaUtc,
  nombrarMenciones,
  tieneRolModeracion,
} from './modelos';
import { Observable, take } from 'rxjs';
import {
  ComentarioForoInspeccion,
  ContextoForoInspeccion,
  FORO_INSPECCION_API,
  FORO_INSPECCION_MUTACIONES_API,
  MENCIONES_P2,
  ResultadoLecturaForoInspeccion,
  ResultadoMutacionForoInspeccion,
} from './puertos';

type EstadoVista =
  'CARGANDO' | 'PUBLICADA' | 'NO_PUBLICADA' | 'SIN_PERMISOS' | 'ERROR' | 'NO_INTEGRADO';

@Component({
  selector: 'app-discusion-inspeccion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, CompositorMenciones, DialogoModeracion],
  templateUrl: './discusion-inspeccion.html',
})
export class DiscusionInspeccion {
  protected readonly textos = TEXTOS.inspeccionForo;
  protected readonly estado = signal<EstadoVista>('CARGANDO');
  protected readonly mensajeError = signal<string | null>(null);
  protected readonly resultado = signal<ResultadoLecturaForoInspeccion | null>(null);
  protected readonly publicando = signal(false);
  protected readonly errorComentario = signal('');
  protected readonly editando = signal<string | null>(null);
  protected readonly borrador = signal('');
  protected readonly moderacion = signal<{ comentarioId?: string } | null>(null);
  protected readonly motivo = signal('');
  protected readonly puedeModerar = computed(() =>
    tieneRolModeracion(this.auth.rol() ? [this.auth.rol()!] : []),
  );
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
  private readonly compositor = viewChild(CompositorMenciones);
  private readonly menciones = inject(MENCIONES_P2);
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

  protected textoVisible(texto: string | null): string {
    return nombrarMenciones(texto ?? '', this.menciones.personas());
  }

  constructor() {
    this.menciones.cargar();
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
      this.editando.set(null);
      this.moderacion.set(null);
      this.borrador.set('');
      this.motivo.set('');
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

  protected esPropio(comentario: ComentarioForoInspeccion): boolean {
    return (
      !!this.auth.usuario() &&
      comentario.autorId === this.auth.usuario()?.id &&
      !comentario.eliminado
    );
  }

  protected puedeEditar(comentario: ComentarioForoInspeccion): boolean {
    return this.esPropio(comentario) && dentroDeVentanaEdicion(comentario.creadoEn);
  }

  protected editar(comentario: ComentarioForoInspeccion): void {
    if (!this.puedeEditar(comentario) || this.publicando()) return;
    this.editando.set(comentario.id);
    this.borrador.set(comentario.texto ?? '');
  }

  protected guardarEdicion(comentario: ComentarioForoInspeccion): void {
    const texto = this.borrador().trim();
    if (!this.inspeccionId || !this.puedeEditar(comentario) || !texto || texto.length > 10000)
      return;
    this.mutar(this.mutaciones.editar(this.inspeccionId, comentario.id, texto));
  }

  protected borrar(comentario: ComentarioForoInspeccion): void {
    if (!this.inspeccionId || !this.esPropio(comentario)) return;
    this.mutar(this.mutaciones.borrar(this.inspeccionId, comentario.id));
  }

  protected abrirModeracion(comentarioId?: string): void {
    if (!this.puedeModerar() || this.publicando()) return;
    this.motivo.set('');
    this.errorComentario.set('');
    this.moderacion.set({ comentarioId });
  }

  protected confirmarModeracion(): void {
    const dialogo = this.moderacion();
    const motivo = this.motivo().trim();
    if (!dialogo || !this.inspeccionId || !this.puedeModerar()) return;
    if (!motivo) {
      this.errorComentario.set('Debes indicar un motivo.');
      return;
    }
    this.mutar(
      dialogo.comentarioId
        ? this.mutaciones.ocultarComentario(this.inspeccionId, dialogo.comentarioId, motivo)
        : this.mutaciones.cerrarHilo(this.inspeccionId, motivo),
    );
  }

  private mutar(peticion: Observable<ResultadoMutacionForoInspeccion>): void {
    const id = this.inspeccionId;
    if (!id || this.publicando()) return;
    const carga = this.carga;
    const propietario = this.auth.usuario()?.id;
    this.publicando.set(true);
    this.errorComentario.set('');
    peticion.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (resultado) => {
        if (carga !== this.carga) return;
        this.publicando.set(false);
        if (propietario !== this.auth.usuario()?.id) return;
        if (resultado.estado === 'OK') {
          this.editando.set(null);
          this.moderacion.set(null);
          this.cargar(id);
        } else {
          this.errorComentario.set(
            resultado.estado === 'ERROR'
              ? resultado.mensaje
              : {
                  SIN_PERMISOS: 'No tienes permisos.',
                  NO_PUBLICADA: 'La inspección no está publicada.',
                  CERRADO: 'El hilo está cerrado.',
                  FUERA_DE_PLAZO: 'El plazo para editar ha vencido.',
                  MOTIVO_REQUERIDO: 'Debes indicar un motivo.',
                  NO_INTEGRADO: 'Servicio no disponible.',
                }[resultado.estado],
          );
        }
      },
      error: () => {
        if (carga !== this.carga) return;
        this.publicando.set(false);
        this.errorComentario.set('No se pudo guardar el cambio. Puedes reintentarlo.');
      },
    });
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
      .crear(id, {
        texto: entrada.texto.trim(),
        elementoRef: entrada.elementoRef || null,
        menciones: this.compositor()?.idsSeleccionados(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          if (carga !== this.carga) return;
          this.publicando.set(false);
          if (resultado.estado === 'OK') {
            this.formulario.reset();
            this.compositor()?.reiniciar();
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
