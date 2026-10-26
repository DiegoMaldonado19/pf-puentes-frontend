import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TEXTOS } from '../textos';

export interface MarcaAnclada {
  readonly id: string;
  readonly tipo: string;
  readonly etiqueta: string;
}

export interface AperturaMarca {
  readonly elementoRef: string;
  readonly marca: MarcaAnclada;
}

@Component({
  selector: 'app-marcador-anclado',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './marcador-anclado.html',
})
export class MarcadorAnclado {
  readonly elementoRef = input.required<string>();
  readonly marcas = input<readonly MarcaAnclada[]>([]);
  readonly cargando = input(false);
  readonly error = input<string | null>(null);
  readonly noIntegrado = input(false);
  readonly sinPermisos = input(false);

  readonly abrir = output<AperturaMarca>();

  protected readonly textos = TEXTOS.marcador;

  protected readonly marcasValidas = computed<readonly MarcaAnclada[]>(() => {
    const vistas = new Set<string>();
    const resultado: MarcaAnclada[] = [];
    for (const marca of this.marcas()) {
      const etiqueta = marca.etiqueta.trim();
      if (!marca.id.trim() || !marca.tipo.trim() || !etiqueta || vistas.has(marca.id)) {
        continue;
      }
      vistas.add(marca.id);
      resultado.push({ id: marca.id, tipo: marca.tipo.trim(), etiqueta });
    }
    return resultado;
  });

  protected readonly estado = computed<
    'LISTO' | 'CARGANDO' | 'VACIO' | 'ERROR' | 'NO_INTEGRADO' | 'SIN_PERMISOS'
  >(() => {
    if (!this.elementoRef().trim()) {
      return 'ERROR';
    }
    if (this.noIntegrado()) {
      return 'NO_INTEGRADO';
    }
    if (this.sinPermisos()) {
      return 'SIN_PERMISOS';
    }
    if (this.cargando()) {
      return 'CARGANDO';
    }
    if (this.error()) {
      return 'ERROR';
    }
    return this.marcasValidas().length === 0 ? 'VACIO' : 'LISTO';
  });

  protected readonly mensajeError = computed(() =>
    this.elementoRef().trim() ? (this.error() ?? this.textos.error) : this.textos.refInvalida,
  );

  protected readonly etiquetaSeccion = computed(
    () => `${this.textos.titulo}: ${this.elementoRef()}`,
  );

  protected abrirMarca(marca: MarcaAnclada): void {
    if (this.estado() !== 'LISTO') {
      return;
    }
    this.abrir.emit({ elementoRef: this.elementoRef().trim(), marca });
  }
}
