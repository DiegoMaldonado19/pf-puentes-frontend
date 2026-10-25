import { Component, inject, OnDestroy, signal } from '@angular/core';
import { AccesoLocal } from './acceso-local';
import { BaseLocal } from './base-local';
import { DiagnosticoOffline } from './diagnostico';
import { InspeccionLocal } from './modelos';
import { TEXTOS } from '../shared/textos';

/** Consulta local independiente de permisos remotos; la captura P5 aún no está integrada. */
@Component({
  imports: [DiagnosticoOffline],
  selector: 'app-vista-local',
  template: `
    <h1>{{ t.titulo }}</h1>
    <p>{{ t.limite }}</p>
    @if (error()) {
      <p role="alert">{{ error() }}</p>
    }
    @if (!propietario()) {
      <p role="status">{{ t.sinAcceso }}</p>
    } @else if (!capturas().length) {
      <p role="status">{{ t.sinCapturas }}</p>
    }
    @for (i of capturas(); track i.id) {
      <section>
        <h2>{{ t.inspeccion }} {{ i.id }}</h2>
        <pre>{{ json(i.respuestas) }}</pre>
      </section>
    }
    <app-diagnostico-offline [db]="db" [propietario]="propietario()" />
  `,
})
export class VistaLocal implements OnDestroy {
  readonly t = TEXTOS.accesoLocal;
  readonly db = inject(BaseLocal);
  readonly capturas = signal<InspeccionLocal[]>([]);
  readonly propietario = signal<string | null>(null);
  readonly error = signal('');
  private readonly acceso = inject(AccesoLocal);
  private revision = 0;
  private readonly liberar = this.acceso.alInvalidar(() => void this.actualizar());

  constructor() {
    void this.actualizar();
  }

  private async actualizar(): Promise<void> {
    const revision = ++this.revision;
    this.propietario.set(null);
    this.capturas.set([]);
    this.error.set('');
    // Dejar que el emisor síncrono registre primero su escritura durable pendiente.
    await Promise.resolve();
    try {
      const propietario = await this.acceso.propietarioActual();
      if (!propietario || revision !== this.revision) return;
      const capturas = await this.acceso.inspecciones();
      const propietarioVigente = await this.acceso.propietarioActual();
      if (revision !== this.revision || propietarioVigente !== propietario) return;
      this.propietario.set(propietario);
      this.capturas.set(capturas);
    } catch {
      if (revision === this.revision) this.error.set(this.t.errorConsulta);
    }
  }

  readonly json = JSON.stringify;

  ngOnDestroy(): void {
    this.liberar();
    this.revision++;
  }
}
