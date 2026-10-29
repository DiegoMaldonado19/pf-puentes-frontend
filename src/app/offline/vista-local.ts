import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, OnDestroy, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth';
import { CLASE_ALERTA, CLASE_BOTON, CLASE_ENLACE, CLASE_HECHO } from '../features/auth/formulario';
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
import { consultarAlmacenamiento } from './almacenamiento';
import { BaseLocal } from './base-local';
import { DiagnosticoOffline } from './diagnostico';
import { estadoCaptura, InspeccionLocal, Json, PreparacionCompleta } from './modelos';
import { MotorSync } from './motor-sync';
import { PersistenciaOffline } from './persistencia';
import { PreparacionLocal, ProgresoPreparacion, ResultadoPreparacion } from './preparacion';

@Component({
  imports: [RouterLink, DatePipe, DiagnosticoOffline],
  selector: 'app-vista-local',
  template: `
    <div class="mx-auto max-w-6xl p-4">
      <h1 class="text-h1">{{ t.titulo }}</h1>
      <p class="text-muted mt-1">
        Prepara tu salida con conexión. Las capturas, fotos y PDF se conservan aquí hasta
        sincronizar.
      </p>
      @if (error()) {
        <p role="alert" [class]="claseAlerta">{{ error() }}</p>
      }
      @if (preparada(); as salida) {
        <section class="mt-6" aria-labelledby="puentes-preparados">
          <h2 id="puentes-preparados" class="text-lg font-semibold">Puentes preparados</h2>
          <div class="mt-3 grid gap-3 sm:grid-cols-2">
            @for (a of contextos(); track a.id) {
              <article class="hvc-card">
                <h3 class="text-h3">{{ a.puente_codigo }} · {{ a.puente_nombre }}</h3>
                <p class="text-muted">{{ a.curso_nombre }}</p>
                <button
                  type="button"
                  class="mt-3"
                  [class]="claseBoton"
                  [disabled]="iniciando()"
                  (click)="iniciar(a.id)"
                >
                  Iniciar inspección sin conexión
                </button>
              </article>
            }
          </div>
        </section>
      }
      @if (puedePreparar()) {
        <section class="hvc-card mt-6" aria-labelledby="preparacion-offline-titulo">
          <h2 id="preparacion-offline-titulo" class="text-lg font-semibold">
            {{ t.tituloPreparacion }}
          </h2>
          <button
            type="button"
            class="mt-3"
            [class]="claseBoton"
            [disabled]="preparando()"
            (click)="preparar()"
          >
            {{ t.prepararUsoSinConexion }}
          </button>
          @if (preparando()) {
            <p role="status" class="text-muted mt-2">{{ t.preparando }}</p>
          }
          @if (progreso(); as avance) {
            <p role="status" aria-live="polite" class="text-muted mt-2">
              {{ t.proveedoresPreparacion[avance.proveedor] }}:
              {{ t.estadosPreparacion[avance.estado] }}
            </p>
          }
          @if (resultado(); as resultado) {
            <p role="status" [class]="resultado.completa ? claseHecho : claseAlerta">
              {{
                resultado.completa
                  ? t.resultadoPreparacionCompleta
                  : t.resultadoPreparacionIncompleta
              }}
            </p>
            <ul class="text-muted mt-2 list-inside list-disc">
              @for (proveedor of proveedores; track proveedor) {
                <li>
                  {{ t.proveedoresPreparacion[proveedor] }}:
                  {{ t.estadosPreparacion[resultado.proveedores[proveedor]] }}
                </li>
              }
            </ul>
            @if (!resultado.completa) {
              <p role="alert" [class]="claseAlerta">{{ t.errorPreparacion }}</p>
            }
          }
          @if (errorPreparacion()) {
            <p role="alert" [class]="claseAlerta">{{ t.errorPreparacion }}</p>
          }
        </section>
      }
      @if (!propietario()) {
        <p role="status" class="mt-6 rounded bg-slate-100 p-4">{{ t.sinAcceso }}</p>
      } @else if (!capturas().length) {
        <p role="status" class="mt-6 rounded bg-slate-100 p-4">{{ t.sinCapturas }}</p>
      }
      @for (i of capturas(); track i.id) {
        <section class="hvc-card mt-4">
          <h2 class="text-h2">{{ titulo(i) }}</h2>
          <p class="text-muted">
            {{ estado(i) }} · versión {{ i.version_local }} ·
            {{ i.modificada_en | date: 'dd/MM/yyyy HH:mm' }}
          </p>
          <a
            class="mt-2 inline-block"
            [class]="claseEnlace"
            [routerLink]="['/offline/captura', i.id]"
            >Abrir editor local</a
          >
        </section>
      }
      <app-diagnostico-offline [db]="db" [propietario]="propietario()" [motor]="motor" />
    </div>
  `,
})
export class VistaLocal implements OnDestroy {
  readonly t = TEXTOS.accesoLocal;
  protected readonly claseBoton = CLASE_BOTON;
  protected readonly claseAlerta = CLASE_ALERTA;
  protected readonly claseHecho = CLASE_HECHO;
  protected readonly claseEnlace = CLASE_ENLACE;
  protected readonly estado = estadoCaptura;
  readonly db = inject(BaseLocal);
  readonly motor = inject(MotorSync, { optional: true }) ?? undefined;
  readonly preparada = signal<PreparacionCompleta | null>(null);
  readonly contextos = computed(() => {
    const p = this.preparada();
    return [
      ...(p?.asignaciones ?? []),
      ...(p?.inspeccionables ?? [])
        .filter((i) => !i.borrador_en_curso)
        .map((i) => ({
          id: `${i.id}:${i.curso_id ?? ''}`,
          puente_id: i.id,
          puente_codigo: i.codigo,
          puente_nombre: i.nombre,
          curso_nombre: i.curso_nombre ?? '',
        })),
    ];
  });
  readonly iniciando = signal(false);
  readonly capturas = signal<InspeccionLocal[]>([]);
  readonly propietario = signal<string | null>(null);
  readonly error = signal('');
  readonly puedePreparar = computed(
    () =>
      this.auth.autenticado() &&
      ['ESTUDIANTE', 'CATEDRATICO', 'PROFESIONAL_EXTERNO'].includes(this.auth.rol() ?? ''),
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
      const identidad = this.puedePreparar() ? (this.auth.usuario()?.id ?? null) : null;
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
    if (!this.puedePreparar() || !usuario?.id) return;
    // DT-OFF-09: se pide al clic, sin esperar el aviso del navegador.
    void consultarAlmacenamiento(true);
    const propietario = usuario.id;
    const revision = ++this.revisionPreparacion;
    const vigente = () =>
      revision === this.revisionPreparacion &&
      this.auth.autenticado() &&
      this.puedePreparar() &&
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
      if (!propietario) throw new Error('Prepara una salida con tu sesión de inspector.');
      const preparacion = await this.acceso.consultarPropias(propietario, () =>
        this.db.preparaciones.get(propietario),
      );
      const asignacion = preparacion?.asignaciones.find(
        (a) => a.id === asignacionId && a.estudiante_id === propietario,
      );
      const inspeccionable = preparacion?.inspeccionables?.find(
        (i) => `${i.id}:${i.curso_id ?? ''}` === asignacionId && !i.borrador_en_curso,
      );
      const puenteId = asignacion?.puente_id ?? inspeccionable?.id;
      const referencia = preparacion?.esquemas_formulario.find(
        (r) => r.id === preparacion.formulario_version_id && r.propietario_id === propietario,
      );
      const esquema = (referencia?.datos as { esquema?: EsquemaFormulario } | undefined)?.esquema;
      if (!preparacion || !puenteId || !esquema?.properties)
        throw new Error('No hay preparación completa para esta asignación.');
      const publicacion = preparacion.publicaciones.find((p) => p.puente_id === puenteId);
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
      const puente = preparacion.puentes.find((p) => p.id === puenteId)?.datos as unknown as
        PuenteDTO | undefined;
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
        puenteId,
        preparacion.formulario_version_id,
        extraerPermanentes(fusionarProfundo(precarga, inventario), esquema) as Json,
        {
          fecha_inspeccion: hoyGuatemala(),
          ...(asignacion
            ? { asignacion_id: asignacion.id, curso_id: asignacion.curso_id }
            : inspeccionable?.curso_id
              ? { curso_id: inspeccionable.curso_id }
              : {}),
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

  protected titulo(i: InspeccionLocal): string {
    const id = (i.respuestas as { identificacion?: { codigo?: string; nombre?: string } } | null)
      ?.identificacion;
    return id?.codigo ? `${id.codigo} · ${id.nombre ?? ''}` : this.t.inspeccion;
  }

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
