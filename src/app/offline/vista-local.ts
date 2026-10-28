import { Component, computed, effect, inject, OnDestroy, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth';
import { EsquemaFormulario } from '../features/formulario/modelos';
import { hoyGuatemala, ubicacionActual } from '../features/inspecciones/dispositivo';
import {
  extraerPermanentes,
  fusionarProfundo,
  podarVacios,
} from '../features/inspecciones/esquema';
import { PuenteDTO } from '../features/puentes/modelos';
import { TEXTOS } from '../shared/textos';
import { AccesoLocal } from './acceso-local';
import { BaseLocal } from './base-local';
import { DiagnosticoOffline } from './diagnostico';
import { InspeccionLocal, Json, PreparacionCompleta } from './modelos';
import { MotorSync } from './motor-sync';
import { PersistenciaOffline } from './persistencia';
import { PreparacionLocal, ProgresoPreparacion, ResultadoPreparacion } from './preparacion';

@Component({
  imports: [RouterLink, DiagnosticoOffline],
  selector: 'app-vista-local',
  template: `
    <h1>{{ t.titulo }}</h1>
    <p>
      Prepara tu salida con conexión. Las capturas, fotos y PDF se conservan aquí hasta sincronizar.
    </p>
    @if (error()) {
      <p role="alert">{{ error() }}</p>
    }
    @if (preparada(); as salida) {
      <section aria-labelledby="puentes-preparados">
        <h2 id="puentes-preparados">Puentes preparados</h2>
        @for (a of salida.asignaciones; track a.id) {
          <article>
            <h3>{{ a.puente_codigo }} · {{ a.puente_nombre }}</h3>
            <p>{{ a.curso_nombre }}</p>
            <button type="button" [disabled]="iniciando()" (click)="iniciar(a.id)">
              Iniciar inspección sin conexión
            </button>
          </article>
        }
      </section>
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
        <a [routerLink]="['/offline/captura', i.id]">Abrir editor local</a>
        <pre>{{ json(i.respuestas) }}</pre>
      </section>
    }
    <app-diagnostico-offline [db]="db" [propietario]="propietario()" [motor]="motor" />
  `,
})
export class VistaLocal implements OnDestroy {
  readonly t = TEXTOS.accesoLocal;
  readonly db = inject(BaseLocal);
  readonly motor = inject(MotorSync, { optional: true }) ?? undefined;
  readonly preparada = signal<PreparacionCompleta | null>(null);
  readonly iniciando = signal(false);
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
  private readonly router = inject(Router);
  private readonly local = new PersistenciaOffline(this.db);
  private revision = 0;
  private revisionPreparacion = 0;
  private destruida = false;
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
      if (vigente()) {
        this.resultado.set(resultado);
        if (resultado.completa) await this.actualizar();
      }
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
    this.preparada.set(null);
    this.error.set('');
    // Dejar que el emisor síncrono registre primero su escritura durable pendiente.
    await Promise.resolve();
    try {
      const propietario = await this.acceso.propietarioActual();
      if (!propietario || revision !== this.revision) return;
      const capturas = await this.acceso.inspecciones();
      const preparada = await this.acceso.consultarPropias(propietario, () =>
        this.db.preparaciones.get(propietario),
      );
      const propietarioVigente = await this.acceso.propietarioActual();
      if (revision !== this.revision || propietarioVigente !== propietario) return;
      this.propietario.set(propietario);
      this.capturas.set(capturas);
      this.preparada.set(preparada ?? null);
    } catch {
      if (revision === this.revision) this.error.set(this.t.errorConsulta);
    }
  }

  async iniciar(asignacionId: string): Promise<void> {
    if (this.iniciando()) return;
    this.iniciando.set(true);
    this.error.set('');
    try {
      const propietario = await this.acceso.propietarioActual();
      if (!propietario) throw new Error('Prepara una salida con tu sesión de estudiante.');
      const preparacion = await this.acceso.consultarPropias(propietario, () =>
        this.db.preparaciones.get(propietario),
      );
      const asignacion = preparacion?.asignaciones.find(
        (a) => a.id === asignacionId && a.estudiante_id === propietario,
      );
      const referencia = preparacion?.esquemas_formulario.find(
        (r) => r.id === preparacion.formulario_version_id && r.propietario_id === propietario,
      );
      const esquema = (referencia?.datos as { esquema?: EsquemaFormulario } | undefined)?.esquema;
      if (!preparacion || !asignacion || !esquema?.properties)
        throw new Error('No hay preparación completa para esta asignación.');
      const publicacion = preparacion.publicaciones.find(
        (p) => p.puente_id === asignacion.puente_id,
      );
      const precarga =
        (
          publicacion?.publicacion?.datos as
            | {
                precarga?: { datos?: Record<string, unknown> };
              }
            | undefined
        )?.precarga?.datos ?? {};
      const gps = await ubicacionActual();
      if (this.destruida || (await this.acceso.propietarioActual()) !== propietario)
        throw new Error('La sesión cambió al iniciar la captura.');
      const puente = preparacion.puentes.find((p) => p.id === asignacion.puente_id)
        ?.datos as unknown as PuenteDTO | undefined;
      const distancia =
        gps && typeof puente?.latitud === 'number' && typeof puente.longitud === 'number'
          ? distanciaMetros(gps, { latitud: puente.latitud, longitud: puente.longitud })
          : null;
      // La identificación es readOnly en SIECA, incluso en la primera captura sin publicación.
      const inventario = podarVacios({
        identificacion: {
          codigo: puente?.codigo,
          nombre: puente?.nombre,
          ruta: puente?.ruta,
          departamento: puente?.departamento?.nombre,
          municipio: puente?.municipio?.nombre,
        },
      });
      const captura = await this.local.crear(
        propietario,
        asignacion.puente_id,
        preparacion.formulario_version_id,
        extraerPermanentes(fusionarProfundo(precarga, inventario), esquema) as Json,
        {
          fecha_inspeccion: hoyGuatemala(),
          asignacion_id: asignacion.id,
          curso_id: asignacion.curso_id,
          latitud: gps?.latitud ?? null,
          longitud: gps?.longitud ?? null,
          aviso_ubicacion:
            distancia !== null && distancia > 500
              ? `Estás a ${Math.round(distancia)} m del puente (más de 500 m).`
              : gps
                ? null
                : 'No se obtuvo GPS; puedes continuar sin ubicación.',
        },
      );
      if (this.destruida || (await this.acceso.propietarioActual()) !== propietario)
        throw new Error('La sesión cambió. La captura permanece guardada para su propietario.');
      await this.router.navigate(['/offline/captura', captura.id]);
    } catch (causa) {
      this.error.set(
        causa instanceof Error ? causa.message : 'No se pudo iniciar la captura local.',
      );
    } finally {
      this.iniciando.set(false);
    }
  }

  readonly json = JSON.stringify;

  ngOnDestroy(): void {
    this.destruida = true;
    this.liberar();
    this.revision++;
    this.limpiarPreparacion();
  }
}

export function distanciaMetros(
  a: { latitud: number; longitud: number },
  b: { latitud: number; longitud: number },
): number {
  const radianes = Math.PI / 180;
  const h =
    Math.sin(((b.latitud - a.latitud) * radianes) / 2) ** 2 +
    Math.cos(a.latitud * radianes) *
      Math.cos(b.latitud * radianes) *
      Math.sin(((b.longitud - a.longitud) * radianes) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
