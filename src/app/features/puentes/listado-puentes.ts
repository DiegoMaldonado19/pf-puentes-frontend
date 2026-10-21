import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { debounceTime, of } from 'rxjs';
import { EstadoPuente } from '../../shared/estado-puente/estado-puente';
import { TEXTOS } from '../../shared/textos';
import { CatalogoService } from './catalogo.service';
import { mensajeDeError } from './errores';
import { EstadoFiltro, FiltrosPuentes } from './modelos';
import { Paginacion } from './paginacion';
import { PuentesService } from './puentes.service';
import { ROL_PUENTES } from './rol-puentes';

export const TAMANO_PAGINA_LISTADO = 20;

/** Público (RN-USR-10): solo puentes activos; el estado siempre con texto (DT-FE-13). */
@Component({
  selector: 'app-listado-puentes',
  imports: [EstadoPuente, Paginacion, RouterLink],
  templateUrl: './listado-puentes.html',
})
export class ListadoPuentes {
  protected readonly t = TEXTOS.puentes;
  protected readonly estadosFiltro: readonly EstadoFiltro[] = [
    'BUENO',
    'REGULAR',
    'MALO',
    'SIN_EVALUAR',
  ];
  protected readonly estadoTexto = TEXTOS.estadoPuente;
  protected readonly rol = inject(ROL_PUENTES);

  protected readonly departamento = signal('');
  protected readonly municipio = linkedSignal({ source: this.departamento, computation: () => '' });
  protected readonly estado = signal<EstadoFiltro | ''>('');
  protected readonly texto = signal('');
  private readonly textoConPausa = toSignal(toObservable(this.texto).pipe(debounceTime(300)), {
    initialValue: '',
  });

  protected readonly filtros = computed<FiltrosPuentes>(() => ({
    departamento: this.departamento() || null,
    municipio: this.municipio() || null,
    estado: this.estado() || null,
    q: this.textoConPausa().trim() || null,
  }));
  protected readonly hayFiltros = computed(() =>
    Object.values(this.filtros()).some((valor) => valor !== null),
  );
  // Un filtro nuevo vuelve a la primera página
  protected readonly pagina = linkedSignal({ source: this.filtros, computation: () => 0 });

  private readonly puentes = inject(PuentesService);
  private readonly catalogo = inject(CatalogoService);

  protected readonly departamentos = rxResource({ stream: () => this.catalogo.departamentos() });
  protected readonly municipios = rxResource({
    params: () => this.departamento(),
    stream: ({ params }) => (params ? this.catalogo.municipios(params) : of([])),
  });
  protected readonly resultado = rxResource({
    params: () => ({ filtros: this.filtros(), pagina: this.pagina() }),
    stream: ({ params }) =>
      this.puentes.listar(params.filtros, params.pagina, TAMANO_PAGINA_LISTADO),
  });
  protected readonly error = computed(() =>
    this.resultado.error() ? mensajeDeError(this.resultado.error()) : '',
  );

  protected leer(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected limpiar(): void {
    this.departamento.set('');
    this.estado.set('');
    this.texto.set('');
  }
}
