import { AbstractControl } from '@angular/forms';

/**
 * Patrón de envío único (B7): al enviar, cada campo se marca para que muestre su error y el foco
 * va al primero que no cumple. Un formulario inválido nunca se envía en silencio ni queda con un
 * botón deshabilitado sin explicación. Devuelve true si el control puede enviarse.
 */
export function validarAlEnviar(control: AbstractControl): boolean {
  if (control.valid) return true;
  control.markAllAsTouched();
  // Los atributos aria-invalid los pinta Angular tras el ciclo de detección: se enfoca después
  setTimeout(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
  return false;
}
