import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { EmptyError, Observable, Subject, firstValueFrom, map, takeUntil } from 'rxjs';
import { TEXTOS } from '../../shared/textos';
import { SESION_P2 } from './puertos';
import { Comentario, Hilo, PeticionCrearHilo, esUuid, tieneRolModeracion } from './modelos';
import { ForoApiService } from './foro-api.service';
import { ForoLecturaService } from './foro-lectura.service';

@Injectable({ providedIn: 'root' })
export class ForoService {
  private readonly api = inject(ForoApiService);
  private readonly lectura = inject(ForoLecturaService);
  private readonly propietario = signal<string | null>(null);
  private readonly roles = signal<readonly string[]>([]);
  private readonly canceladas = new Subject<void>();

  readonly generacion = signal(0);
  readonly usuarioId = this.propietario.asReadonly();
  readonly sesionActiva = computed(() => this.propietario() !== null);
  readonly puedeModerar = computed(() => this.sesionActiva() && tieneRolModeracion(this.roles()));
  readonly errorEscritura = signal<string | null>(null);
  readonly escriturasEnCurso = signal<ReadonlySet<string>>(new Set());
  readonly creandoHilo = computed(() => this.escriturasEnCurso().has('crear-hilo'));
  readonly comentando = computed(() => this.escriturasEnCurso().has('comentar'));

  constructor() {
    const sesion = inject(SESION_P2);
    if (sesion.disponible) {
      effect(() => {
        const usuarioId = sesion.usuarioId();
        const roles = sesion.roles();
        untracked(() => this.establecerUsuario(usuarioId, roles));
      });
    }
  }

  establecerUsuario(usuarioId: string | null, roles: readonly string[] = []): void {
    const vinculo = esUuid(usuarioId) ? usuarioId : null;
    this.propietario.set(vinculo);
    this.roles.set(vinculo === null ? [] : [...roles]);
    this.generacion.update((g) => g + 1);
    this.canceladas.next();
    this.escriturasEnCurso.set(new Set());
    this.limpiarErrorEscritura();
  }

  crearHilo(puenteId: string, peticion: PeticionCrearHilo): Promise<Hilo | null> {
    return this.ejecutar(
      'crear-hilo',
      this.api.crearHilo(puenteId, peticion),
      () => this.lectura.listadoSolicitado.puenteId === puenteId,
      () => this.errorEscritura.set(TEXTOS.foro.errorCrearHilo),
    );
  }

  async comentar(hiloId: string, texto: string): Promise<Comentario | null> {
    const detalle = this.lectura.hilo();
    if (!detalle || detalle.id !== hiloId || detalle.cerrado) return null;
    const generacion = this.generacion();
    const comentario = await this.ejecutar(
      'comentar',
      this.api.crearComentario(hiloId, { texto }),
      () => this.lectura.detalleSolicitado.hiloId === hiloId,
      (err) => this.errorParticipacion(err, hiloId, TEXTOS.foro.errorComentario),
    );
    if (this.generacion() !== generacion) return null;
    if (
      comentario &&
      this.lectura.hilo()?.id === hiloId &&
      this.lectura.comentariosSolicitados.hiloId === hiloId
    ) {
      const total = this.lectura.totalElementosComentarios() + 1;
      const tamano = this.lectura.comentariosSolicitados.tamano;
      this.lectura.cargarComentarios(hiloId, Math.max(0, Math.ceil(total / tamano) - 1), tamano);
    }
    return comentario;
  }

