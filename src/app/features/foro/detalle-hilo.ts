import { ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TEXTOS } from '../../shared/textos';
import { ForoService } from './foro.service';
import { ForoLecturaService } from './foro-lectura.service';
import { DialogoModeracion } from './dialogo-moderacion';
import { ItemComentario } from './item-comentario';
import { Comentario, Hilo, esUuid, formatearFechaUtc } from './modelos';

@Component({
  selector: 'app-detalle-hilo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DialogoModeracion, ItemComentario],
  templateUrl: './detalle-hilo.html',
})
export class DetalleHilo {
  protected readonly servicio = inject(ForoService);
  protected readonly lectura = inject(ForoLecturaService);
  protected readonly textos = TEXTOS.foro;

  private readonly route = inject(ActivatedRoute);
  private readonly parametros = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  protected readonly invalido = signal(false);
  protected readonly puenteId = signal('');
  protected readonly hiloId = signal('');

  protected readonly respuestasAbiertas = signal<ReadonlySet<string>>(new Set());
  protected readonly respondiendoRaiz = signal<string | null>(null);
  protected readonly borradorParticipacion = signal('');
  protected readonly errorFormulario = signal<string | null>(null);
  private readonly dialogoParticipacion =
    viewChild<ElementRef<HTMLDialogElement>>('dialogoParticipacion');

  protected readonly respuestaObjetivo = computed(
    () => this.lectura.comentarios().find((c) => c.id === this.respondiendoRaiz()) ?? null,
  );
  protected readonly participacionEnCurso = computed(() => {
    const raiz = this.respondiendoRaiz();
    return raiz ? this.enCurso('responder:' + raiz) : this.servicio.comentando();
  });

  protected readonly editandoId = signal<string | null>(null);
  protected readonly borradorEdicion = signal('');

  protected readonly dialogoModeracion = signal<{
    tipo: 'ocultar' | 'cerrar';
    objetivoId: string;
    titulo: string;
  } | null>(null);
  protected readonly motivoModeracion = signal('');
  protected readonly errorMotivo = signal<string | null>(null);

