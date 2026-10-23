import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';
import { AuthService } from '../../../core/auth/auth';
import { TEXTOS } from '../../../shared/textos';
import {
  CLASE_ALERTA,
  CLASE_BOTON,
  CLASE_BOTON_PELIGRO,
  CLASE_BOTON_SECUNDARIO,
  CLASE_CAMPO,
  CLASE_ENLACE,
  invalido,
  mensajeDeControl,
  mensajeHttp,
} from '../../auth/formulario';
import { AdminUsuariosService } from '../admin-usuarios';

@Component({
  selector: 'app-ficha-usuario',
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './ficha-usuario.html',
})
export class FichaUsuario {
  readonly id = input.required<string>();
  protected readonly t = TEXTOS.admin.usuarios;
  protected readonly roles = TEXTOS.auth.roles;
  protected readonly estados = TEXTOS.auth.estados;
  protected readonly claseCampo = CLASE_CAMPO;
  protected readonly claseBoton = CLASE_BOTON;
  protected readonly claseSecundario = CLASE_BOTON_SECUNDARIO;
  protected readonly clasePeligro = CLASE_BOTON_PELIGRO;
  protected readonly claseEnlace = CLASE_ENLACE;
  protected readonly claseAlerta = CLASE_ALERTA;
  protected readonly enviando = signal(false);
  protected readonly error = signal('');
  protected readonly bajaAbierta = signal(false);
  protected readonly rechazoAbierto = signal(false);
  protected readonly form = new FormGroup({
    motivo: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(1),
        Validators.maxLength(500),
        Validators.pattern(/\S/),
      ],
    }),
  });

  private readonly admin = inject(AdminUsuariosService);
  private readonly auth = inject(AuthService);
  protected readonly ficha = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.admin.detalleUsuario(params),
  });
  protected readonly errorCarga = computed(() =>
    this.ficha.error() ? mensajeHttp(this.ficha.error()) : '',
  );
  protected readonly propia = computed(() => {
    const cuenta = this.ficha.value();
    return !!cuenta && cuenta.id === this.auth.usuario()?.id;
  });
  protected readonly puedeBaja = computed(() => {
    const cuenta = this.ficha.value();
    return !!cuenta && cuenta.estado !== 'INACTIVO';
  });
  protected readonly puedeColegiado = computed(() => {
    const cuenta = this.ficha.value();
    return (
      cuenta?.rol === 'PROFESIONAL_EXTERNO' &&
      cuenta.estado === 'PENDIENTE' &&
      !!cuenta.numero_colegiado
    );
  });

  protected motivoInvalido(): boolean {
    return invalido(this.form.controls.motivo);
  }

  protected mensajeMotivo(): string {
    return mensajeDeControl(this.form.controls.motivo);
  }

  protected abrirBaja(): void {
    this.bajaAbierta.set(true);
    this.rechazoAbierto.set(false);
    this.form.reset({ motivo: '' });
  }

  protected abrirRechazo(): void {
    this.rechazoAbierto.set(true);
    this.bajaAbierta.set(false);
    this.form.reset({ motivo: '' });
  }

  protected cancelar(): void {
    this.bajaAbierta.set(false);
    this.rechazoAbierto.set(false);
    this.form.reset({ motivo: '' });
  }

  protected async confirmarBaja(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    await this.ejecutar(() => this.admin.darDeBaja(this.id(), this.form.controls.motivo.value));
    this.bajaAbierta.set(false);
  }

  protected async reactivar(): Promise<void> {
    await this.ejecutar(() => this.admin.reactivar(this.id()));
  }

  protected async aprobar(): Promise<void> {
    await this.ejecutar(() => this.admin.aprobarColegiado(this.id()));
  }

  protected async confirmarRechazo(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    await this.ejecutar(() =>
      this.admin.rechazarColegiado(this.id(), this.form.controls.motivo.value),
    );
    this.rechazoAbierto.set(false);
  }

  private async ejecutar(accion: () => Observable<void>): Promise<void> {
    this.enviando.set(true);
    this.error.set('');
    try {
      await firstValueFrom(accion());
      this.form.reset({ motivo: '' });
      this.ficha.reload();
    } catch (error) {
      this.error.set(mensajeHttp(error));
    } finally {
      this.enviando.set(false);
    }
  }
}
