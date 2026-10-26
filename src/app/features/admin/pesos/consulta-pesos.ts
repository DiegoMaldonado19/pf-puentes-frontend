import { DatePipe, DecimalPipe, registerLocaleData } from '@angular/common';
import localeEsGt from '@angular/common/locales/es-GT';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, effect, inject, input, linkedSignal, LOCALE_ID, signal } from '@angular/core';
import { TEXTOS } from '../../../shared/textos';
import { JuegoPesosDTO, PaginaPesosDTO, PesoElementoDTO } from './modelos';
import { PesosService } from './pesos.service';

registerLocaleData(localeEsGt);

@Component({
  selector: 'app-consulta-pesos',
  imports: [DatePipe, DecimalPipe],
  providers: [{ provide: LOCALE_ID, useValue: 'es-GT' }],
  templateUrl: './consulta-pesos.html',
  styleUrl: './consulta-pesos.css',
})
export class ConsultaPesos {
  // La selección de versiones corresponde al módulo de formularios, no a una lista fija de P8.
  readonly formularioVersionId = input.required<string>();
  protected readonly t = TEXTOS.pesos;
  protected readonly juegos = signal<PaginaPesosDTO<JuegoPesosDTO> | null>(null);
  protected readonly pesos = signal<PaginaPesosDTO<PesoElementoDTO> | null>(null);
  protected readonly cargandoJuegos = signal(false);
  protected readonly cargandoPesos = signal(false);
  protected readonly errorJuegos = signal('');
  protected readonly errorPesos = signal('');
  protected readonly seleccionado = linkedSignal<string, JuegoPesosDTO | null>({
    source: this.formularioVersionId,
    computation: () => null,
  });

  private readonly servicio = inject(PesosService);
  private readonly paginaJuegos = linkedSignal({
    source: this.formularioVersionId,
    computation: () => 0,
  });
  private readonly paginaPesos = linkedSignal({ source: this.seleccionado, computation: () => 0 });
  private readonly intentoJuegos = signal(0);
  private readonly intentoPesos = signal(0);

  constructor() {
    effect((limpiar) => {
      const formulario = this.formularioVersionId();
      const pagina = this.paginaJuegos();
      this.intentoJuegos();
      this.juegos.set(null);
      this.errorJuegos.set('');
      this.cargandoJuegos.set(true);
      const consulta = this.servicio.listarJuegos(formulario, pagina).subscribe({
        next: (resultado) => {
          this.juegos.set(resultado);
          this.cargandoJuegos.set(false);
        },
        error: (error: unknown) => {
          this.errorJuegos.set(this.mensajeError(error));
          this.cargandoJuegos.set(false);
          this.seleccionado.set(null);
        },
      });
      limpiar(() => consulta.unsubscribe());
    });

    effect((limpiar) => {
      const juego = this.seleccionado();
      const pagina = this.paginaPesos();
      this.intentoPesos();
      this.pesos.set(null);
      this.errorPesos.set('');
      this.cargandoPesos.set(juego !== null);
      if (!juego) return;
      const consulta = this.servicio.listarPesos(juego.id, pagina).subscribe({
        next: (resultado) => {
          this.pesos.set(resultado);
          this.cargandoPesos.set(false);
        },
        error: (error: unknown) => {
          this.errorPesos.set(this.mensajeError(error));
          this.cargandoPesos.set(false);
          // Una sesión revocada también debe retirar los metadatos privados ya mostrados.
          if (error instanceof HttpErrorResponse && [401, 403].includes(error.status)) {
            this.juegos.set(null);
            this.errorJuegos.set(this.mensajeError(error));
            this.seleccionado.set(null);
          }
        },
      });
      limpiar(() => consulta.unsubscribe());
    });
  }

  protected seleccionar(juego: JuegoPesosDTO) {
    this.seleccionado.set(juego);
  }

  protected cambiarJuegos(pagina: number) {
    const actual = this.juegos();
    if (actual && pagina >= 0 && pagina < actual.total_pages) this.paginaJuegos.set(pagina);
  }

  protected cambiarPesos(pagina: number) {
    const actual = this.pesos();
    if (actual && pagina >= 0 && pagina < actual.total_pages) this.paginaPesos.set(pagina);
  }

  protected reintentarJuegos() {
    this.intentoJuegos.update((valor) => valor + 1);
  }

  protected reintentarPesos() {
    this.intentoPesos.update((valor) => valor + 1);
  }

  private mensajeError(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return this.t.error;
    switch (error.status) {
      case 0:
        return this.t.sinConexion;
      case 401:
        return this.t.sinSesion;
      case 403:
        return this.t.sinPermiso;
      case 404:
        return this.t.noEncontrado;
      default:
        return this.t.error;
    }
  }
}
