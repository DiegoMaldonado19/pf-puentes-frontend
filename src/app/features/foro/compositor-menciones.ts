import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TEXTOS } from '../../shared/textos';
import { esUuid } from './modelos';
import { MENCIONES_P2, PersonaMencion, SESION_P2 } from './puertos';

type EstadoMenciones =
  'LISTO' | 'CARGANDO' | 'ERROR' | 'SIN_SESION' | 'SIN_PERMISOS' | 'NO_INTEGRADO' | 'SIN_OPCIONES';

@Component({
  selector: 'app-compositor-menciones',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './compositor-menciones.html',
})
export class CompositorMenciones {
  readonly opciones = input<readonly PersonaMencion[] | null>(null);
  readonly deshabilitado = input(false);
  readonly sinPermisos = input(false);

  readonly intencionMenciones = output<readonly string[]>();

  protected readonly textos = TEXTOS.menciones;
  protected readonly busqueda = signal('');
  protected readonly seleccionadas = signal<readonly PersonaMencion[]>([]);

  private readonly sesion = inject(SESION_P2);
  private readonly p2 = inject(MENCIONES_P2);
  private ultimaIntencion = '';

  protected readonly opcionesBase = computed<readonly PersonaMencion[]>(() => {
    const explicitas = this.opciones();
    if (explicitas !== null) {
      return normalizarPersonas(explicitas);
    }
    return this.p2.disponible ? normalizarPersonas(this.p2.personas()) : [];
  });

  private readonly cargando = computed(
    () => this.opciones() === null && this.p2.disponible && this.p2.cargando(),
  );

  private readonly error = computed(() =>
    this.opciones() === null && this.p2.disponible ? this.p2.error() : null,
  );

  protected readonly estado = computed<EstadoMenciones>(() => {
    if (this.sinPermisos()) {
      return 'SIN_PERMISOS';
    }
    if (!this.sesion.disponible) {
      return 'NO_INTEGRADO';
    }
    if (!this.sesion.usuarioId()) {
      return 'SIN_SESION';
    }
    if (this.opciones() === null && !this.p2.disponible) {
      return 'NO_INTEGRADO';
    }
    if (this.cargando()) {
      return 'CARGANDO';
    }
    if (this.error()) {
      return 'ERROR';
    }
    return this.opcionesBase().length === 0 ? 'SIN_OPCIONES' : 'LISTO';
  });

  protected readonly consultaValida = computed(() => this.busqueda().trim().length >= 2);

  protected readonly coincidencias = computed<readonly PersonaMencion[]>(() => {
    const consulta = this.busqueda().trim().toLocaleLowerCase('es');
    if (!this.consultaValida()) {
      return [];
    }
    return this.opcionesBase()
      .filter((persona) => persona.etiqueta.toLocaleLowerCase('es').includes(consulta))
      .slice(0, 8);
  });

  protected readonly mostrarLista = computed(
    () => this.estado() === 'LISTO' && this.consultaValida() && this.coincidencias().length > 0,
  );

  protected readonly puedeBuscar = computed(
    () => this.estado() === 'LISTO' && !this.deshabilitado(),
  );

  protected buscar(evento: Event): void {
    if (!this.puedeBuscar()) {
      return;
    }
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  protected yaSeleccionada(id: string): boolean {
    return this.seleccionadas().some((persona) => persona.id === id);
  }

  protected seleccionar(persona: PersonaMencion): void {
    if (this.estado() !== 'LISTO' || this.deshabilitado() || this.yaSeleccionada(persona.id)) {
      return;
    }
    this.seleccionadas.update((personas) => [...personas, persona]);
    this.busqueda.set('');
    this.emitirIntencion();
  }

  protected quitar(id: string): void {
    if (this.deshabilitado()) {
      return;
    }
    this.seleccionadas.update((personas) => personas.filter((persona) => persona.id !== id));
    this.emitirIntencion();
  }

  private emitirIntencion(): void {
    const ids = this.seleccionadas().map((persona) => persona.id);
    const clave = ids.join('|');
    if (clave === this.ultimaIntencion) {
      return;
    }
    this.ultimaIntencion = clave;
    this.intencionMenciones.emit(ids);
  }
}

function normalizarPersonas(personas: readonly PersonaMencion[]): readonly PersonaMencion[] {
  const vistas = new Set<string>();
  const resultado: PersonaMencion[] = [];
  for (const persona of personas) {
    const etiqueta = persona.etiqueta.trim();
    if (!esUuid(persona.id) || !etiqueta || vistas.has(persona.id)) {
      continue;
    }
    vistas.add(persona.id);
    resultado.push({ id: persona.id, etiqueta });
  }
  return resultado;
}
