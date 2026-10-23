import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { EstadoUsuario, Rol } from '../../../core/auth/modelos';
import { TEXTOS } from '../../../shared/textos';
import { CLASE_ALERTA, CLASE_CAMPO, CLASE_ENLACE, mensajeHttp } from '../../auth/formulario';
import { AdminUsuariosService, TAMANO_PAGINA_ADMIN } from '../admin-usuarios';
import { PaginacionAdmin } from '../paginacion-admin';

const ROLES: readonly Rol[] = ['ESTUDIANTE', 'PROFESIONAL_EXTERNO', 'CATEDRATICO', 'ADMINISTRADOR'];
const ESTADOS: readonly EstadoUsuario[] = ['PENDIENTE', 'ACTIVO', 'INACTIVO'];

@Component({
  selector: 'app-usuarios',
  imports: [PaginacionAdmin, RouterLink],
  templateUrl: './usuarios.html',
})
export class Usuarios {
  protected readonly t = TEXTOS.admin.usuarios;
  protected readonly rolesTexto = TEXTOS.auth.roles;
  protected readonly estadosTexto = TEXTOS.auth.estados;
  protected readonly roles = ROLES;
  protected readonly estados = ESTADOS;
  protected readonly claseCampo = CLASE_CAMPO;
  protected readonly claseEnlace = CLASE_ENLACE;
  protected readonly claseAlerta = CLASE_ALERTA;
  protected readonly rol = signal<Rol | ''>('');
  protected readonly estado = signal<EstadoUsuario | ''>('');
  protected readonly texto = signal('');
  protected readonly filtros = computed(() => ({
    rol: this.rol(),
    estado: this.estado(),
    q: this.texto().trim().slice(0, 120),
  }));
  protected readonly pagina = linkedSignal({ source: this.filtros, computation: () => 0 });

  private readonly admin = inject(AdminUsuariosService);
  protected readonly resultado = rxResource({
    params: () => ({ filtros: this.filtros(), pagina: this.pagina() }),
    stream: ({ params }) =>
      this.admin.listarUsuarios({
        ...params.filtros,
        page: params.pagina,
        size: TAMANO_PAGINA_ADMIN,
      }),
  });
  protected readonly error = computed(() =>
    this.resultado.error() ? mensajeHttp(this.resultado.error()) : '',
  );

  protected leer(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected filtrarRol(evento: Event): void {
    this.rol.set(this.leer(evento) as Rol | '');
  }

  protected filtrarEstado(evento: Event): void {
    this.estado.set(this.leer(evento) as EstadoUsuario | '');
  }
}
