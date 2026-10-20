/** yyyy-MM-dd → dd/MM/yyyy sin convertir zona: es una fecha sin hora (DT-FE-12). */
export function fechaSinHora(fecha: string | null): string | null {
  const partes = fecha?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : null;
}
