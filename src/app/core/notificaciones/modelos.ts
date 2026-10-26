export interface Notificacion {
  id: string;
  tipo: string;
  mensaje: string;
  enlace: string | null;
  creado_en: string;
  leida_en: string | null;
}

export interface PaginaNotificaciones {
  contenido: Notificacion[];
  pagina: number;
  tamano: number;
  total_elementos: number;
  total_paginas: number;
}

export interface ConteoNoLeidas {
  total: number;
}
