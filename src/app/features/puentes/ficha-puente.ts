import { DatePipe, DecimalPipe, registerLocaleData } from '@angular/common';
import localeEsGt from '@angular/common/locales/es-GT';
import { Component, computed, inject, input, LOCALE_ID, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EstadoPuente } from '../../shared/estado-puente/estado-puente';
import { TEXTOS } from '../../shared/textos';
import { mensajeDeError } from './errores';
import { fechaSinHora } from './formato';
import { MapaUbicacion } from './mapa/mapa-ubicacion';
import { PuentesService } from './puentes.service';
import { ROL_PUENTES } from './rol-puentes';

registerLocaleData(localeEsGt);

@Component({
  selector: 'app-ficha-puente',
  imports: [DatePipe, DecimalPipe, EstadoPuente, MapaUbicacion, ReactiveFormsModule, RouterLink],
  providers: [{ provide: LOCALE_ID, useValue: 'es-GT' }],
  templateUrl: './ficha-puente.html',
})
export class FichaPuente {
  /** Parámetro :id de la ruta (withComponentInputBinding). */
  readonly id = input.required<string>();
  protected readonly t = TEXTOS.puentes;
  protected readonly textosForo = TEXTOS.foro;
  protected readonly textosInspecciones = TEXTOS.inspecciones;
  protected readonly rol = inject(ROL_PUENTES);
  protected readonly fechaSinHora = fechaSinHora;

  private readonly servicio = inject(PuentesService);
  protected readonly puente = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.servicio.detalle(params),
  });
  protected readonly error = computed(() =>
    this.puente.error() ? mensajeDeError(this.puente.error()) : '',
  );

  // RN-INV-08: la baja exige un motivo escrito
  protected readonly motivo = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(500), Validators.pattern(/\S/)],
  });
  protected readonly bajaAbierta = signal(false);
  protected readonly enviandoBaja = signal(false);
  protected readonly errorBaja = signal('');
  protected readonly bajaHecha = signal(false);

  protected darDeBaja(): void {
    if (this.motivo.invalid) {
      this.motivo.markAsTouched();
      return;
    }
    this.enviandoBaja.set(true);
    this.errorBaja.set('');
    this.servicio.darDeBaja(this.id(), this.motivo.value.trim()).subscribe({
      next: (actualizado) => {
        this.puente.set(actualizado);
        this.bajaAbierta.set(false);
        this.enviandoBaja.set(false);
        this.bajaHecha.set(true);
      },
      error: (error: unknown) => {
        this.errorBaja.set(mensajeDeError(error));
        this.enviandoBaja.set(false);
      },
    });
  }
}
