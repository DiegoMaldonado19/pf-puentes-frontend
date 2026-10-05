import { Component, OnDestroy, signal } from '@angular/core';
import Dexie, { liveQuery } from 'dexie';
import { CapturaFoto, FotoCapturada } from '../../shared/captura-foto/captura-foto';
import { TEXTOS } from '../../shared/textos';
import { ALMACENES_V1, BaseLocal } from '../base-local';
import { consultarAlmacenamiento, mensajeEscritura } from '../almacenamiento';
import { DiagnosticoOffline } from '../diagnostico';
import { InspeccionLocal, Json } from '../modelos';
import { MotorSync } from '../motor-sync';
import { PersistenciaOffline } from '../persistencia';
import { FORMULARIO, prepararFixtures, PROPIETARIOS, PUENTE } from './fixtures';
import { TransporteSimulado } from './transporte-simulado';

@Component({
  imports: [CapturaFoto, DiagnosticoOffline],
  template: `
    <main class="mx-auto max-w-4xl space-y-4 p-6">
      <h1>{{ t.titulo }}</h1>
      <label
        >{{ t.propietario }}
        <select (change)="cambiar($any($event.target).value)">
          @for (p of propietarios; track p) {
            <option [value]="p">{{ p }}</option>
          }
        </select></label
      >
      <button type="button" (click)="crear()">{{ t.crear }}</button>
      <label
        >{{ t.resultado }}
        <select (change)="transporte.resultado = $any($event.target).value">
          <option value="ack">{{ t.ack }}</option>
          <option value="transitorio">{{ t.transitorio }}</option>
          <option value="negocio">{{ t.negocio }}</option>
          <option value="sesion">{{ t.sesion }}</option>
        </select></label
      >
      <p role="status">{{ mensaje() }}</p>
      <p>{{ almacenamiento() }}</p>
      @if (error()) {
        <p role="alert">{{ error() }}</p>
      }
      @for (i of inspecciones(); track i.id) {
        <section>
          <h2>{{ t.inspeccion }} {{ i.id }}</h2>
          <p>{{ i.formulario_version_id }} · {{ i.version_local }} / {{ i.version_confirmada }}</p>
          <label
            >{{ t.respuestas }} <textarea #respuestas [value]="json(i.respuestas)"></textarea>
          </label>
          <button type="button" (click)="guardar(i.id, respuestas.value)">{{ t.guardar }}</button>
          <label>{{ t.anclaje }} <input #anclaje value="fixture.elemento" /></label>
          <app-captura-foto (capturada)="foto(i.id, $event, anclaje.value)" />
          <label
            >{{ t.pdf }} <input type="file" accept="application/pdf" (change)="pdf(i.id, $event)"
          /></label>
          <p>
            {{ t.fotos }}: {{ conteos()[i.id]?.fotos ?? 0 }} · {{ t.documentos }}:
            {{ conteos()[i.id]?.documentos ?? 0 }}
          </p>
          <button type="button" (click)="enviar(i.id)">{{ t.enviar }}</button>
        </section>
      }
      <app-diagnostico-offline [db]="db" [propietario]="propietario()" [motor]="motor" />
    </main>
  `,
})
export class DemoOffline implements OnDestroy {
  readonly t = TEXTOS.offline;
  readonly db = new BaseLocal('puentes-offline-demo');
  readonly persistencia = new PersistenciaOffline(this.db);
  readonly crearBase = (nombre: string) => new BaseLocal(nombre);
  readonly crearBaseV1 = (nombre: string) => {
    const db = new Dexie(nombre);
    db.version(1).stores(ALMACENES_V1);
    return db;
  };
  readonly transporte = new TransporteSimulado();
  readonly propietarios = PROPIETARIOS;
  readonly propietario = signal(PROPIETARIOS[0]);
  readonly inspecciones = signal<InspeccionLocal[]>([]);
  readonly conteos = signal<Record<string, { fotos: number; documentos: number }>>({});
  readonly mensaje = signal('');
  readonly error = signal('');
  readonly almacenamiento = signal('');
  desfase = 0;
  readonly motor = new MotorSync(
    this.db,
    {
      propietarioActual: () => this.propietario(),
      preparar: async () => true,
    },
    this.transporte,
    () => Date.now() + this.desfase,
    () => navigator.onLine,
    () => this.error.set(this.t.escrituraError),
  );
  private sub?: { unsubscribe(): void };
  constructor() {
    // Instrumentación exclusiva del harness para inspeccionar IndexedDB real en E2E.
    window.__offlineDemo = this;
    void prepararFixtures(this.db)
      .then(() => this.observar())
      .catch((e) => this.error.set(mensajeEscritura(e)));
    void consultarAlmacenamiento(true).then((e) => this.almacenamiento.set(e.mensaje));
    // El transporte se activa automáticamente; sin operaciones no simula trabajo.
    if (new URLSearchParams(location.search).get('automatico') !== '0') this.motor.iniciar();
  }
  private observar() {
    this.sub?.unsubscribe();
    const p = this.propietario();
    this.sub = liveQuery(async () => {
      const inspecciones = await this.db.inspecciones
        .where('propietario_id')
        .equals(p)
        .sortBy('id');
      const conteos: Record<string, { fotos: number; documentos: number }> = {};
      for (const i of inspecciones)
        conteos[i.id] = {
          fotos: await this.db.fotos
            .where('[propietario_id+inspeccion_id]')
            .equals([p, i.id])
            .count(),
          documentos: await this.db.documentos
            .where('[propietario_id+inspeccion_id]')
            .equals([p, i.id])
            .count(),
        };
      return { inspecciones, conteos };
    }).subscribe({
      next: (r) => {
        this.inspecciones.set(r.inspecciones);
        this.conteos.set(r.conteos);
      },
      error: (e) => this.error.set(mensajeEscritura(e)),
    });
  }
  cambiar(p: string) {
    if (!PROPIETARIOS.includes(p)) return;
    this.motor.detener();
    this.propietario.set(p);
    this.inspecciones.set([]);
    this.conteos.set({});
    this.mensaje.set('');
    this.error.set('');
    this.motor.pausa.set(null);
    this.observar();
    if (new URLSearchParams(location.search).get('automatico') !== '0') this.motor.iniciar();
  }
  json(valor: Json) {
    return JSON.stringify(valor);
  }
  private async accion(guardar: () => Promise<unknown>) {
    this.mensaje.set('');
    this.error.set('');
    try {
      await guardar();
      this.mensaje.set(this.t.guardado);
    } catch (e) {
      this.error.set(e instanceof SyntaxError ? this.t.jsonInvalido : mensajeEscritura(e));
    }
  }
  crear() {
    return this.accion(() => this.persistencia.crear(this.propietario(), PUENTE, FORMULARIO));
  }
  guardar(id: string, json: string) {
    return this.accion(() => this.persistencia.editar(this.propietario(), id, JSON.parse(json)));
  }
  foto(id: string, f: FotoCapturada, anclaje: string) {
    return this.accion(() => this.persistencia.foto(this.propietario(), id, f, anclaje));
  }
  pdf(id: string, evento: Event) {
    const input = evento.target as HTMLInputElement,
      archivo = input.files?.[0];
    input.value = '';
    if (archivo)
      return this.accion(() => this.persistencia.documento(this.propietario(), id, archivo));
    return Promise.resolve();
  }
  enviar(id: string) {
    return this.accion(() => this.persistencia.enviar(this.propietario(), id));
  }
  ngOnDestroy() {
    this.motor.detener();
    this.sub?.unsubscribe();
    delete window.__offlineDemo;
    this.db.close();
  }
}
declare global {
  interface Window {
    __offlineDemo?: DemoOffline;
  }
}
