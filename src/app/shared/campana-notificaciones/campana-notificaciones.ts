import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  HostListener,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { Notificacion } from '../../core/notificaciones/modelos';
import { NotificacionesService } from '../../core/notificaciones/notificaciones.service';
import { TEXTOS } from '../textos';

export function esEnlaceInterno(enlace: string | null): boolean {
  return !!enlace && enlace.startsWith('/') && !enlace.startsWith('//');
}

@Component({
  selector: 'app-campana-notificaciones',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './campana-notificaciones.html',
})
export class CampanaNotificaciones {
  protected readonly servicio = inject(NotificacionesService);
  protected readonly textos = TEXTOS.notificaciones;
  protected readonly abierto = signal(false);
  protected readonly esInterno = esEnlaceInterno;

  private readonly router = inject(Router);
  private readonly elemento = inject(ElementRef<HTMLElement>);
  private readonly boton = viewChild<ElementRef<HTMLButtonElement>>('botonCampana');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  private readonly formatoFecha = new Intl.DateTimeFormat('es-GT', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'UTC',
  });

  constructor() {
    effect(() => {
      this.servicio.generacion();
      if (this.abierto() && this.servicio.sesionActiva()) {
        this.servicio.cargar(0);
        this.servicio.refrescarConteo();
      }
    });
  }

  @HostListener('document:click', ['$event'])
  protected alPulsarFuera(evento: Event): void {
    if (
      this.abierto() &&
      evento.target instanceof Node &&
      !this.elemento.nativeElement.contains(evento.target)
    ) {
      this.abierto.set(false);
    }
  }

  protected alternar(): void {
    if (this.abierto()) {
      this.cerrar();
      return;
    }
    this.abierto.set(true);
    setTimeout(() => this.panel()?.nativeElement.focus());
  }

  protected cerrar(): void {
    if (!this.abierto()) {
      return;
    }
    this.abierto.set(false);
    setTimeout(() => this.boton()?.nativeElement.focus());
  }

  protected reintentar(): void {
    this.servicio.reintentar();
  }

  protected paginaAnterior(): void {
    this.servicio.cargar(this.servicio.pagina() - 1);
  }

  protected paginaSiguiente(): void {
    this.servicio.cargar(this.servicio.pagina() + 1);
  }

  protected marcar(n: Notificacion): void {
    this.servicio.marcarLeida(n.id);
  }

  protected ver(n: Notificacion): void {
    if (!n.enlace || !esEnlaceInterno(n.enlace)) {
      return;
    }
    this.abierto.set(false);
    void this.router.navigateByUrl(n.enlace);
  }

  protected fecha(iso: string): string {
    return this.formatoFecha.format(new Date(iso));
  }
}