  async responder(hiloId: string, raizId: string, texto: string): Promise<Comentario | null> {
    const detalle = this.lectura.hilo();
    const raiz = this.lectura.comentarios().find((c) => c.id === raizId);
    if (
      this.lectura.detalleSolicitado.hiloId !== hiloId ||
      !detalle ||
      detalle.id !== hiloId ||
      detalle.cerrado ||
      !raiz ||
      raiz.eliminado ||
      raiz.hilo_id !== hiloId
    )
      return null;
    const generacion = this.generacion();
    const respuesta = await this.ejecutar(
      `responder:${raizId}`,
      this.api.crearComentario(hiloId, { texto, padre_id: raizId }),
      () => this.lectura.detalleSolicitado.hiloId === hiloId,
      (err) => {
        this.errorParticipacion(err, hiloId, TEXTOS.foro.errorRespuesta);
        if (err instanceof HttpErrorResponse && err.status === 404)
          this.lectura.reintentarComentariosSilenciosamente();
      },
    );
    if (this.generacion() !== generacion) return null;
    if (
      respuesta &&
      this.lectura.detalleSolicitado.hiloId === hiloId &&
      raizId in this.lectura.respuestasSolicitadas
    ) {
      const estado = this.lectura.estadoRespuestas(raizId);
      const sol = this.lectura.respuestasSolicitadas[raizId];
      const ultima = Math.max(0, Math.ceil((estado.totalElementos + 1) / sol.tamano) - 1);
      this.lectura.cargarRespuestas(raizId, ultima, sol.tamano);
    }
    return respuesta;
  }

  async editar(comentarioId: string, texto: string): Promise<boolean> {
    const objetivo = this.lectura.buscarComentario(comentarioId);
    if (
      !objetivo ||
      objetivo.eliminado ||
      this.lectura.detalleSolicitado.hiloId !== objetivo.hilo_id
    )
      return false;
    const generacion = this.generacion();
    const dto = await this.ejecutar(
      `editar:${comentarioId}`,
      this.api.editarComentario(comentarioId, texto),
      () => this.lectura.detalleSolicitado.hiloId === objetivo.hilo_id,
      (err) => {
        const conflicto = err instanceof HttpErrorResponse && err.status === 409;
        this.errorEscritura.set(conflicto ? TEXTOS.foro.edicionVencida : TEXTOS.foro.errorEdicion);
        if (conflicto || (err instanceof HttpErrorResponse && err.status === 404))
          this.lectura.refrescarContenedor(objetivo);
      },
    );
    if (this.generacion() !== generacion) return false;
    if (!dto) return false;
    this.lectura.reemplazarComentario(dto);
    return true;
  }

  async borrar(comentarioId: string): Promise<boolean> {
    const objetivo = this.lectura.buscarComentario(comentarioId);
    if (
      !this.sesionActiva() ||
      this.escriturasEnCurso().has(`borrar:${comentarioId}`) ||
      !objetivo ||
      this.lectura.detalleSolicitado.hiloId !== objetivo.hilo_id
    )
      return false;
    if (objetivo.eliminado) return true;
    const generacion = this.generacion();
    const ok = await this.ejecutar(
      `borrar:${comentarioId}`,
      this.api.borrarComentario(comentarioId).pipe(map(() => true)),
      () => this.lectura.detalleSolicitado.hiloId === objetivo.hilo_id,
      (err) => {
        this.errorEscritura.set(TEXTOS.foro.errorBorrado);
        if (err instanceof HttpErrorResponse && err.status === 404)
          this.lectura.refrescarContenedor(objetivo);
      },
    );
    if (this.generacion() !== generacion) return false;
    if (!ok) return false;
    const actual = this.lectura.buscarComentario(comentarioId);
    if (actual) this.lectura.reemplazarComentario({ ...actual, texto: null, eliminado: true });
    return true;
  }

  async ocultarComentario(comentarioId: string, motivo: string): Promise<boolean> {
    const objetivo = this.lectura.buscarComentario(comentarioId);
    const motivoLimpio = motivo.trim();
    if (
      !this.puedeModerar() ||
      !motivoLimpio ||
      !objetivo ||
      this.lectura.detalleSolicitado.hiloId !== objetivo.hilo_id
    )
      return false;
    const generacion = this.generacion();
    const ok = await this.ejecutar(
      `ocultar:${comentarioId}`,
      this.api.ocultarComentario(comentarioId, motivoLimpio).pipe(map(() => true)),
      () => this.lectura.detalleSolicitado.hiloId === objetivo.hilo_id,
      (err) =>
        this.errorModeracion(err, TEXTOS.foro.errorOcultar, () =>
          this.lectura.refrescarContenedor(objetivo),
        ),
    );
    if (this.generacion() !== generacion) return false;
    if (!ok) return false;
    if (this.lectura.detalleSolicitado.hiloId === objetivo.hilo_id) {
      if (objetivo.padre_id) this.lectura.retirarRespuesta(objetivo.padre_id, comentarioId);
      else this.lectura.retirarRaizYRespuestas(comentarioId);
      this.lectura.refrescarContenedor(objetivo);
    }
    return true;
  }

