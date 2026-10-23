import { DatePipe, JsonPipe } from '@angular/common';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AccionAuditoria } from '../../../core/auth/modelos';
import { TEXTOS } from '../../../shared/textos';
import { CLASE_ALERTA, CLASE_BOTON, CLASE_CAMPO, mensajeHttp } from '../../auth/formulario';
import { AdminUsuariosService, TAMANO_PAGINA_ADMIN } from '../admin-usuarios';
import { PaginacionAdmin } from '../paginacion-admin';

const ACCIONES = Object.keys(TEXTOS.admin.auditoria.acciones) as AccionAuditoria[];

function aIso(fecha: string, fin: boolean): string | undefined {
  if (!fecha) return undefined;
  const hora = fin ? 'T23:59:59.999-06:00' : 'T00:00:00-06:00';
  const instant = new Date(`${fecha}${hora}`);
  return Number.isNaN(instant.getTime()) ? undefined : instant.toISOString();
}

@Component({
  selector: 'app-auditoria',
  imports: [DatePipe, JsonPipe, PaginacionAdmin],
  templateUrl: './auditoria.html',
})
export class Auditoria {
  protected readonly t = TEXTOS.admin.auditoria;
  protected readonly todos = TEXTOS.admin.usuarios.todos;
  protected readonly accionesTexto = TEXTOS.admin.auditoria.acciones;
  protected readonly acciones = ACCIONES;
  protected readonly claseCampo = CLASE_CAMPO;
  protected readonly claseBoton = CLASE_BOTON;
  protected readonly claseAlerta = CLASE_ALERTA;
  protected readonly entidad = signal('');
  protected readonly entidadId = signal('');
  protected readonly usuarioId = signal('');
  protected readonly accion = signal<AccionAuditoria | ''>('');
  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  protected readonly errorRango = signal('');
  protected readonly aplicados = signal({
    entidad: '',
    entidad_id: '',
    usuario_id: '',
    accion: '' as AccionAuditoria | '',
    desde: undefined as string | undefined,
    hasta: undefined as string | undefined,
  });
  protected readonly pagina = linkedSignal({ source: this.aplicados, computation: () => 0 });

  private readonly admin = inject(AdminUsuariosService);
  protected readonly resultado = rxResource({
    params: () => ({ filtros: this.aplicados(), pagina: this.pagina() }),
    stream: ({ params }) =>
      this.admin.listarAuditoria({
        ...params.filtros,
        page: params.pagina,
        size: TAMANO_PAGINA_ADMIN,
      }),
  });
  protected readonly error = computed(() =>
    this.resultado.error() ? mensajeHttp(this.resultado.error()) : this.errorRango(),
  );

  protected leer(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected filtrarAccion(evento: Event): void {
    this.accion.set(this.leer(evento) as AccionAuditoria | '');
  }

  protected etiquetaAccion(accion: string): string {
    return this.accionesTexto[accion as AccionAuditoria] ?? accion;
  }

  protected consultar(): void {
    if (this.desde() && this.hasta() && this.desde() > this.hasta()) {
      this.errorRango.set(TEXTOS.auth.errores['rango-invalido']);
      return;
    }
    this.errorRango.set('');
    this.aplicados.set({
      entidad: this.entidad().trim(),
      entidad_id: this.entidadId().trim(),
      usuario_id: this.usuarioId().trim(),
      accion: this.accion(),
      desde: aIso(this.desde(), false),
      hasta: aIso(this.hasta(), true),
    });
  }
}
