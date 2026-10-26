import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AceptarInvitacionDTO, InvitacionPublicaDTO } from '../../core/auth/modelos';
import { TEXTOS } from '../../shared/textos';
import { CuentaService } from './cuenta';
import {
  aplicarErroresDeCampo,
  CLASE_ALERTA,
  CLASE_BOTON,
  CLASE_CAMPO,
  CLASE_ENLACE,
  CLASE_HECHO,
  coincidenContrasenas,
  controlConfirmar,
  controlContrasena,
  controlNombre,
  invalido,
  mensajeDeControl,
  mensajeHttp,
} from './formulario';

@Component({
  selector: 'app-aceptar-invitacion',
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './aceptar-invitacion.html',
})
export class AceptarInvitacion {
  protected readonly t = TEXTOS.auth.invitacion;
  protected readonly irALogin = TEXTOS.auth.verificar.irALogin;
  protected readonly campos = TEXTOS.auth.campos;
  protected readonly roles = TEXTOS.auth.roles;
  protected readonly claseCampo = CLASE_CAMPO;
  protected readonly claseBoton = CLASE_BOTON;
  protected readonly claseEnlace = CLASE_ENLACE;
  protected readonly claseAlerta = CLASE_ALERTA;
  protected readonly claseHecho = CLASE_HECHO;
  protected readonly consultando = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal('');
  protected readonly invitacion = signal<InvitacionPublicaDTO | null>(null);
  protected readonly cuentaActiva = signal(false);
  protected readonly cuentaPendiente = signal(false);
  protected readonly form = new FormGroup(
    {
      nombre: controlNombre(),
      contrasena: controlContrasena(true),
      confirmar: controlConfirmar(),
      numero_colegiado: new FormControl('', { nonNullable: true }),
    },
    { validators: coincidenContrasenas },
  );

  private readonly cuenta = inject(CuentaService);
  private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token')?.trim() ?? '';

  constructor() {
    if (!this.token) {
      this.error.set(this.t.faltaToken);
      return;
    }
    this.consultando.set(true);
    this.cuenta
      .consultarInvitacion(this.token)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (invitacion) => {
          this.invitacion.set(invitacion);
          this.ajustarColegiado(invitacion.rol === 'PROFESIONAL_EXTERNO');
          this.consultando.set(false);
        },
        error: (error: unknown) => {
          this.error.set(mensajeHttp(error));
          this.consultando.set(false);
        },
      });
  }

  protected esProfesional(): boolean {
    return this.invitacion()?.rol === 'PROFESIONAL_EXTERNO';
  }

  protected campoInvalido(
    nombre: 'nombre' | 'contrasena' | 'confirmar' | 'numero_colegiado',
  ): boolean {
    const control = this.form.controls[nombre];
    if (nombre === 'confirmar' && this.form.hasError('confirmarDistinta')) {
      return control.touched || control.dirty;
    }
    return invalido(control);
  }

  protected mensaje(nombre: 'nombre' | 'contrasena' | 'confirmar' | 'numero_colegiado'): string {
    return mensajeDeControl(
      this.form.controls[nombre],
      nombre === 'confirmar' ? this.form : undefined,
    );
  }

  protected async enviar(): Promise<void> {
    if (this.form.invalid || !this.token) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.error.set('');
    const cuerpo: AceptarInvitacionDTO = this.esProfesional()
      ? {
          token: this.token,
          nombre: this.form.controls.nombre.value.trim(),
          contrasena: this.form.controls.contrasena.value,
          numero_colegiado: this.form.controls.numero_colegiado.value.trim(),
        }
      : {
          token: this.token,
          nombre: this.form.controls.nombre.value.trim(),
          contrasena: this.form.controls.contrasena.value,
        };
    try {
      const creada = await firstValueFrom(this.cuenta.aceptarInvitacion(cuerpo));
      if (creada.estado === 'ACTIVO') this.cuentaActiva.set(true);
      else this.cuentaPendiente.set(true);
    } catch (error) {
      this.error.set(mensajeHttp(error));
      aplicarErroresDeCampo(this.form, error);
    } finally {
      this.enviando.set(false);
    }
  }

  private ajustarColegiado(obligatorio: boolean): void {
    const control = this.form.controls.numero_colegiado;
    control.setValidators(obligatorio ? [Validators.required, Validators.maxLength(20)] : []);
    control.updateValueAndValidity();
  }
}
