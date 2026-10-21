import { Component, ElementRef, inject, OnDestroy, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { Map as MapaMapLibre } from 'maplibre-gl';
import { firstValueFrom } from 'rxjs';
import { TEXTOS } from '../../../shared/textos';
import { mensajeDeError } from '../errores';
import { PuenteDTO } from '../modelos';
import { PuentesService } from '../puentes.service';
import {
  CARGADOR_MAPLIBRE,
  CENTRO_GUATEMALA,
  claveEstado,
  ESTILO_OSM,
  MARCADOR_ESTADO,
} from './maplibre';

/** Botón del marcador: color, letra y aria-label con el estado en texto (DT-FE-13). */
export function elementoMarcador(puente: PuenteDTO): HTMLButtonElement {
  const clave = claveEstado(puente.estado_actual);
  const estilo = MARCADOR_ESTADO[clave];
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.textContent = estilo.letra;
  boton.setAttribute(
    'aria-label',
    `${puente.nombre} (${puente.codigo}): ${TEXTOS.estadoPuente[clave]}`,
  );
  boton.className =
    'grid h-7 w-7 place-items-center rounded-full border-2 border-white text-xs font-bold shadow focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-black';
  boton.style.background = estilo.fondo;
  boton.style.color = estilo.texto;
  return boton;
}

/** Con textContent, nunca innerHTML: el nombre viene de la base de datos. */
export function contenidoPopup(puente: PuenteDTO, abrirFicha: (id: string) => void): HTMLElement {
  const t = TEXTOS.puentes;
  const clave = claveEstado(puente.estado_actual);
  const caja = document.createElement('div');
  caja.className = 'text-sm';
  const nombre = document.createElement('p');
  nombre.className = 'font-semibold';
  nombre.textContent = puente.nombre;
  const codigo = document.createElement('p');
  codigo.className = 'font-mono';
  codigo.textContent = puente.codigo;
  const estado = document.createElement('p');
  estado.textContent = `${t.campos.estado}: ${TEXTOS.estadoPuente[clave]}`;
  const enlace = document.createElement('a');
  enlace.href = `/puentes/${puente.id}`;
  enlace.className = 'text-blue-800 underline';
  enlace.textContent = t.mapa.verFicha;
  enlace.addEventListener('click', (evento) => {
    evento.preventDefault();
    abrirFicha(puente.id);
  });
  caja.append(nombre, codigo, estado, enlace);
  return caja;
}

@Component({
  selector: 'app-mapa-puentes',
  imports: [RouterLink],
  templateUrl: './mapa-puentes.html',
})
export class MapaPuentes implements OnDestroy {
  protected readonly t = TEXTOS.puentes;
  protected readonly leyenda = (['BUENO', 'REGULAR', 'MALO', 'SIN_EVALUAR'] as const).map(
    (clave) => ({
      clave,
      etiqueta: TEXTOS.estadoPuente[clave],
      ...MARCADOR_ESTADO[clave],
    }),
  );
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly total = signal<number | null>(null);

  private readonly contenedor = viewChild.required<ElementRef<HTMLElement>>('contenedor');
  private readonly puentes = inject(PuentesService);
  private readonly cargar = inject(CARGADOR_MAPLIBRE);
  private readonly router = inject(Router);
  private mapa?: MapaMapLibre;
  private destruido = false;

  constructor() {
    void this.iniciar();
  }

  private async iniciar(): Promise<void> {
    try {
      const [maplibre, puentes] = await Promise.all([
        this.cargar().catch(() => null),
        firstValueFrom(this.puentes.todosActivos()),
      ]);
      if (this.destruido) return;
      this.total.set(puentes.length);
      if (!maplibre) {
        this.error.set(this.t.mapa.errorMapa);
        return;
      }
      this.mapa = new maplibre.Map({
        container: this.contenedor().nativeElement,
        style: ESTILO_OSM,
        center: CENTRO_GUATEMALA,
        zoom: 6.3,
      });
      this.mapa.addControl(new maplibre.NavigationControl());
      const limites = new maplibre.LngLatBounds();
      for (const puente of puentes) {
        const popup = new maplibre.Popup({ offset: 16 }).setDOMContent(
          contenidoPopup(puente, (id) => void this.router.navigate(['/puentes', id])),
        );
        new maplibre.Marker({ element: elementoMarcador(puente) })
          .setLngLat([puente.longitud, puente.latitud])
          .setPopup(popup)
          .addTo(this.mapa);
        limites.extend([puente.longitud, puente.latitud]);
      }
      if (puentes.length > 1) {
        this.mapa.fitBounds(limites, { padding: 48, maxZoom: 13 });
      } else if (puentes.length === 1) {
        this.mapa.setCenter([puentes[0].longitud, puentes[0].latitud]).setZoom(13);
      }
    } catch (error) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  ngOnDestroy(): void {
    this.destruido = true;
    this.mapa?.remove();
  }
}