  private activo = true;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.activo = false;
    });

    effect(() => {
      const mapa = this.parametros();
      const puente = mapa.get('puenteId');
      const hilo = mapa.get('hiloId');
      if (!esUuid(puente) || !esUuid(hilo)) {
        this.invalido.set(true);
        this.puenteId.set('');
        this.hiloId.set('');
        return;
      }
      this.invalido.set(false);
      this.puenteId.set(puente);
      this.hiloId.set(hilo);
      this.lectura.cargarHilo(hilo, puente);
      this.lectura.cargarComentarios(hilo, 0);
    });

    effect(() => {
      this.hiloId();
      this.servicio.generacion();
      const dialogo = this.dialogoParticipacion()?.nativeElement;
      if (dialogo?.open) dialogo.close();
      this.limpiarParticipacion();
      this.cancelarEdicion();
      this.respuestasAbiertas.set(new Set());
      this.dialogoModeracion.set(null);
      this.motivoModeracion.set('');
      this.errorMotivo.set(null);
    });
  }

  protected enCurso(clave: string): boolean {
    return this.servicio.escriturasEnCurso().has(clave);
  }

  protected paginaAnterior(): void {
    this.lectura.cargarComentarios(this.hiloId(), this.lectura.paginaComentarios() - 1);
  }

  protected paginaSiguiente(): void {
    this.lectura.cargarComentarios(this.hiloId(), this.lectura.paginaComentarios() + 1);
  }

  protected alternarRespuestas(c: Comentario): void {
    const abierto = this.respuestasAbiertas().has(c.id);
    this.respuestasAbiertas.update((s) => {
      const n = new Set(s);
      if (abierto) n.delete(c.id);
      else n.add(c.id);
      return n;
    });
    if (!abierto) {
      this.lectura.cargarRespuestas(c.id, 0);
    }
  }

  protected paginaRespuestas(raizId: string, pagina: number): void {
    this.lectura.cargarRespuestas(raizId, pagina);
  }

  protected abrirComentario(): void {
    if (!this.servicio.sesionActiva() || !this.lectura.hilo() || this.lectura.hilo()?.cerrado) {
      return;
    }
    this.limpiarParticipacion();
    this.servicio.limpiarErrorEscritura();
    this.dialogoParticipacion()?.nativeElement.showModal();
  }

  protected iniciarRespuesta(c: Comentario): void {
    if (!this.puedeResponder(c)) return;
    this.servicio.limpiarErrorEscritura();
    this.limpiarParticipacion(c.id);
    if (!this.respuestasAbiertas().has(c.id)) {
      this.alternarRespuestas(c);
    }
    this.dialogoParticipacion()?.nativeElement.showModal();
  }

  protected async enviarParticipacion(evento: SubmitEvent): Promise<void> {
    evento.preventDefault();
    const raizId = this.respondiendoRaiz();
    const objetivo = this.respuestaObjetivo();
    if (raizId) {
      if (!objetivo || !this.puedeResponder(objetivo) || this.enCurso('responder:' + objetivo.id)) {
        return;
      }
    } else if (
      !this.servicio.sesionActiva() ||
      this.lectura.hilo()?.cerrado ||
      this.servicio.comentando()
    ) {
      return;
    }

    const texto = this.borradorParticipacion().trim();
    if (!texto) {
      this.errorFormulario.set(this.textos.textoObligatorio);
      return;
    }
    this.errorFormulario.set(null);

    const hilo = this.hiloId();
    const generacion = this.servicio.generacion();
    const enviadoCrudo = this.borradorParticipacion();
    const creado = raizId
      ? await this.servicio.responder(hilo, raizId, texto)
      : await this.servicio.comentar(hilo, texto);
    if (!creado || !this.sigueVigente(hilo, generacion)) {
      return;
    }
    if (this.respondiendoRaiz() === raizId && this.borradorParticipacion() === enviadoCrudo) {
      this.limpiarParticipacion();
      this.dialogoParticipacion()?.nativeElement.close();
    }
  }

  protected cerrarParticipacion(): void {
    if (this.participacionEnCurso()) return;
    this.dialogoParticipacion()?.nativeElement.close();
    this.limpiarParticipacion();
  }

  protected cancelarParticipacion(evento: Event): void {
    evento.preventDefault();
    this.cerrarParticipacion();
  }

  protected iniciarEdicion(c: Comentario): void {
    this.editandoId.set(c.id);
    this.borradorEdicion.set(c.texto ?? '');
    this.errorFormulario.set(null);
  }

  protected cancelarEdicion(): void {
    this.editandoId.set(null);
    this.borradorEdicion.set('');
    this.errorFormulario.set(null);
  }

  protected async guardarEdicion(c: Comentario, evento: SubmitEvent): Promise<void> {
    evento.preventDefault();
    const texto = this.borradorEdicion().trim();
    if (!texto) {
      this.errorFormulario.set(this.textos.textoObligatorio);
      return;
    }
    if (texto === (c.texto ?? '').trim()) {
      this.cancelarEdicion();
      return;
    }
    this.errorFormulario.set(null);
    const hilo = this.hiloId();
    const generacion = this.servicio.generacion();
    const enviadoCrudo = this.borradorEdicion();
    const editado = await this.servicio.editar(c.id, texto);
    if (!editado || !this.sigueVigente(hilo, generacion)) {
      return;
    }
    if (this.editandoId() === c.id && this.borradorEdicion() === enviadoCrudo) {
      this.cancelarEdicion();
    }
  }

  protected async eliminar(c: Comentario): Promise<void> {
    const hilo = this.hiloId();
    const generacion = this.servicio.generacion();
    const ok = await this.servicio.borrar(c.id);
    if (!ok || !this.sigueVigente(hilo, generacion)) {
      return;
    }
    if (this.editandoId() === c.id) {
      this.cancelarEdicion();
    }
  }

  protected abrirOcultamiento(c: Comentario): void {
    this.abrirDialogoModeracion({
      tipo: 'ocultar',
      objetivoId: c.id,
      titulo: this.textos.tituloOcultar,
    });
  }

  protected abrirCierre(hilo: Hilo): void {
    this.abrirDialogoModeracion({
      tipo: 'cerrar',
      objetivoId: hilo.id,
      titulo: this.textos.tituloCerrarHilo,
    });
  }

  protected cerrarDialogoModeracion(): void {
    if (this.moderacionEnCurso()) return;
    this.dialogoModeracion.set(null);
    this.motivoModeracion.set('');
    this.errorMotivo.set(null);
  }

  protected actualizarMotivo(valor: string): void {
    if (this.moderacionEnCurso()) return;
    this.motivoModeracion.set(valor);
    this.errorMotivo.set(null);
  }

  protected moderacionEnCurso(): boolean {
    const dialogo = this.dialogoModeracion();
    return dialogo ? this.enCurso(`${dialogo.tipo}:${dialogo.objetivoId}`) : false;
  }

  protected async confirmarModeracion(): Promise<void> {
    const dialogo = this.dialogoModeracion();
    const motivo = this.motivoModeracion().trim();
    if (!dialogo) return;
    if (!motivo) {
      this.errorMotivo.set(this.textos.motivoObligatorio);
      return;
    }
    this.errorMotivo.set(null);
    const hilo = this.hiloId();
    const generacion = this.servicio.generacion();
    const enviadoCrudo = this.motivoModeracion();
    const ok =
      dialogo.tipo === 'ocultar'
        ? await this.servicio.ocultarComentario(dialogo.objetivoId, motivo)
        : await this.servicio.cerrarHilo(dialogo.objetivoId, motivo);
    if (!ok || !this.sigueVigente(hilo, generacion)) {
      return;
    }

    if (dialogo.tipo === 'cerrar' || this.respondiendoRaiz() === dialogo.objetivoId) {
      this.limpiarParticipacion();
    }
    if (this.editandoId() === dialogo.objetivoId) {
      this.cancelarEdicion();
    }
    const actual = this.dialogoModeracion();
    if (
      actual &&
      actual.tipo === dialogo.tipo &&
      actual.objetivoId === dialogo.objetivoId &&
      this.motivoModeracion() === enviadoCrudo
    ) {
      this.motivoModeracion.set('');
      this.dialogoModeracion.set(null);
    }
  }

  protected fechaUtc(iso: string): string {
    return formatearFechaUtc(iso);
  }

  private puedeResponder(c: Comentario): boolean {
    const hilo = this.lectura.hilo();
    return (
      this.servicio.sesionActiva() && !!hilo && !hilo.cerrado && c.padre_id === null && !c.eliminado
    );
  }

  private limpiarParticipacion(raizId: string | null = null): void {
    this.respondiendoRaiz.set(raizId);
    this.borradorParticipacion.set('');
    this.errorFormulario.set(null);
  }

  private abrirDialogoModeracion(dialogo: {
    tipo: 'ocultar' | 'cerrar';
    objetivoId: string;
    titulo: string;
  }): void {
    this.servicio.limpiarErrorEscritura();
    this.dialogoModeracion.set(dialogo);
    this.motivoModeracion.set('');
    this.errorMotivo.set(null);
  }

  private sigueVigente(hiloId: string, generacion: number): boolean {
    return this.activo && this.hiloId() === hiloId && this.servicio.generacion() === generacion;
  }
}
