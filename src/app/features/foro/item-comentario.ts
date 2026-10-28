import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  output,
} from '@angular/core';
import { TEXTOS } from '../../shared/textos';
import { ForoService } from './foro.service';
import { Comentario, dentroDeVentanaEdicion, formatearFechaUtc, nombrarMenciones } from './modelos';
import { MENCIONES_P2 } from './puertos';

@Component({
  selector: 'app-item-comentario',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './item-comentario.html',
})
export class ItemComentario implements OnInit {
  protected readonly servicio = inject(ForoService);
  protected readonly textos = TEXTOS.foro;
  private readonly menciones = inject(MENCIONES_P2);

  readonly comentario = input.required<Comentario>();
  readonly esRaiz = input(false);
  readonly hiloCerrado = input(false);
  readonly respuestasAbiertas = input(false);
  readonly editando = input(false);
  readonly borradorEdicion = input('');
  readonly errorFormulario = input<string | null>(null);

  readonly alternarRespuestas = output<void>();
  readonly responder = output<void>();
  readonly iniciarEdicion = output<void>();
  readonly cambioBorrador = output<string>();
  readonly guardarEdicion = output<SubmitEvent>();
  readonly cancelarEdicion = output<void>();
  readonly eliminar = output<void>();
  readonly ocultar = output<void>();

  protected readonly textoVisible = computed(() =>
    nombrarMenciones(this.comentario().texto ?? '', this.menciones.personas()),
  );

  ngOnInit(): void {
    this.menciones.cargar();
  }

  protected enCurso(clave: string): boolean {
    return this.servicio.escriturasEnCurso().has(clave);
  }

  protected puedeResponder(): boolean {
    const c = this.comentario();
    return (
      this.esRaiz() &&
      this.servicio.sesionActiva() &&
      !this.hiloCerrado() &&
      c.padre_id === null &&
      !c.eliminado
    );
  }

  protected puedeEditar(): boolean {
    const c = this.comentario();
    return (
      this.servicio.sesionActiva() &&
      c.autor_id === this.servicio.usuarioId() &&
      !c.eliminado &&
      dentroDeVentanaEdicion(c.creado_en)
    );
  }

  protected puedeBorrar(): boolean {
    const c = this.comentario();
    return this.servicio.sesionActiva() && c.autor_id === this.servicio.usuarioId() && !c.eliminado;
  }

  protected fechaUtc(iso: string): string {
    return formatearFechaUtc(iso);
  }
}
