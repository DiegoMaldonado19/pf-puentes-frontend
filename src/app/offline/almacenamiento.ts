import { TEXTOS } from '../shared/textos';
export interface EstadoAlmacenamiento {
  mensaje: string;
  uso: number | null;
  cuota: number | null;
}
export async function consultarAlmacenamiento(
  solicitar = false,
  storage = navigator.storage,
): Promise<EstadoAlmacenamiento> {
  const t = TEXTOS.offline;
  if (!storage) return { mensaje: t.sinApi, uso: null, cuota: null };
  try {
    const persistente =
      solicitar && storage.persist ? await storage.persist() : await storage.persisted?.();
    const estimacion = await storage.estimate?.();
    return {
      mensaje: persistente === undefined ? t.sinApi : persistente ? t.persistente : t.noPersistente,
      uso: estimacion?.usage ?? null,
      cuota: estimacion?.quota ?? null,
    };
  } catch {
    return { mensaje: t.almacenamientoError, uso: null, cuota: null };
  }
}
export function mensajeEscritura(error: unknown): string {
  if (error instanceof Error && Object.values(TEXTOS.offline).some((t) => t === error.message))
    return error.message;
  return error instanceof Error && error.name === 'QuotaExceededError'
    ? TEXTOS.offline.cuotaError
    : TEXTOS.offline.escrituraError;
}
