import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, Observable, of } from 'rxjs';
import { TEXTOS } from '../../../shared/textos';
import { FormularioService } from '../../formulario/formulario.service';
import {
  CampoExtraDTO,
  EsquemaBaseDTO,
  ErrorValidacionCampo,
  FormularioVersionDTO,
  TipoCampoExtra,
} from '../../formulario/modelos';
import { MotorFormularioComponent } from '../../formulario/motor-formulario/motor-formulario';
import {
  claveDesdeTitulo,
  claveEsValida,
  componerVistaPrevia,
  extrasDesdeEsquema,
  MAXIMO_CAMPOS_EXTRA,
  TIPOS_CAMPO,
} from './campos-extra';
import { ModalPublicar } from './modal-publicar';

type Pestana = 'campos' | 'vista' | 'avanzado';

/** Lo que el administrador escribe en el formulario "Añadir campo" (textos sin convertir). */
interface BorradorCampo {
  seccion: string;
  titulo: string;
  clave: string;
  claveEditada: boolean;
  tipo: TipoCampoExtra;
  obligatorio: boolean;
  opciones: string;
  minimo: string;
  maximo: string;
  unidad: string;
  ayuda: string;
}

const BORRADOR_VACIO: BorradorCampo = {
  seccion: '',
  titulo: '',
  clave: '',
  claveEditada: false,
  tipo: 'texto',
  obligatorio: false,
  opciones: '',
  minimo: '',
  maximo: '',
  unidad: '',
  ayuda: '',
};

/**
 * Constructor de formularios (B2): el esquema base es fijo y el administrador añade campos
 * adicionales con un formulario. El servidor compone, valida y guarda; la vista previa y el JSON
 * de solo lectura son solo para revisar.
 */
