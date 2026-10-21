import { InjectionToken, Signal, signal } from '@angular/core';

export type RolPuentes = 'ADMINISTRADOR' | 'CATEDRATICO' | 'ESTUDIANTE' | 'PROFESIONAL_EXTERNO';

/**
 * Puerto de integración con la sesión de P2: solo decide qué acciones se muestran (DT-FE-11); la
 * autorización real la hace el backend. Sin sesión (o hasta que P2 lo provea) vale null y la UI
 * queda en modo público. P2 lo sobrescribe así, sin que este módulo importe su AuthService:
 *
 *   { provide: ROL_PUENTES, useFactory: () => inject(AuthService).rol }
 */
export const ROL_PUENTES = new InjectionToken<Signal<RolPuentes | null>>('ROL_PUENTES', {
  providedIn: 'root',
  factory: () => signal<RolPuentes | null>(null).asReadonly(),
});
