import { v7 } from 'uuid';

/** Misma clave que usa la cola offline (offline/transporte-http.ts): un id por instalación. */
const CLAVE_DISPOSITIVO = 'sgp.dispositivo';
const ZONA = 'America/Guatemala';
const LIMITE_IDEMPOTENCIA = 100;

/** DT-OFF-05: el UUID v7 se genera en el cliente antes de cualquier llamada. Nunca `randomUUID()` (v4). */
export function nuevoId(): string {
  return v7();
}

/** Clave por intento de operación; se reutiliza solo para reintentos del mismo cuerpo. */
export function nuevaClave(): string {
  return recortarClave(v7());
}

export function recortarClave(clave: string): string {
  return Array.from(clave.trim()).slice(0, LIMITE_IDEMPOTENCIA).join('');
}

export function idDispositivo(): string {
  try {
    let id = localStorage.getItem(CLAVE_DISPOSITIVO);
    if (!id) {
      id = v7();
      localStorage.setItem(CLAVE_DISPOSITIVO, id);
    }
    return id;
  } catch {
    // Sin localStorage (modo privado): un id efímero igualmente cumple el contrato (1–100).
    return (idEfimero ??= v7());
  }
}

let idEfimero: string | null = null;

/** Día de calendario de Guatemala (yyyy-MM-dd): a las 19:00 no pasa al día siguiente en UTC. */
export function hoyGuatemala(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(ahora);
}

/** GPS del dispositivo; si lo niega o falla, la inspección se inicia igual (RN-INS-12, D10). */
export function ubicacionActual(): Promise<{ latitud: number; longitud: number } | null> {
  return new Promise((resolver) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolver(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (posicion) =>
        resolver({ latitud: posicion.coords.latitude, longitud: posicion.coords.longitude }),
      () => resolver(null),
      { enableHighAccuracy: true, timeout: 8_000, maximumAge: 30_000 },
    );
  });
}