  async cerrarHilo(hiloId: string, motivo: string): Promise<boolean> {
    const clave = `cerrar:${hiloId}`;
    const motivoLimpio = motivo.trim();
    const enDetalle =
      this.lectura.detalleSolicitado.hiloId === hiloId && this.lectura.hilo()?.id === hiloId;
    const enListado = this.lectura
      .hilos()
      .some((h) => h.id === hiloId && h.puente_id === this.lectura.listadoSolicitado.puenteId);
    if (
      !this.puedeModerar() ||
      !motivoLimpio ||
      this.escriturasEnCurso().has(clave) ||
      (!enDetalle && !enListado)
    )
      return false;
    const cerrado = enDetalle
      ? this.lectura.hilo()?.cerrado
      : this.lectura.hilos().find((h) => h.id === hiloId)?.cerrado;
    if (cerrado) return true;
    const generacion = this.generacion();
    const ok = await this.ejecutar(
      clave,
      this.api.cerrarHilo(hiloId, motivoLimpio).pipe(map(() => true)),
      () =>
        (enDetalle && this.lectura.detalleSolicitado.hiloId === hiloId) ||
        (enListado && this.lectura.hilos().some((h) => h.id === hiloId)),
      (err) =>
        this.errorModeracion(err, TEXTOS.foro.errorCerrarHilo, () =>
          this.lectura.refrescarVistaHilo(hiloId, enDetalle, enListado),
        ),
    );
    if (this.generacion() !== generacion) return false;
    if (!ok) return false;
    this.lectura.marcarHiloCerrado(hiloId);
    this.lectura.refrescarVistaHilo(
      hiloId,
      this.lectura.detalleSolicitado.hiloId === hiloId,
      enListado && this.lectura.hilos().some((h) => h.id === hiloId),
    );
    return true;
  }

  limpiarErrorEscritura(): void {
    this.errorEscritura.set(null);
  }

  private async ejecutar<T>(
    clave: string,
    peticion: Observable<T>,
    vistaVigente: () => boolean,
    manejarError: (err: unknown) => void,
  ): Promise<T | null> {
    const propietario = this.propietario();
    if (!propietario || this.escriturasEnCurso().has(clave)) return null;
    const generacion = this.generacion();
    const vigente = () => this.propietario() === propietario && this.generacion() === generacion;
    this.escriturasEnCurso.update((s) => new Set(s).add(clave));
    this.limpiarErrorEscritura();
    try {
      const resultado = await firstValueFrom(peticion.pipe(takeUntil(this.canceladas)));
      return vigente() ? resultado : null;
    } catch (err) {
      if (!vigente() || err instanceof EmptyError) return null;
      if (err instanceof HttpErrorResponse && err.status === 401) {
        this.establecerUsuario(null);
        this.errorEscritura.set(TEXTOS.foro.sesionInvalida);
      } else if (vistaVigente()) manejarError(err);
      return null;
    } finally {
      if (vigente())
        this.escriturasEnCurso.update((s) => {
          const siguiente = new Set(s);
          siguiente.delete(clave);
          return siguiente;
        });
    }
  }

  private errorParticipacion(err: unknown, hiloId: string, mensaje: string): void {
    const cerrado = err instanceof HttpErrorResponse && err.status === 409;
    if (cerrado) this.lectura.marcarHiloCerrado(hiloId, false);
    this.errorEscritura.set(cerrado ? TEXTOS.foro.hiloCerrado : mensaje);
  }

  private errorModeracion(err: unknown, mensaje: string, refrescar: () => void): void {
    if (err instanceof HttpErrorResponse && err.status === 403) {
      this.errorEscritura.set(TEXTOS.foro.moderacionDenegada);
      return;
    }
    this.errorEscritura.set(mensaje);
    if (err instanceof HttpErrorResponse && err.status === 404) refrescar();
  }
}
