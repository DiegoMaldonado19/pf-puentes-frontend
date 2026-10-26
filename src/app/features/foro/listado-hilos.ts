import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TEXTOS } from '../../shared/textos';
import { ForoService } from './foro.service';
import { ForoLecturaService } from './foro-lectura.service';
import { DialogoModeracion } from './dialogo-moderacion';
import { CATEGORIAS_HILO, CategoriaHilo, Hilo, LIMITE_TITULO, esUuid, formatearFechaUtc } from './modelos';

@Component({
  selector: 'app-listado-hilos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DialogoModeracion],
  templateUrl: './listado-hilos.html',
})
export class ListadoHilos {
  protected readonly servicio = inject(ForoService);
  protected readonly lectura = inject(ForoLecturaService);
  protected readonly textos = TEXTOS.foro;
  protected readonly categorias = CATEGORIAS_HILO;
  protected readonly limiteTitulo = LIMITE_TITULO;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly parametros = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  protected readonly invalido = signal(false);
  protected readonly puenteId = signal('');
  protected readonly filtro = signal<CategoriaHilo | null>(null);

  protected readonly borradorTitulo = signal('');
  protected readonly borradorCategoria = signal('');
  protected readonly errorFormulario = signal<string | null>(null);
  private readonly dialogoCreacion = viewChild<ElementRef<HTMLDialogElement>>('dialogoCreacion');

  protected readonly dialogoModeracion = signal<{ objetivoId: string; titulo: string } | null>(
    null,
  );
  protected readonly motivoModeracion = signal('');
  protected readonly errorMotivo = signal<string | null>(null);

  private activo = true;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.activo = false;
    });

    effect(() => {
      const puente = this.parametros().get('puenteId');
      if (!esUuid(puente)) {
        this.invalido.set(true);
        this.puenteId.set('');
        return;
      }
      this.invalido.set(false);
      this.puenteId.set(puente);
      this.filtro.set(null);
      this.lectura.cargarHilos(puente, 0);
    });

    effect(() => {
      this.puenteId();
      this.servicio.generacion();
      const dialogo = this.dialogoCreacion()?.nativeElement;
      if (dialogo?.open) dialogo.close();
      this.limpiarCreacion();
      this.dialogoModeracion.set(null);
      this.motivoModeracion.set('');
      this.errorMotivo.set(null);
    });
  }

  protected enCurso(clave: string): boolean {
    return this.servicio.escriturasEnCurso().has(clave);
  }

  protected alFiltrar(valor: string): void {
    const categoria = CATEGORIAS_HILO.includes(valor as CategoriaHilo)
      ? (valor as CategoriaHilo)
      : null;
    this.filtro.set(categoria);
    this.lectura.cargarHilos(this.puenteId(), 0, undefined, categoria);
  }

  protected reintentar(): void {
    this.lectura.reintentarHilos();
  }

  protected paginaAnterior(): void {
    this.lectura.cargarHilos(
      this.puenteId(),
      this.lectura.paginaHilos() - 1,
      undefined,
      this.filtro(),
    );
  }

  protected paginaSiguiente(): void {
    this.lectura.cargarHilos(
      this.puenteId(),
      this.lectura.paginaHilos() + 1,
      undefined,
      this.filtro(),
    );
  }

  protected async publicar(evento: SubmitEvent): Promise<void> {
    evento.preventDefault();
    if (!this.servicio.sesionActiva() || this.servicio.creandoHilo()) {
      return;
    }
    const titulo = this.borradorTitulo().trim();
    if (!titulo || titulo.length > this.limiteTitulo) {
      this.errorFormulario.set(this.textos.tituloObligatorio);
      return;
    }
    const categoria = this.borradorCategoria();
    if (!CATEGORIAS_HILO.includes(categoria as CategoriaHilo)) {
      this.errorFormulario.set(this.textos.categoriaObligatoria);
      return;
    }
    this.errorFormulario.set(null);

    const puente = this.puenteId();
    const generacion = this.servicio.generacion();
    const creado = await this.servicio.crearHilo(puente, {
      titulo,
      categoria: categoria as CategoriaHilo,
    });
    if (!creado || !this.sigueVigente(puente, generacion)) {
      return;
    }
    this.limpiarCreacion();
    this.dialogoCreacion()?.nativeElement.close();
    await this.router.navigate(['/puentes', puente, 'foro', creado.id]);
  }

  protected abrirCreacion(): void {
    if (!this.servicio.sesionActiva()) return;
    this.limpiarCreacion();
    this.servicio.limpiarErrorEscritura();
    this.dialogoCreacion()?.nativeElement.showModal();
  }

  protected cerrarCreacion(): void {
    if (!this.servicio.creandoHilo()) {
      this.limpiarCreacion();
      this.dialogoCreacion()?.nativeElement.close();
    }
  }

  protected cancelarCreacion(evento: Event): void {
    evento.preventDefault();
    this.cerrarCreacion();
  }

  protected limpiarCreacion(): void {
    this.borradorTitulo.set('');
    this.borradorCategoria.set('');
    this.errorFormulario.set(null);
  }

  protected abrirCierre(hilo: Hilo): void {
    this.servicio.limpiarErrorEscritura();
    this.dialogoModeracion.set({ objetivoId: hilo.id, titulo: this.textos.tituloCerrarHilo });
    this.motivoModeracion.set('');
    this.errorMotivo.set(null);
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
    return dialogo ? this.enCurso(`cerrar:${dialogo.objetivoId}`) : false;
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
    const puente = this.puenteId();
    const generacion = this.servicio.generacion();
    const enviadoCrudo = this.motivoModeracion();
    const ok = await this.servicio.cerrarHilo(dialogo.objetivoId, motivo);
    if (!ok || !this.sigueVigente(puente, generacion)) {
      return;
    }
    const actual = this.dialogoModeracion();
    if (
      actual &&
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

  private sigueVigente(puenteId: string, generacion: number): boolean {
    return this.activo && this.puenteId() === puenteId && this.servicio.generacion() === generacion;
  }
}
