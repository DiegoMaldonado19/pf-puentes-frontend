import { inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../core/auth/auth';
import { SesionOffline as PuertoSesionOffline } from './modelos';

/** Adaptador remoto P2. No habilita acceso local ni configura transporte. */
@Injectable({ providedIn: 'root' })
export class SesionOffline implements PuertoSesionOffline {
  private readonly auth = inject(AuthService);
  private revision = 0;
  private comprobarAcceso?: (propietario: string) => Promise<boolean>;
  private readonly cancelaciones = new Set<() => void>();

  coordinarAcceso(comprobar: (propietario: string) => Promise<boolean>): void {
    this.comprobarAcceso = comprobar;
  }

  cancelarEjecucion(): void {
    this.revision++;
    for (const cancelar of this.cancelaciones) cancelar();
  }

  constructor() {
    this.auth.eventosSesion.pipe(takeUntilDestroyed()).subscribe((evento) => {
      if (evento.tipo !== 'login') this.revision++;
    });
  }

  propietarioActual(): string | null {
    return this.auth.autenticado() ? (this.auth.usuario()?.id ?? null) : null;
  }

  async preparar(propietario_id: string): Promise<boolean> {
    if (this.propietarioActual() !== propietario_id) return false;
    const revision = this.revision;
    if (this.comprobarAcceso && !(await this.comprobarAcceso(propietario_id))) return false;
    const sesion = await firstValueFrom(this.auth.renovar());
    const permitido = !this.comprobarAcceso || (await this.comprobarAcceso(propietario_id));
    return (
      permitido &&
      revision === this.revision &&
      sesion?.usuario.id === propietario_id &&
      this.propietarioActual() === propietario_id
    );
  }

  alInvalidar(cancelar: () => void): () => void {
    this.cancelaciones.add(cancelar);
    const suscripcion = this.auth.eventosSesion.subscribe((evento) => {
      if (evento.tipo === 'login') return;
      cancelar();
    });
    return () => {
      suscripcion.unsubscribe();
      this.cancelaciones.delete(cancelar);
    };
  }
}
