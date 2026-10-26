/** RN-USR-06: el backend rechaza igual; el mensaje debe coincidir. */
export const MENSAJE_POLITICA_CONTRASENA =
  'No cumple la política: mínimo 10 caracteres, con al menos una letra y un dígito';

const MAXIMO_BYTES = 72;

export function contrasenaValida(valor: string): boolean {
  return (
    valor.length >= 10 &&
    new TextEncoder().encode(valor).length <= MAXIMO_BYTES &&
    /\p{L}/u.test(valor) &&
    /\d/.test(valor)
  );
}
