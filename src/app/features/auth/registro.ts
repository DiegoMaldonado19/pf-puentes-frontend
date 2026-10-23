import { Component, inject, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
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
  controlCorreo,
  controlNombre,
  invalido,
  mensajeDeControl,
  mensajeHttp,
} from './formulario';

@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './registro.html',
})
export class Registro {
  protected readonly t = TEXTOS.auth.registro;
  protected readonly verificar = TEXTOS.auth.verificar;
  protected readonly campos = TEXTOS.auth.campos;
  protected readonly claseCampo = CLASE_CAMPO;
  protected readonly claseBoton = CLASE_BOTON;
  protected readonly claseEnlace = CLASE_ENLACE;
  protected readonly claseAlerta = CLASE_ALERTA;
  protected readonly claseHecho = CLASE_HECHO;
  protected readonly enviando = signal(false);
  protected readonly reenviando = signal(false);
  protected readonly error = signal('');
  protected readonly hecho = signal(false);
  protected readonly reenviado = signal(false);
  protected readonly form = new FormGroup(
    {
      nombre: controlNombre(),
      correo: controlCorreo(),
      contrasena: controlContrasena(true),
      confirmar: controlConfirmar(),
    },
    { validators: coincidenContrasenas },
  );

  private readonly cuenta = inject(CuentaService);

  protected campoInvalido(nombre: 'nombre' | 'correo' | 'contrasena' | 'confirmar'): boolean {
    const control = this.form.controls[nombre];
    if (nombre === 'confirmar' && this.form.hasError('confirmarDistinta')) {
      return control.touched || control.dirty;
    }
    return invalido(control);
  }

  protected mensaje(nombre: 'nombre' | 'correo' | 'contrasena' | 'confirmar'): string {
    return mensajeDeControl(
      this.form.controls[nombre],
      nombre === 'confirmar' ? this.form : undefined,
    );
  }

  protected async enviar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.error.set('');
    try {
      await firstValueFrom(
        this.cuenta.registrar(
          this.form.controls.nombre.value,
          this.form.controls.correo.value,
          this.form.controls.contrasena.value,
        ),
      );
      this.hecho.set(true);
    } catch (error) {
      this.error.set(mensajeHttp(error));
      aplicarErroresDeCampo(this.form, error);
    } finally {
      this.enviando.set(false);
    }
  }

  protected async reenviar(): Promise<void> {
    this.reenviando.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.cuenta.reenviarVerificacion(this.form.controls.correo.value));
      this.reenviado.set(true);
    } catch (error) {
      this.error.set(mensajeHttp(error));
    } finally {
      this.reenviando.set(false);
    }
  }
}
