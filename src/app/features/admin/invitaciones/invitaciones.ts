import { DatePipe } from '@angular/common';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { EstadoInvitacion, InvitacionDTO, RolInvitable } from '../../../core/auth/modelos';
import { TEXTOS } from '../../../shared/textos';
import {
  aplicarErroresDeCampo,
  CLASE_ALERTA,
  CLASE_BOTON,
  CLASE_BOTON_PELIGRO,
  CLASE_CAMPO,
  CLASE_HECHO,
  controlCorreo,
  invalido,
  mensajeDeControl,
  mensajeHttp,
} from '../../auth/formulario';
import { AdminUsuariosService, TAMANO_PAGINA_ADMIN } from '../admin-usuarios';
import { PaginacionAdmin } from '../paginacion-admin';

const ROLES_INVITABLES: readonly RolInvitable[] = [
  'PROFESIONAL_EXTERNO',
  'CATEDRATICO',
  'ADMINISTRADOR',
];

const ESTADOS: readonly EstadoInvitacion[] = ['ABIERTA', 'ACEPTADA', 'REVOCADA', 'VENCIDA'];

@Component({
  selector: 'app-invitaciones',
  imports: [DatePipe, PaginacionAdmin, ReactiveFormsModule],
  templateUrl: './invitaciones.html',
})
export class Invitaciones {
  protected readonly t = TEXTOS.admin.invitaciones;
  protected readonly roles = TEXTOS.auth.roles;
  protected readonly rolesInvitables = ROLES_INVITABLES;
  protected readonly estados = ESTADOS;
  protected readonly claseCampo = CLASE_CAMPO;
  protected readonly claseBoton = CLASE_BOTON;
  protected readonly clasePeligro = CLASE_BOTON_PELIGRO;
  protected readonly claseAlerta = CLASE_ALERTA;
  protected readonly claseHecho = CLASE_HECHO;
  protected readonly estado = signal<EstadoInvitacion | ''>('');
  protected readonly pagina = linkedSignal({ source: this.estado, computation: () => 0 });
  protected readonly enviando = signal(false);
  protected readonly error = signal('');
  protected readonly hecho = signal(false);
  protected readonly form = new FormGroup({
    correo: controlCorreo(),
    rol: new FormControl<RolInvitable>('CATEDRATICO', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  private readonly admin = inject(AdminUsuariosService);
  protected readonly resultado = rxResource({
    params: () => ({ estado: this.estado(), pagina: this.pagina() }),
    stream: ({ params }) =>
      this.admin.listarInvitaciones({
        estado: params.estado,
        page: params.pagina,
        size: TAMANO_PAGINA_ADMIN,
      }),
  });
  protected readonly errorLista = computed(() =>
    this.resultado.error() ? mensajeHttp(this.resultado.error()) : '',
  );

  protected leer(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected filtrarEstado(evento: Event): void {
    this.estado.set(this.leer(evento) as EstadoInvitacion | '');
  }

  protected campoInvalido(nombre: 'correo' | 'rol'): boolean {
    return invalido(this.form.controls[nombre]);
  }

  protected mensaje(nombre: 'correo' | 'rol'): string {
    return mensajeDeControl(this.form.controls[nombre]);
  }

  protected async enviar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.error.set('');
    this.hecho.set(false);
    try {
      await firstValueFrom(
        this.admin.crearInvitacion(this.form.controls.correo.value, this.form.controls.rol.value),
      );
      this.hecho.set(true);
      this.form.reset({ correo: '', rol: 'CATEDRATICO' });
      this.resultado.reload();
    } catch (error) {
      this.error.set(mensajeHttp(error));
      aplicarErroresDeCampo(this.form, error);
    } finally {
      this.enviando.set(false);
    }
  }

  protected async revocar(invitacion: InvitacionDTO): Promise<void> {
    if (invitacion.estado !== 'ABIERTA') return;
    if (!confirm(this.t.confirmarRevocar)) return;
    this.error.set('');
    try {
      await firstValueFrom(this.admin.revocarInvitacion(invitacion.id));
      this.resultado.reload();
    } catch (error) {
      this.error.set(mensajeHttp(error));
    }
  }
}
