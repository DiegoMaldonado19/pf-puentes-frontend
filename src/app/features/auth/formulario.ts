import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MENSAJE_POLITICA_CONTRASENA, contrasenaValida } from '../../core/auth/politica-contrasena';
import { mensajeAdjuntado } from '../../core/errores/errores.interceptor';
import { erroresDeCampo, mensajeDeProblema } from '../../core/errores/problema';
import { TEXTOS } from '../../shared/textos';

export const CLASE_CAMPO = 'hvc-input';
export const CLASE_BOTON = 'btn-hvc-primary';
export const CLASE_ENLACE = 'hvc-link';
export const CLASE_ALERTA = 'hvc-alert';
export const CLASE_HECHO = 'hvc-alert hvc-alert--ok';
export const CLASE_BOTON_SECUNDARIO = 'btn-hvc-secondary';
export const CLASE_BOTON_PELIGRO = 'btn-hvc-danger';

export function controlCorreo(): FormControl<string> {
  return new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.email, Validators.maxLength(254)],
  });
}

export function controlNombre(): FormControl<string> {
  return new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(150), Validators.pattern(/\S/)],
  });
}

export function controlContrasena(conPolitica: boolean): FormControl<string> {
  return new FormControl('', {
    nonNullable: true,
    validators: conPolitica
      ? [Validators.required, validadorPoliticaContrasena]
      : [Validators.required],
  });
}

export function controlConfirmar(): FormControl<string> {
  return new FormControl('', { nonNullable: true, validators: [Validators.required] });
}

export function validadorPoliticaContrasena(control: AbstractControl): ValidationErrors | null {
  const valor = String(control.value ?? '');
  if (!valor) return null;
  return contrasenaValida(valor) ? null : { politica: true };
}

export function coincidenContrasenas(grupo: AbstractControl): ValidationErrors | null {
  return coincidenCon('contrasena')(grupo);
}

export function coincidenCon(campo: string) {
  return (grupo: AbstractControl): ValidationErrors | null => {
    const contrasena = grupo.get(campo)?.value;
    const confirmar = grupo.get('confirmar')?.value;
    if (!contrasena || !confirmar) return null;
    return contrasena === confirmar ? null : { confirmarDistinta: true };
  };
}

export function mensajeHttp(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    return mensajeAdjuntado.get(error) ?? mensajeDeProblema(error);
  }
  return TEXTOS.auth.errores.inesperado;
}

export function aplicarErroresDeCampo(form: FormGroup, error: unknown): void {
  for (const item of erroresDeCampo(error)) {
    const control = form.get(item.campo);
    if (control) {
      control.setErrors({ ...(control.errors ?? {}), servidor: item.mensaje });
      control.markAsTouched();
    }
  }
}

export function invalido(control: AbstractControl | null): boolean {
  return !!control && control.invalid && (control.touched || control.dirty);
}

export function mensajeDeControl(
  control: AbstractControl | null,
  grupo?: AbstractControl | null,
): string {
  if (!control) return '';
  if (control.hasError('servidor')) return String(control.getError('servidor'));
  if (control.hasError('required') || control.hasError('pattern')) {
    return TEXTOS.auth.errores.obligatorio;
  }
  if (control.hasError('email')) return TEXTOS.auth.errores.correoInvalido;
  if (control.hasError('politica')) return MENSAJE_POLITICA_CONTRASENA;
  if (control.hasError('maxlength')) return TEXTOS.auth.errores.obligatorio;
  if (grupo?.hasError('confirmarDistinta') && (control.touched || control.dirty)) {
    return TEXTOS.auth.errores.confirmarDistinta;
  }
  return '';
}
