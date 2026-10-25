import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth';
import { TEXTOS } from '../../../shared/textos';
import { FormularioService } from '../../formulario/formulario.service';
import { PesosService } from './pesos.service';

@Component({
  selector: 'app-campos-dano-pesos',
  templateUrl: './campos-dano-pesos.html',
})
export class CamposDanoPesos {
  private readonly auth = inject(AuthService);
  private readonly formularios = inject(FormularioService);
  private readonly pesos = inject(PesosService);
  protected readonly t = TEXTOS.pesos.campos;
  protected readonly comun = TEXTOS.pesos;
  protected readonly permitido = computed(
    () => this.auth.listo() && this.auth.autenticado() && this.auth.rol() === 'ADMINISTRADOR',
  );
  protected readonly pagina = linkedSignal({ source: this.permitido, computation: () => 0 });
  private readonly intento = signal(0);
  private readonly contexto = computed(() => ({
    permiso: this.permitido(),
    pagina: this.pagina(),
    intento: this.intento(),
  }));
  protected readonly version = linkedSignal({ source: this.contexto, computation: () => '' });
  protected readonly paginaCampos = linkedSignal({ source: this.version, computation: () => 0 });
  private readonly intentoCampos = signal(0);
  protected readonly versiones = rxResource({
    params: this.contexto,
    stream: ({ params }) =>
      params.permiso
        ? this.formularios.listar(params.pagina)
        : of({ contenido: [], pagina: 0, tamano: 20, total_elementos: 0, total_paginas: 0 }),
  });
  protected readonly campos = rxResource({
    params: () => ({
      permiso: this.permitido(),
      version: this.version(),
      pagina: this.paginaCampos(),
      intento: this.intentoCampos(),
    }),
    stream: ({ params }) =>
      params.permiso && params.version
        ? this.pesos.listarElementosDano(params.version, params.pagina)
        : of({ content: [], page: 0, size: 20, total_elements: 0, total_pages: 0 }),
  });
  protected readonly accesoDenegado = computed(() =>
    [this.versiones.error(), this.campos.error()].find(
      (error) => error instanceof HttpErrorResponse && [401, 403].includes(error.status),
    ),
  );

  protected elegir(id: string) {
    if (
      this.permitido() &&
      !this.versiones.isLoading() &&
      !this.versiones.error() &&
      (id === '' || this.versiones.value()?.contenido.some((v) => v.id === id))
    )
      this.version.set(id);
  }

  protected cambiar(pagina: number, campos = false) {
    if (!this.permitido()) return;
    const recurso = campos ? this.campos : this.versiones;
    if (recurso.isLoading() || recurso.error()) return;
    const total = campos ? this.campos.value()?.total_pages : this.versiones.value()?.total_paginas;
    if (total !== undefined && pagina >= 0 && pagina < total)
      (campos ? this.paginaCampos : this.pagina).set(pagina);
  }

  protected reintentar(campos = false) {
    if (this.permitido()) (campos ? this.intentoCampos : this.intento).update((v) => v + 1);
  }

  protected error(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) return this.comun.sinSesion;
      if (error.status === 403) return this.comun.sinPermiso;
      if (error.status === 422) return this.t.incompatible;
      if (error.status === 0) return this.comun.sinConexion;
    }
    return this.comun.error;
  }
}
