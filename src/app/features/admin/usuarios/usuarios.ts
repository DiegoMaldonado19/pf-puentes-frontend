import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';
import { EstadoUsuario, Rol, UsuarioAdminDTO } from '../../../core/auth/modelos';
import { TEXTOS } from '../../../shared/textos';
import {
  CLASE_ALERTA,
  CLASE_BOTON,
  CLASE_CAMPO,
  CLASE_ENLACE,
  invalido,
  mensajeDeControl,
  mensajeHttp,
} from '../../auth/formulario';
import { AdminUsuariosService, TAMANO_PAGINA_ADMIN } from '../admin-usuarios';
import { Paginador } from '../../../shared/ui/paginador';

const ROLES: readonly Rol[] = ['ESTUDIANTE', 'PROFESIONAL_EXTERNO', 'CATEDRATICO', 'ADMINISTRADOR'];
const ESTADOS: readonly EstadoUsuario[] = ['PENDIENTE', 'ACTIVO', 'INACTIVO'];

@Component({
  selector: 'app-usuarios',
  imports: [Paginador, ReactiveFormsModule, RouterLink, RouterLinkActive],
  templateUrl: './usuarios.html',
})
export class Usuarios {
  protected readonly t = TEXTOS.admin.usuarios;
  protected readonly g = TEXTOS.admin.usuarios.gestion;
  protected readonly rolesTexto = TEXTOS.auth.roles;
  protected readonly estadosTexto = TEXTOS.auth.estados;
  protected readonly pestanas = TEXTOS.auth.nav;
  protected readonly roles = ROLES;
  protected readonly estados = ESTADOS;
  protected readonly claseCampo = CLASE_CAMPO;
  protected readonly claseEnlace = CLASE_ENLACE;
  protected readonly claseAlerta = CLASE_ALERTA;
  protected readonly claseBoton = CLASE_BOTON;
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

  // Alta ('alta') o edición de una cuenta existente; null = sin formulario abierto
  protected readonly formulario = signal<'alta' | UsuarioAdminDTO | null>(null);
  protected readonly enviando = signal(false);
  protected readonly errorFormulario = signal('');
  protected readonly aviso = signal('');
  protected readonly errorAccion = signal('');
  protected readonly form = new FormGroup({
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
    correo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(254)],
    }),
    rol: new FormControl<Rol>('CATEDRATICO', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  protected leer(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected filtrarRol(evento: Event): void {
    this.rol.set(this.leer(evento) as Rol | '');
  }

  protected filtrarEstado(evento: Event): void {
    this.estado.set(this.leer(evento) as EstadoUsuario | '');
  }

  protected abrirAlta(): void {
    this.limpiarMensajes();
    this.form.reset({ nombre: '', correo: '', rol: 'CATEDRATICO' });
    this.formulario.set('alta');
  }

  protected abrirEdicion(usuario: UsuarioAdminDTO): void {
    this.limpiarMensajes();
    this.form.reset({ nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol });
    this.formulario.set(usuario);
  }

  protected cerrarFormulario(): void {
    this.formulario.set(null);
    this.errorFormulario.set('');
  }

  /** Un solo "Guardar": si faltan datos los marca todos y no envía, nunca un botón gris mudo. */
  protected async guardar(): Promise<void> {
    const actual = this.formulario();
    if (!actual) return;
    // Los espacios de un pegado no deben invalidar el correo
    this.form.patchValue({
      nombre: this.form.controls.nombre.value.trim(),
      correo: this.form.controls.correo.value.trim(),
    });
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const nombre = this.form.controls.nombre.value;
    const correo = this.form.controls.correo.value;
    const rol = this.form.controls.rol.value;
    this.enviando.set(true);
    this.errorFormulario.set('');
    try {
      if (actual === 'alta') {
        await firstValueFrom(this.admin.crearUsuario({ nombre, correo, rol }));
        this.aviso.set(this.g.creada);
      } else {
        await firstValueFrom(this.admin.actualizarUsuario(actual.id, { nombre, correo, rol }));
        this.aviso.set(this.g.actualizada);
      }
      this.formulario.set(null);
      this.resultado.reload();
    } catch (error) {
      this.errorFormulario.set(mensajeHttp(error));
    } finally {
      this.enviando.set(false);
    }
  }

  protected async desbloquear(usuario: UsuarioAdminDTO): Promise<void> {
    await this.ejecutar(() => this.admin.desbloquear(usuario.id), this.g.desbloqueada);
  }

  protected async reenviar(usuario: UsuarioAdminDTO): Promise<void> {
    await this.ejecutar(() => this.admin.reenviarVerificacion(usuario.id), this.g.reenviado);
  }

  protected async activar(usuario: UsuarioAdminDTO): Promise<void> {
    await this.ejecutar(() => this.admin.activar(usuario.id), this.g.activada);
  }

  protected puedeDesbloquear(usuario: UsuarioAdminDTO): boolean {
    return usuario.estado === 'ACTIVO';
  }

  protected puedeReenviar(usuario: UsuarioAdminDTO): boolean {
    return usuario.estado === 'PENDIENTE' && !usuario.correo_verificado;
  }

  protected puedeActivar(usuario: UsuarioAdminDTO): boolean {
    return usuario.estado === 'PENDIENTE' && usuario.correo_verificado;
  }

  protected campoInvalido(campo: 'nombre' | 'correo' | 'rol'): boolean {
    return invalido(this.form.controls[campo]);
  }

  protected mensaje(campo: 'nombre' | 'correo' | 'rol'): string {
    return mensajeDeControl(this.form.controls[campo]);
  }

  private async ejecutar(operacion: () => Observable<unknown>, exito: string): Promise<void> {
    this.limpiarMensajes();
    try {
      await firstValueFrom(operacion());
      this.aviso.set(exito);
      this.resultado.reload();
    } catch (error) {
      this.errorAccion.set(mensajeHttp(error));
    }
  }

  private limpiarMensajes(): void {
    this.aviso.set('');
    this.errorAccion.set('');
    this.errorFormulario.set('');
  }
}
