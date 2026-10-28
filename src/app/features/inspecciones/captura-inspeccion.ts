import { DecimalPipe } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { EMPTY, expand, firstValueFrom, reduce } from 'rxjs';
import { AuthService } from '../../core/auth/auth';
import { IcPreliminar } from '../../shared/ic-preliminar/ic-preliminar';
import { EstimacionPreliminarIcDTO, JuegoPesosDTO } from '../admin/pesos/modelos';
import { PesosService } from '../admin/pesos/pesos.service';
import { RecalculoIc } from '../admin/pesos/recalculo-ic';
import { MotorFormularioComponent } from '../formulario/motor-formulario/motor-formulario';
import { TEXTOS } from '../../shared/textos';
import { fechaSinHora } from '../puentes/formato';
import { ChipEstadoInspeccion } from './chip-estado-inspeccion';
import { referenciasDeElemento } from './esquema';
import { mensajeInspeccion } from './errores';
import { InspeccionStore } from './inspeccion-store';
import { MINIMO_FOTOS_ENVIO, publicaAlEnviar } from './modelos';
import { FotoParaSubir, PanelArchivos } from './panel-archivos';
import { PanelAcompanantes } from './panel-acompanantes';

/**
 * Shell de captura (`/inspecciones/:id`): el mismo componente edita un borrador propio y muestra
 * en solo lectura todo lo demás (RN-FRM-05). Nunca cambia `estado` por su cuenta: el envío lo hace
 * el servidor.
 */
@Component({
  selector: 'app-captura-inspeccion',
  imports: [
    ChipEstadoInspeccion,
    DecimalPipe,
    MotorFormularioComponent,
    PanelAcompanantes,
    PanelArchivos,
    RouterLink,
    IcPreliminar,
    RecalculoIc,
  ],
  providers: [InspeccionStore],
  templateUrl: './captura-inspeccion.html',
})
export class CapturaInspeccion {
  readonly id = input.required<string>();

  protected readonly store = inject(InspeccionStore);
  protected readonly t = TEXTOS.inspecciones.captura;
  protected readonly comun = TEXTOS.inspecciones.comun;
  protected readonly textosAcompanantes = TEXTOS.inspecciones.acompanantes;
  protected readonly fechaSinHora = fechaSinHora;
  protected readonly minimoFotos = MINIMO_FOTOS_ENVIO;
  protected readonly confirmandoEnvio = signal(false);
  protected readonly confirmandoBaja = signal(false);
  protected readonly enConexion = signal(typeof navigator === 'undefined' || navigator.onLine);
  protected readonly estimacion = signal<EstimacionPreliminarIcDTO | null>(null);
  protected readonly estimando = signal(false);
  protected readonly errorIc = signal('');
  protected readonly juegos = signal<readonly JuegoPesosDTO[]>([]);
  protected readonly errorJuegos = signal('');

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly pesos = inject(PesosService);

  protected readonly rol = this.auth.rol;
  protected readonly puedeVerRecalculos = computed(
    () =>
      this.store.inspeccion()?.estado === 'PUBLICADA' &&
      (this.rol() === 'CATEDRATICO' || this.rol() === 'ADMINISTRADOR'),
  );
  protected readonly referencias = computed(() => {
    const esquema = this.store.version()?.esquema;
    return esquema ? referenciasDeElemento(esquema) : [];
  });
  protected readonly publica = computed(() => publicaAlEnviar(this.rol()));
  protected readonly esAutor = computed(
    () => this.store.inspeccion()?.autor_id === this.auth.usuario()?.id,
  );
  protected readonly textoEnviar = computed(() => {
    const rol = this.rol();
    return rol ? this.t.enviar[rol] : this.t.enviar.ESTUDIANTE;
  });
  /** Profesional sin verificar: el servidor responde 403, pero la UI lo explica antes (analisis §1.2). */
  protected readonly puedeCorregir = computed(() => {
    const inspeccion = this.store.inspeccion();
    return (
      inspeccion?.estado === 'PUBLICADA' &&
      !inspeccion.superada &&
      (this.rol() === 'ESTUDIANTE' || this.publica())
    );
  });
  protected readonly horaGuardado = computed(() => {
    const instante = this.store.guardadoEn();
    return instante
      ? this.t.guardado.replace(
          '{hora}',
          instante.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' }),
        )
      : '';
  });

