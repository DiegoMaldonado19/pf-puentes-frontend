import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import { Rol } from '../../core/auth/modelos';
import { Notificacion, PaginaNotificaciones } from '../../core/notificaciones/modelos';
import { TEXTOS } from '../../shared/textos';
import { Icono, NombreIcono } from '../../shared/ui/icono';

/** Avisos que genera la revisión de inspecciones (B10). Los demás tipos quedan en la campana. */
export const TIPOS_ALERTA: readonly string[] = ['INSPECCION_VENCIDA', 'RUTINARIO_SIN_PROGRAMAR'];

export interface AccesoInicio {
  readonly ruta: string;
  readonly etiqueta: string;
  readonly icono: NombreIcono;
}

/** Accesos de cada rol a pantallas que ya existen; no crea permisos nuevos. */
export function accesosDelRol(rol: Rol | null): AccesoInicio[] {
  const comunes: AccesoInicio[] = [
    { ruta: '/puentes', etiqueta: TEXTOS.puentes.nav.inventario, icono: 'puente' },
    { ruta: '/puentes/mapa', etiqueta: TEXTOS.puentes.nav.mapa, icono: 'mapa' },
    { ruta: '/foro', etiqueta: TEXTOS.puentes.nav.foro, icono: 'foro' },
  ];
  if (rol === 'ADMINISTRADOR') {
    return [
      ...comunes,
      { ruta: '/mantenimiento', etiqueta: TEXTOS.shell.mantenimiento, icono: 'mantenimiento' },
      { ruta: '/admin/usuarios', etiqueta: TEXTOS.auth.nav.usuarios, icono: 'usuarios' },
      { ruta: '/admin/formularios', etiqueta: TEXTOS.auth.nav.formularios, icono: 'formulario' },
      { ruta: '/admin/auditoria', etiqueta: TEXTOS.auth.nav.auditoria, icono: 'auditoria' },
    ];
  }
  if (rol === 'CATEDRATICO') {
    return [
      ...comunes,
      { ruta: '/inspecciones', etiqueta: TEXTOS.inspecciones.nav, icono: 'inspeccion' },
      { ruta: '/revisiones', etiqueta: TEXTOS.revision.titulo, icono: 'revision' },
      { ruta: '/mantenimiento', etiqueta: TEXTOS.shell.mantenimiento, icono: 'mantenimiento' },
    ];
  }
  if (rol === 'ESTUDIANTE') {
    return [
      ...comunes,
      { ruta: '/inspecciones', etiqueta: TEXTOS.inspecciones.nav, icono: 'inspeccion' },
      { ruta: '/mis-revisiones', etiqueta: TEXTOS.revision.misPendientes, icono: 'revision' },
    ];
  }
  return comunes;
}

@Component({
  selector: 'app-inicio',
  imports: [RouterLink, DatePipe, Icono],
  templateUrl: './inicio.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Inicio {
  protected readonly t = TEXTOS.inicio;
  private readonly http = inject(HttpClient);
  private readonly destruir = inject(DestroyRef);
  protected readonly auth = inject(AuthService);

  protected readonly accesos = computed(() => accesosDelRol(this.auth.rol()));
  protected readonly esAdmin = computed(() => this.auth.rol() === 'ADMINISTRADOR');
  protected readonly alertas = signal<Notificacion[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal(false);
  protected readonly ejecutando = signal(false);
  protected readonly mensaje = signal<string | null>(null);

  constructor() {
    this.cargar();
  }

  protected ejecutarAlertas(): void {
    if (this.ejecutando()) {
      return;
    }
    this.ejecutando.set(true);
    this.mensaje.set(null);
    this.http
      .post('/api/v1/procesos/alertas-inspeccion/ejecucion', {})
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: () => {
          this.ejecutando.set(false);
          this.mensaje.set(this.t.ejecutadoOk);
          this.cargar();
        },
        error: (error: HttpErrorResponse) => {
          this.ejecutando.set(false);
          this.mensaje.set(error.status === 409 ? this.t.ejecutadoEnCurso : this.t.ejecutadoError);
        },
      });
  }

  private cargar(): void {
    this.cargando.set(true);
    this.error.set(false);
    this.http
      .get<PaginaNotificaciones>('/api/v1/notificaciones', { params: { page: 0, size: 50 } })
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: (pagina) => {
          this.alertas.set(pagina.contenido.filter((n) => TIPOS_ALERTA.includes(n.tipo)));
          this.cargando.set(false);
        },
        error: () => {
          this.error.set(true);
          this.cargando.set(false);
        },
      });
  }
}
