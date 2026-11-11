import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { debounceTime, of } from 'rxjs';
import { EstadoPuente } from '../../shared/estado-puente/estado-puente';
import { TEXTOS } from '../../shared/textos';
import { CatalogoService } from './catalogo.service';
import { mensajeDeError } from './errores';
import { EstadoFiltro, FiltrosPuentes, SituacionPuentes } from './modelos';
import { Paginacion } from './paginacion';
import { PuentesService } from './puentes.service';
import { ROL_PUENTES } from './rol-puentes';
import { sinInspeccionDesde12Meses } from './inspeccion-vencida';

export const TAMANO_PAGINA_LISTADO = 20;

/** Público (RN-USR-10): solo puentes activos; el estado siempre con texto (DT-FE-13). */
@Component({
  selector: 'app-listado-puentes',
  imports: [EstadoPuente, Paginacion, RouterLink],
  templateUrl: './listado-puentes.html',
})
export class ListadoPuentes {
  protected readonly t = TEXTOS.puentes;
  protected readonly textosAlertas = TEXTOS.alertasInspeccion;
  protected cuantosVencidos(
    puentes: readonly { fecha_ultima_inspeccion: string | null }[],
  ): number {
    return puentes.filter((p) => sinInspeccionDesde12Meses(p.fecha_ultima_inspeccion)).length;
  }
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
  // Solo el Administrador ve las bajas (RN-INV-08); para los demás el filtro no se envía
  protected readonly situaciones: readonly SituacionPuentes[] = ['ACTIVOS', 'BAJAS', 'TODOS'];
  protected readonly situacion = signal<SituacionPuentes>('ACTIVOS');
  protected readonly texto = signal('');
  private readonly textoConPausa = toSignal(toObservable(this.texto).pipe(debounceTime(300)), {
    initialValue: '',
  });

  protected readonly filtros = computed<FiltrosPuentes>(() => ({
    departamento: this.departamento() || null,
    municipio: this.municipio() || null,
    estado: this.estado() || null,
    q: this.textoConPausa().trim() || null,
    // Solo el administrador puede cambiar la situación (el control no existe para los demás)
    situacion: this.situacion() !== 'ACTIVOS' ? this.situacion() : null,
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

  protected cambiarSituacion(evento: Event): void {
    const valor = this.leer(evento);
    this.situacion.set(valor === 'BAJAS' || valor === 'TODOS' ? valor : 'ACTIVOS');
  }

  protected limpiar(): void {
    this.departamento.set('');
    this.estado.set('');
    this.texto.set('');
  }
}
