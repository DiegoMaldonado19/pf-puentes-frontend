import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import { HistorialRevisiones } from './historial-revisiones';

@Component({
  selector: 'app-vista-historial-revisiones',
  imports: [HistorialRevisiones],
  template: `<section class="mx-auto max-w-6xl p-4">
    @if (inspeccion(); as id) {
      <app-historial-revisiones [inspeccionId]="id" [puedeResolver]="auth.rol() === 'ESTUDIANTE'" />
    }
  </section>`,
})
export class VistaHistorialRevisiones {
  readonly auth = inject(AuthService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly parametros = toSignal(this.ruta.paramMap, {
    initialValue: this.ruta.snapshot.paramMap,
  });
  readonly inspeccion = computed(() => this.parametros().get('inspeccionId'));
}
