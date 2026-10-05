import { ArchivoLocal, Operacion, ResultadoTransporte, TransporteSync } from '../modelos';
import { TEXTOS } from '../../shared/textos';

/** Solo se importa desde rutas sustituidas en el build de pruebas. */
export class TransporteSimulado implements TransporteSync {
  resultado: 'ack' | 'transitorio' | 'negocio' | 'sesion' = 'ack';
  demora = 0;
  readonly registro: { id: string; tipo: Operacion['tipo']; clave: string }[] = [];
  activos = 0;
  maximo_activos = 0;
  async ejecutar(
    o: Readonly<Operacion>,
    _archivo: ArchivoLocal | undefined,
    signal: AbortSignal,
  ): Promise<ResultadoTransporte> {
    this.activos++;
    this.maximo_activos = Math.max(this.maximo_activos, this.activos);
    this.registro.push({ id: o.id, tipo: o.tipo, clave: o.clave });
    try {
      if (this.demora)
        await new Promise<void>((resolve, reject) => {
          const cancelar = () => {
            clearTimeout(timer);
            reject(new DOMException('Abort', 'AbortError'));
          };
          const timer = setTimeout(() => {
            signal.removeEventListener('abort', cancelar);
            resolve();
          }, this.demora);
          signal.addEventListener('abort', cancelar, { once: true });
          if (signal.aborted) cancelar();
        });
      if (signal.aborted) throw new DOMException('Abort', 'AbortError');
      return this.resultado === 'ack'
        ? {
            tipo: 'ack',
            propietario_id: o.propietario_id,
            operacion_id: o.id,
            version_local: o.version_local,
            resultado: { simulado: true },
          }
        : { tipo: this.resultado, mensaje: TEXTOS.offline[this.resultado] };
    } finally {
      this.activos--;
    }
  }
}
