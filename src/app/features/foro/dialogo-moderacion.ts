import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { TEXTOS } from '../../shared/textos';

@Component({
  selector: 'app-dialogo-moderacion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dialogo-moderacion.html',
})
export class DialogoModeracion {
  protected readonly textos = TEXTOS.foro;

  readonly titulo = input.required<string>();
  readonly motivo = input.required<string>();
  readonly errorMotivo = input<string | null>(null);
  readonly errorServidor = input<string | null>(null);
  readonly enCurso = input(false);

  readonly cambioMotivo = output<string>();
  readonly cancelar = output<void>();
  readonly confirmar = output<void>();

  private readonly campoMotivo = viewChild<ElementRef<HTMLTextAreaElement>>('campoMotivo');

  constructor() {
    effect(() => {
      this.campoMotivo()?.nativeElement.focus();
    });
  }
}
