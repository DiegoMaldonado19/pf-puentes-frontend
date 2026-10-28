import { Component, computed, effect, inject, OnDestroy, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../core/auth/auth';
import { TEXTOS } from '../shared/textos';
import { AccesoLocal } from './acceso-local';
import { BaseLocal } from './base-local';
import { DiagnosticoOffline } from './diagnostico';
import { InspeccionLocal } from './modelos';
import { PreparacionLocal, ProgresoPreparacion, ResultadoPreparacion } from './preparacion';

@Component({
  imports: [DiagnosticoOffline],
  selector: 'app-vista-local',
  template: `
    <h1>{{ t.titulo }}</h1>
    <p>{{ t.limite }}</p>
    @if (error()) {
      <p role="alert">{{ error() }}</p>
    }
    @if (puedePreparar()) {
      <section aria-labelledby="preparacion-offline-titulo">
        <h2 id="preparacion-offline-titulo">{{ t.tituloPreparacion }}</h2>
        <button type="button" [disabled]="preparando()" (click)="preparar()">
          {{ t.prepararUsoSinConexion }}
        </button>
        @if (preparando()) {
          <p role="status">{{ t.preparando }}</p>
        }
        @if (progreso(); as avance) {
          <p role="status" aria-live="polite">
            {{ t.proveedoresPreparacion[avance.proveedor] }}:
            {{ t.estadosPreparacion[avance.estado] }}
          </p>
        }
        @if (resultado(); as resultado) {
          <p role="status">
            {{
              resultado.completa ? t.resultadoPreparacionCompleta : t.resultadoPreparacionIncompleta
            }}
          </p>
          <ul>
            @for (proveedor of proveedores; track proveedor) {
              <li>
                {{ t.proveedoresPreparacion[proveedor] }}:
                {{ t.estadosPreparacion[resultado.proveedores[proveedor]] }}
              </li>
            }
          </ul>
          @if (!resultado.completa) {
            <p role="alert">{{ t.errorPreparacion }}</p>
          }
        }
        @if (errorPreparacion()) {
          <p role="alert">{{ t.errorPreparacion }}</p>
        }
      </section>
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
  readonly puedePreparar = computed(
    () => this.auth.autenticado() && this.auth.rol() === 'ESTUDIANTE',
  );
  readonly preparando = signal(false);
  readonly progreso = signal<ProgresoPreparacion | null>(null);
  readonly resultado = signal<ResultadoPreparacion | null>(null);
  readonly errorPreparacion = signal(false);
  readonly proveedores = ['referencia', 'publicacion', 'esquema'] as const;
  private readonly acceso = inject(AccesoLocal);
  private readonly auth = inject(AuthService);
  private readonly preparacion = inject(PreparacionLocal);
  private revision = 0;
  private revisionPreparacion = 0;
  private identidadRemota: string | null | undefined;
  private readonly liberar = this.acceso.alInvalidar(() => void this.actualizar());

  constructor() {
    effect(() => {
      const identidad =
        this.auth.autenticado() && this.auth.rol() === 'ESTUDIANTE'
          ? (this.auth.usuario()?.id ?? null)
          : null;
      if (this.identidadRemota !== undefined && this.identidadRemota !== identidad) {
        this.limpiarPreparacion();
      }
      this.identidadRemota = identidad;
    });
    this.auth.eventosSesion.pipe(takeUntilDestroyed()).subscribe(() => this.limpiarPreparacion());
    void this.actualizar();
  }

  async preparar(): Promise<void> {
    if (this.preparando()) return;
    const usuario = this.auth.usuario();
    if (!this.auth.autenticado() || usuario?.rol !== 'ESTUDIANTE' || !usuario.id) return;
    const propietario = usuario.id;
    const revision = ++this.revisionPreparacion;
    const vigente = () =>
      revision === this.revisionPreparacion &&
      this.auth.autenticado() &&
      this.auth.rol() === 'ESTUDIANTE' &&
      this.auth.usuario()?.id === propietario;

    this.preparando.set(true);
    this.progreso.set(null);
    this.resultado.set(null);
    this.errorPreparacion.set(false);
    try {
      const resultado = await this.preparacion.preparar(propietario, (avance) => {
        if (vigente()) this.progreso.set(avance);
      });
      if (vigente()) this.resultado.set(resultado);
    } catch {
      if (vigente()) this.errorPreparacion.set(true);
    } finally {
      if (vigente()) this.preparando.set(false);
    }
  }

  private limpiarPreparacion(): void {
    this.revisionPreparacion++;
    this.preparando.set(false);
    this.progreso.set(null);
    this.resultado.set(null);
    this.errorPreparacion.set(false);
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
    this.limpiarPreparacion();
  }
}
