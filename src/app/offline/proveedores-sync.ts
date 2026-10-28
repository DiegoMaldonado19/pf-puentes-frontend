import { DestroyRef, inject, Provider } from '@angular/core';
import { AuthService } from '../core/auth/auth';
import { AccesoLocal } from './acceso-local';
import { BaseLocal } from './base-local';
import { MotorSync } from './motor-sync';
import { SesionOffline } from './sesion-offline';
import { TransporteHttp } from './transporte-http';

export function crearMotorSync(): MotorSync {
  inject(AccesoLocal);
  const motor = new MotorSync(inject(BaseLocal), inject(SesionOffline), inject(TransporteHttp));
  const eventos = inject(AuthService).eventosSesion.subscribe((evento) => {
    if (evento.tipo === 'login') motor.reanudar();
  });
  inject(DestroyRef).onDestroy(() => {
    eventos.unsubscribe();
    motor.detener();
  });
  return motor;
}

export const proveerSync: Provider = { provide: MotorSync, useFactory: crearMotorSync };
