/** Rutas Angular que piden sesión. P3 se suma en la fase del layout. */
export function rutaExigeSesion(url: string): boolean {
  const path = url.split('?')[0];
  return path === '/perfil' || path.startsWith('/perfil/') || path.startsWith('/admin');
}
