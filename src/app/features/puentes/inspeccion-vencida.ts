/**
 * Más de 12 meses desde la última inspección publicada. La fecha llega como AAAA-MM-DD (LocalDate),
 * así que se interpreta en la hora local para no desplazar el día. Sin fecha no hay banner: el
 * puente nunca se ha inspeccionado y la ficha ya lo indica.
 */
export function sinInspeccionDesde12Meses(
  fechaUltimaInspeccion: string | null | undefined,
  ahora: Date = new Date(),
): boolean {
  if (!fechaUltimaInspeccion) return false;
  const ultima = new Date(`${fechaUltimaInspeccion.slice(0, 10)}T00:00:00`);
  const limite = new Date(ahora);
  limite.setMonth(limite.getMonth() - 12);
  return ultima.getTime() < limite.getTime();
}
