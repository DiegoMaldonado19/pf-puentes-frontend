/** Rutas Angular que requieren una sesión remota. */
export function rutaExigeSesion(url: string): boolean {
  const path = url.split('?')[0];
  if (path === '/mis-revisiones' || path.startsWith('/historial-revisiones/')) return true;
  if (path === '/revisiones' || path.startsWith('/revisiones/')) return true;
  if (path === '/perfil' || path.startsWith('/perfil/') || path.startsWith('/admin')) {
    return true;
  }
  if (
    path === '/puentes/nuevo' ||
    path === '/puentes/solicitudes' ||
    path === '/puentes/solicitudes/nueva'
  ) {
    return true;
  }
  return /^\/puentes\/[^/]+\/(editar|mantenimiento)$/.test(path);
}
