import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { TEXTOS } from '../../shared/textos';
import { ConteoNoLeidas, Notificacion, PaginaNotificaciones } from './modelos';

const API = '/api/v1/notificaciones';
const TAMANO_DEFECTO = 20;
const TAMANO_MAXIMO = 100;

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private readonly http = inject(HttpClient);

  private readonly propietario = signal<string | null>(null);

  readonly generacion = signal(0);
  private readonly canceladas = new Subject<void>();
  private ultimaCarga = 0;
  private ultimoConteo = 0;
  private ultimaPaginaSolicitada = 0;
  private ultimoTamanoSolicitado = TAMANO_DEFECTO;

  readonly sesionActiva = computed(() => this.propietario() !== null);
  readonly notificaciones = signal<Notificacion[]>([]);
  readonly noLeidas = signal(0);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly pagina = signal(0);
  readonly totalPaginas = signal(0);
  readonly totalElementos = signal(0);
  readonly marcando = signal<ReadonlySet<string>>(new Set());

  establecerUsuario(usuarioId: string | null): void {
    this.propietario.set(usuarioId ?? null);
    this.generacion.update((g) => g + 1);
    this.canceladas.next();
    this.reiniciar();
    if (usuarioId) {
      this.refrescarConteo();
    }
  }

  cargar(pagina = 0, tamano = TAMANO_DEFECTO, silenciosa = false): void {
    const propietario = this.propietario();
    if (!propietario) {
      return;
    }
    const generacion = this.generacion();
    const carga = ++this.ultimaCarga;
    const size = Math.min(Math.max(1, Math.trunc(tamano)), TAMANO_MAXIMO);
    this.ultimaPaginaSolicitada = Math.max(0, Math.trunc(pagina));
    this.ultimoTamanoSolicitado = size;
    if (!silenciosa) {
      this.cargando.set(true);
      this.error.set(null);
    }
    this.http
      .get<PaginaNotificaciones>(API, {
        params: { page: this.ultimaPaginaSolicitada, size },
      })
      .pipe(takeUntil(this.canceladas))
      .subscribe({
        next: (resp) => {
          if (!this.vigente(propietario, generacion) || carga !== this.ultimaCarga) {
            return;
          }
          this.notificaciones.set(resp.contenido);
          this.pagina.set(resp.pagina);
          this.totalPaginas.set(resp.total_paginas);
          this.totalElementos.set(resp.total_elementos);
          this.cargando.set(false);
        },
        error: (err: unknown) => {
          if (
            !this.vigente(propietario, generacion) ||
            this.esNoAutorizado(err) ||
            carga !== this.ultimaCarga
          ) {
            return;
          }
          this.cargando.set(false);
          this.error.set(TEXTOS.notificaciones.errorCarga);
        },
      });
  }

  refrescarConteo(): void {
    const propietario = this.propietario();
    if (!propietario) {
      return;
    }
    const generacion = this.generacion();
    const conteo = ++this.ultimoConteo;
    this.http
      .get<ConteoNoLeidas>(`${API}/no-leidas/conteo`)
      .pipe(takeUntil(this.canceladas))
      .subscribe({
        next: (resp) => {
          if (!this.vigente(propietario, generacion) || conteo !== this.ultimoConteo) {
            return;
          }
          this.noLeidas.set(resp.total);
        },
        error: (err: unknown) => {
          if (
            !this.vigente(propietario, generacion) ||
            this.esNoAutorizado(err) ||
            conteo !== this.ultimoConteo
          ) {
            return;
          }
          this.error.set(TEXTOS.notificaciones.errorConteo);
        },
      });
  }

  reintentar(): void {
    if (!this.propietario()) {
      return;
    }
    this.cargar(this.ultimaPaginaSolicitada, this.ultimoTamanoSolicitado);
    this.refrescarConteo();
  }

  marcarLeida(id: string): void {
    const propietario = this.propietario();
    if (!propietario) {
      return;
    }
    const actual = this.notificaciones().find((n) => n.id === id);
    if (!actual || actual.leida_en || this.marcando().has(id)) {
      return;
    }
    const generacion = this.generacion();
    this.error.set(null);
    this.marcando.update((s) => new Set(s).add(id));
    this.http
      .patch<Notificacion>(`${API}/${id}/lectura`, null)
      .pipe(takeUntil(this.canceladas))
      .subscribe({
        next: (dto) => {
          if (!this.vigente(propietario, generacion)) {
            return;
          }
          this.marcando.update((s) => quitar(s, id));
          this.notificaciones.update((lista) => lista.map((n) => (n.id === id ? dto : n)));
          this.cargar(this.ultimaPaginaSolicitada, this.ultimoTamanoSolicitado, true);
          this.refrescarConteo();
        },
        error: (err: unknown) => {
          if (!this.vigente(propietario, generacion)) {
            return;
          }
          this.marcando.update((s) => quitar(s, id));
          if (!this.esNoAutorizado(err)) {
            this.error.set(TEXTOS.notificaciones.errorLectura);
          }
        },
      });
  }

  private reiniciar(): void {
    this.notificaciones.set([]);
    this.noLeidas.set(0);
    this.cargando.set(false);
    this.error.set(null);
    this.pagina.set(0);
    this.totalPaginas.set(0);
    this.totalElementos.set(0);
    this.marcando.set(new Set());
  }

  private vigente(propietario: string, generacion: number): boolean {
    return this.propietario() === propietario && this.generacion() === generacion;
  }

  private esNoAutorizado(err: unknown): boolean {
    if (err instanceof HttpErrorResponse && err.status === 401) {
      this.invalidarContexto();
      return true;
    }
    return false;
  }

  private invalidarContexto(): void {
    this.propietario.set(null);
    this.generacion.update((g) => g + 1);
    this.canceladas.next();
    this.reiniciar();
    this.error.set(TEXTOS.notificaciones.sesionInvalida);
  }
}

function quitar(conjunto: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const siguiente = new Set(conjunto);
  siguiente.delete(id);
  return siguiente;
}
