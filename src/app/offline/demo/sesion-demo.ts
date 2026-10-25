import { Component, inject, OnDestroy } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth';
import { TEXTOS } from '../../shared/textos';
import { AccesoLocal, crearAccesoLocal } from '../acceso-local';
import { BaseLocal } from '../base-local';
import { MotorSync } from '../motor-sync';
import { PersistenciaOffline } from '../persistencia';
import { SesionOffline } from '../sesion-offline';
import { VistaLocal } from '../vista-local';
import { FORMULARIO, prepararFixtures, PROPIETARIOS, PUENTE } from './fixtures';

/** Solo build base-offline; HTTP P2 se sustituye en Playwright, nunca en producción. */
@Component({
  imports: [VistaLocal],
  providers: [
    { provide: BaseLocal, useFactory: () => new BaseLocal('puentes-offline-sesion-demo') },
    SesionOffline,
    { provide: AccesoLocal, useFactory: crearAccesoLocal },
  ],
  template: `
    <h1>{{ t.harness }}</h1>
    <button type="button" (click)="preparar()">{{ t.preparar }}</button>
    <app-vista-local />
  `,
})
export class SesionDemo implements OnDestroy {
  readonly t = TEXTOS.accesoLocal;
  readonly db = inject(BaseLocal);
  readonly auth = inject(AuthService);
  readonly acceso = inject(AccesoLocal);
  readonly remoto = inject(SesionOffline);
  readonly persistencia = new PersistenciaOffline(this.db);
  readonly propietario = PROPIETARIOS[0];
  envios = 0;
  readonly motor = new MotorSync(this.db, this.remoto, {
    ejecutar: async () => {
      this.envios++;
      return { tipo: 'sesion', mensaje: TEXTOS.offline.pausa };
    },
  });
  constructor() {
    window.__sesionDemo = this;
  }
  entrar() {
    return firstValueFrom(this.auth.iniciarSesion('fixture@prueba.test', 'fixture'));
  }
  salir() {
    return firstValueFrom(this.auth.cerrarSesion());
  }
  async preparar(): Promise<void> {
    await prepararFixtures(this.db);
    if (!(await this.acceso.habilitarPreparada(this.propietario))) return;
    await this.persistencia.crear(this.propietario, PUENTE, FORMULARIO, { fixture: true });
  }
  async editar(): Promise<void> {
    const [captura] = await this.acceso.inspecciones();
    if (captura)
      await this.persistencia.editar(captura.propietario_id, captura.id, { editada: true });
  }
  ngOnDestroy(): void {
    this.motor.detener();
    delete window.__sesionDemo;
    this.db.close();
  }
}
declare global {
  interface Window {
    __sesionDemo?: SesionDemo;
  }
}
