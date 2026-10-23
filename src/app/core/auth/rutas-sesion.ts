/** Rutas Angular que piden sesión: perfil, admin y las privadas de P3. */
export function rutaExigeSesion(url: string): boolean {
  const path = url.split('?')[0];
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
  return /^\/puentes\/[^/]+\/editar$/.test(path);
}
