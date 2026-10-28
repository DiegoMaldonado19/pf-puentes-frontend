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
import { AuthService } from '../../core/auth/auth';
import { MotorFormularioComponent } from '../formulario/motor-formulario/motor-formulario';
import { TEXTOS } from '../../shared/textos';
import { fechaSinHora } from '../puentes/formato';
import { ChipEstadoInspeccion } from './chip-estado-inspeccion';
import { referenciasDeElemento } from './esquema';
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

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly rol = this.auth.rol;
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
      untracked(() => void this.store.cargar(id));
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
