import { Component, inject, OnDestroy, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth';
import { TEXTOS } from '../../shared/textos';
import { AccesoLocal, crearAccesoLocal } from '../acceso-local';
import { BaseLocal } from '../base-local';
import { MotorSync } from '../motor-sync';
import { PersistenciaOffline } from '../persistencia';
import { SesionOffline } from '../sesion-offline';
import { VistaLocal } from '../vista-local';
import { PreparacionLocal, ProgresoPreparacion } from '../preparacion';
import { PROPIETARIOS } from './fixtures';
import { proveedoresFicticios } from './preparacion-fixtures';

/** Solo build base-offline; HTTP P2 se sustituye en Playwright, nunca en producción. */
@Component({
  imports: [VistaLocal],
  providers: [
    { provide: BaseLocal, useFactory: () => new BaseLocal('puentes-offline-sesion-demo') },
    SesionOffline,
    { provide: AccesoLocal, useFactory: crearAccesoLocal },
    { provide: MotorSync, useValue: null },
  ],
  template: `
    <h1>{{ t.harness }}</h1>
    <button type="button" (click)="preparar()">{{ t.preparar }}</button>
    <p role="status">{{ estado() }}</p>
    @for (paso of progreso(); track $index) {
      <p>{{ paso.proveedor }}: {{ paso.estado }}</p>
    }
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
  readonly progreso = signal<ProgresoPreparacion[]>([]);
  readonly estado = signal('');
  readonly preparacion = new PreparacionLocal(
    this.db,
    this.acceso,
    this.remoto,
    proveedoresFicticios(this.db),
  );
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
    this.progreso.set([]);
    this.estado.set('');
    const resultado = await this.preparacion.preparar(this.propietario, (paso) =>
      this.progreso.update((pasos) => [...pasos, paso]),
    );
    if (!resultado.completa) {
      this.estado.set(this.t.preparacionIncompleta);
      return;
    }
    const { preparacion } = await this.preparacion.consultar(this.propietario);
    const asignacion = preparacion?.asignaciones[0];
    if (!preparacion || !asignacion) return;
    await this.persistencia.crear(
      this.propietario,
      asignacion.puente_id,
      preparacion.formulario_version_id,
      { fixture: true },
      {
        asignacion_id: asignacion.id,
        curso_id: asignacion.curso_id,
        inscripcion_id: asignacion.inscripcion_id,
      },
    );
    this.estado.set(this.t.preparacionCompleta);
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
