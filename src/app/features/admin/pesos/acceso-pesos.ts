import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/auth/auth';
import { TEXTOS } from '../../../shared/textos';
import { ConsultaPesos } from './consulta-pesos';
import { FormularioConPesosDTO } from './modelos';
import { PesosService } from './pesos.service';

@Component({
  selector: 'app-acceso-pesos',
  imports: [ConsultaPesos],
  templateUrl: './acceso-pesos.html',
})
export class AccesoPesos {
  private readonly auth = inject(AuthService);
  private readonly servicio = inject(PesosService);
  protected readonly t = TEXTOS.pesos.acceso;
  protected readonly comun = TEXTOS.pesos;
  protected readonly permitido = computed(
    () => this.auth.listo() && this.auth.autenticado() && this.auth.rol() === 'ADMINISTRADOR',
  );
  protected readonly pagina = linkedSignal({ source: this.permitido, computation: () => 0 });
  private readonly intento = signal(0);
  private readonly consulta = computed(() => ({
    permiso: this.permitido(),
    pagina: this.pagina(),
    intento: this.intento(),
  }));
  protected readonly seleccion = linkedSignal({
    source: this.consulta,
    computation: (): FormularioConPesosDTO | null => null,
  });
  protected readonly formularios = rxResource({
    params: () => (this.permitido() ? this.consulta() : undefined),
    stream: ({ params }) => this.servicio.listarFormularios(params.pagina),
  });
  protected readonly error = computed(() => {
    const error = this.formularios.error();
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) return this.comun.sinSesion;
      if (error.status === 403) return this.comun.sinPermiso;
      if (error.status === 0) return this.comun.sinConexion;
    }
    return this.comun.error;
  });

  protected seleccionar(formulario: FormularioConPesosDTO) {
    if (
      this.permitido() &&
      !this.formularios.isLoading() &&
      !this.formularios.error() &&
      this.formularios.value()?.content.includes(formulario)
    )
      this.seleccion.set(formulario);
  }

  protected cambiar(pagina: number) {
    const actual = this.formularios.value();
    if (
      this.permitido() &&
      !this.formularios.isLoading() &&
      actual &&
      pagina >= 0 &&
      pagina < actual.total_pages
    )
      this.pagina.set(pagina);
  }

  protected reintentar() {
    if (this.permitido()) this.intento.update((v) => v + 1);
  }
}
