import { Component, inject, OnDestroy, signal } from '@angular/core';
import { AccesoLocal } from './acceso-local';
import { InspeccionLocal } from './modelos';
import { TEXTOS } from '../shared/textos';

/** Consulta local independiente de permisos remotos; la captura P5 aún no está integrada. */
@Component({
  selector: 'app-vista-local',
  template: `
    <h1>{{ t.titulo }}</h1>
    <p>{{ t.limite }}</p>
    @if (!capturas().length) {
      <p role="status">{{ t.sinAcceso }}</p>
    }
    @for (i of capturas(); track i.id) {
      <section>
        <h2>{{ t.inspeccion }} {{ i.id }}</h2>
        <pre>{{ json(i.respuestas) }}</pre>
      </section>
    }
  `,
})
export class VistaLocal implements OnDestroy {
  readonly t = TEXTOS.accesoLocal;
  readonly capturas = signal<InspeccionLocal[]>([]);
  private readonly acceso = inject(AccesoLocal);
  private revision = 0;
  private readonly liberar = this.acceso.alInvalidar(() => void this.actualizar());
  constructor() {
    void this.actualizar();
  }
  private async actualizar(): Promise<void> {
    const revision = ++this.revision;
    this.capturas.set([]);
    // Dejar que el emisor síncrono registre primero su escritura durable pendiente.
    await Promise.resolve();
    try {
      const capturas = await this.acceso.inspecciones();
      if (revision === this.revision) this.capturas.set(capturas);
    } catch {
      /* Fallar cerrado: la vista ya está vacía. */
    }
  }
  readonly json = JSON.stringify;
  ngOnDestroy(): void {
    this.liberar();
    this.revision++;
  }
}