  constructor() {
    effect(() => {
      const id = this.id();
      this.estimacion.set(null);
      untracked(() => void this.store.cargar(id));
    });
    effect(() => {
      if (this.store.sucio()) this.estimacion.set(null);
    });
    effect((limpiar) => {
      const inspeccion = this.store.inspeccion();
      this.juegos.set([]);
      this.errorJuegos.set('');
      if (inspeccion?.estado !== 'PUBLICADA' || this.rol() !== 'ADMINISTRADOR') return;
      const sub = this.pesos
        .listarJuegos(inspeccion.formulario.id, 0, 100)
        .pipe(
          expand((pagina) =>
            pagina.page + 1 < pagina.total_pages
              ? this.pesos.listarJuegos(inspeccion.formulario.id, pagina.page + 1, 100)
              : EMPTY,
          ),
          reduce((juegos, pagina) => [...juegos, ...pagina.content], [] as JuegoPesosDTO[]),
        )
        .subscribe({
          next: (juegos) => this.juegos.set(juegos),
          error: () =>
            this.errorJuegos.set('No se pudieron cargar los juegos de pesos para recalcular.'),
        });
      limpiar(() => sub.unsubscribe());
    });
    const alCambiarRed = () => this.enConexion.set(navigator.onLine);
    window.addEventListener('online', alCambiarRed);
    window.addEventListener('offline', alCambiarRed);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('online', alCambiarRed);
      window.removeEventListener('offline', alCambiarRed);
    });
  }

  /** Guard de salida: guarda lo pendiente; si el servidor lo rechaza, no se pierde en silencio. */
  async puedeSalir(): Promise<boolean> {
    if (!this.store.editable() || !this.store.sucio()) return true;
    return this.store.guardar();
  }

  protected imprimir(): void {
    if (!this.store.editable()) window.print();
  }

  protected exportarJson(): void {
    const inspeccion = this.store.inspeccion();
    const version = this.store.version();
    if (!inspeccion || !version || this.store.editable()) return;
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              inspeccion,
              formulario: { id: version.id, codigo: version.codigo, esquema: version.esquema },
            },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      ),
    );
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `inspeccion-${inspeccion.id}-${version.codigo}.json`;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  protected async estimarIc(): Promise<void> {
    if (!this.store.editable() || this.estimando() || this.store.ocupado()) return;
    this.estimando.set(true);
    this.errorIc.set('');
    this.estimacion.set(null);
    try {
      if (this.store.sucio() && !(await this.store.guardar())) return;
      const inspeccion = this.store.inspeccion();
      if (!inspeccion) return;
      const resultado = await firstValueFrom(
        this.pesos.estimarIcPreliminarPorInspeccion(inspeccion.id),
      );
      if (this.store.inspeccion() === inspeccion && !this.store.sucio())
        this.estimacion.set(resultado);
    } catch (error) {
      this.errorIc.set(mensajeInspeccion(error));
    } finally {
      this.estimando.set(false);
    }
  }

  protected corregirRuta(): string[] {
    return ['/inspecciones/nueva', this.store.inspeccion()?.puente.id ?? ''];
  }

  protected subirFoto({ foto, elementoRef }: FotoParaSubir): void {
    void this.store.subirFoto(foto, elementoRef);
  }

  protected async confirmarEnvio(): Promise<void> {
    this.confirmandoEnvio.set(false);
    await this.store.enviar();
  }

  protected async eliminar(): Promise<void> {
    this.confirmandoBaja.set(false);
    if (await this.store.eliminarBorrador()) {
      await this.router.navigateByUrl('/inspecciones');
    }
  }

  protected etiquetaFotos(): string {
    return this.t.checkFotos
      .replace('{minimo}', String(this.minimoFotos))
      .replace('{subidas}', String(this.store.fotosSubidas()));
  }

  protected distancia(): string {
    const metros = this.store.inspeccion()?.distancia_a_puente_m;
    return metros === undefined
      ? ''
      : this.t.distancia.replace('{metros}', Math.round(metros).toString());
  }
}