@Component({
  selector: 'app-editor-formulario',
  imports: [RouterLink, MotorFormularioComponent, ModalPublicar],
  templateUrl: './editor-formulario.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorFormulario implements OnInit {
  protected readonly t = TEXTOS.constructorFormulario;
  protected readonly tAdmin = TEXTOS.formulario.admin;
  protected readonly tipos = TIPOS_CAMPO;
  protected readonly maximo = MAXIMO_CAMPOS_EXTRA;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formularios = inject(FormularioService);
  private readonly destruir = inject(DestroyRef);

  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal(false);
  protected readonly pestana = signal<Pestana>('campos');
  protected readonly base = signal<EsquemaBaseDTO | null>(null);
  protected readonly version = signal<FormularioVersionDTO | null>(null);
  protected readonly codigo = signal('V2.0.0');
  protected readonly extras = signal<CampoExtraDTO[]>([]);
  protected readonly erroresServidor = signal<ErrorValidacionCampo[]>([]);
  protected readonly borrador = signal<BorradorCampo>({ ...BORRADOR_VACIO });
  protected readonly errorBorrador = signal<string | null>(null);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly guardando = signal(false);
  protected readonly mostrarModalPublicar = signal(false);

  private idVersion: string | null = null;

  protected readonly esNuevo = signal(true);
  protected readonly esSoloLectura = computed(() => {
    const version = this.version();
    return version !== null && version.estado !== 'BORRADOR';
  });
  protected readonly seccionesAbiertas = computed(
    () => this.base()?.secciones.filter((s) => s.admite_campos_extra) ?? [],
  );
  protected readonly seccionesFijas = computed(
    () => this.base()?.secciones.filter((s) => !s.admite_campos_extra) ?? [],
  );
  protected readonly vistaPrevia = computed(() => {
    const base = this.base();
    return base ? componerVistaPrevia(base.esquema, this.extras()) : null;
  });
  protected readonly esquemaJson = computed(() => {
    const vista = this.vistaPrevia();
    return vista ? JSON.stringify(vista, null, 2) : '';
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.idVersion = id;
    this.esNuevo.set(id === null);
    const version$: Observable<FormularioVersionDTO | null> = id
      ? this.formularios.detalle(id)
      : of(null);
    forkJoin({ base: this.formularios.esquemaBase(), version: version$ })
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: ({ base, version }) => {
          this.base.set(base);
          if (version) {
            this.version.set(version);
            this.codigo.set(version.codigo);
            this.extras.set(extrasDesdeEsquema(version.esquema));
          }
          this.cargando.set(false);
        },
        error: () => {
          this.errorCarga.set(true);
          this.cargando.set(false);
        },
      });
  }

  protected cambiarPestana(pestana: Pestana): void {
    this.pestana.set(pestana);
  }

  protected pestanaActiva(pestana: string): boolean {
    return this.pestana() === pestana;
  }

  protected actualizarBorrador(cambio: Partial<BorradorCampo>): void {
    const actual = this.borrador();
    const siguiente = { ...actual, ...cambio };
    // Mientras la clave no se haya escrito a mano, sigue al título
    if (cambio.titulo !== undefined && !actual.claveEditada) {
      siguiente.clave = claveDesdeTitulo(cambio.titulo);
    }
    this.borrador.set(siguiente);
  }

  protected marcarClaveEditada(clave: string): void {
    this.borrador.set({ ...this.borrador(), clave, claveEditada: true });
  }

  protected agregarCampo(): void {
    const b = this.borrador();
    const error = this.errorDelBorrador(b);
    this.errorBorrador.set(error);
    if (error) return;
    this.extras.set([...this.extras(), this.aCampo(b)]);
    this.borrador.set({ ...BORRADOR_VACIO });
    this.validar();
  }

  protected quitarCampo(indice: number): void {
    this.extras.set(this.extras().filter((_, i) => i !== indice));
    this.validar();
  }

  /** Errores del servidor que corresponden a la fila `indice` del listado. */
  protected erroresDeFila(indice: number): string[] {
    const prefijo = `campos_extra[${indice}].`;
    return this.erroresServidor()
      .filter((e) => e.campo.startsWith(prefijo))
      .map((e) => e.mensaje);
  }

  /** Errores generales de la lista (por ejemplo, el máximo de campos). */
  protected erroresDeLista(): string[] {
    return this.erroresServidor()
      .filter((e) => !e.campo.startsWith('campos_extra['))
      .map((e) => e.mensaje);
  }

  protected tituloDeSeccion(clave: string): string {
    return this.base()?.secciones.find((s) => s.clave === clave)?.titulo ?? clave;
  }

  protected etiquetaTipo(tipo: TipoCampoExtra): string {
    return TIPOS_CAMPO.find((opcion) => opcion.valor === tipo)?.etiqueta ?? tipo;
  }

  protected guardar(): void {
    if (this.guardando() || this.esSoloLectura()) return;
    if (this.esNuevo() && !this.codigo().trim()) {
      this.errorGeneral.set(this.t.errorCodigo);
      return;
    }
    this.guardando.set(true);
    this.errorGeneral.set(null);
    const campos = this.extras();
    const peticion: Observable<unknown> = this.esNuevo()
      ? this.formularios.crearBorrador({ codigo: this.codigo().trim(), campos_extra: campos })
      : this.formularios.editarBorrador(this.idVersion ?? '', { campos_extra: campos });
    peticion.pipe(takeUntilDestroyed(this.destruir)).subscribe({
      next: () => this.router.navigate(['/admin/formularios']),
      error: (error: HttpErrorResponse) => {
        this.guardando.set(false);
        this.erroresServidor.set(this.erroresDelServidor(error));
        this.errorGeneral.set(
          error.status === 409 ? this.t.errorCodigoDuplicado : this.t.errorGeneral,
        );
      },
    });
  }

  protected abrirPublicar(): void {
    this.mostrarModalPublicar.set(true);
  }

  protected alPublicarExitoso(): void {
    this.mostrarModalPublicar.set(false);
    this.router.navigate(['/admin/formularios']);
  }

  /** Revalida en el servidor la lista completa; no guarda nada. */
  private validar(): void {
    this.formularios
      .validarComposicion(this.extras())
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: (resultado) => this.erroresServidor.set(resultado.errores),
        error: () => this.erroresServidor.set([]),
      });
  }

  private errorDelBorrador(b: BorradorCampo): string | null {
    if (this.extras().length >= MAXIMO_CAMPOS_EXTRA) return this.t.errorTope;
    if (!b.seccion) return this.t.errorSeccion;
    if (!b.titulo.trim()) return this.t.errorTitulo;
    if (!claveEsValida(b.clave)) return this.t.errorClave;
    if (this.extras().some((e) => e.seccion === b.seccion && e.clave === b.clave)) {
      return this.t.errorCampoRepetido;
    }
    if (b.tipo === 'opcion' && this.lineas(b.opciones).length === 0) return this.t.errorOpciones;
    if (b.minimo !== '' && b.maximo !== '' && Number(b.minimo) > Number(b.maximo)) {
      return this.t.errorLimites;
    }
    return null;
  }

  private aCampo(b: BorradorCampo): CampoExtraDTO {
    const numerico = b.tipo === 'numero' || b.tipo === 'entero';
    return {
      seccion: b.seccion,
      clave: b.clave,
      titulo: b.titulo.trim(),
      tipo: b.tipo,
      obligatorio: b.obligatorio,
      opciones: b.tipo === 'opcion' ? this.lineas(b.opciones) : null,
      minimo: numerico && b.minimo !== '' ? Number(b.minimo) : null,
      maximo: numerico && b.maximo !== '' ? Number(b.maximo) : null,
      unidad: numerico && b.unidad.trim() ? b.unidad.trim() : null,
      ayuda: b.ayuda.trim() ? b.ayuda.trim() : null,
    };
  }

  private lineas(texto: string): string[] {
    return texto
      .split('\n')
      .map((linea) => linea.trim())
      .filter((linea) => linea.length > 0);
  }

  private erroresDelServidor(error: HttpErrorResponse): ErrorValidacionCampo[] {
    const errores = (error.error as { errores?: ErrorValidacionCampo[] } | null)?.errores;
    return Array.isArray(errores) ? errores : [];
  }
}
