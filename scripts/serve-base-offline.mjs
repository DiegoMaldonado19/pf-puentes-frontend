import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root = resolve('dist/pf-puentes-frontend/browser');
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
};
createServer(async (request, response) => {
  const ruta = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const archivo = resolve(
    root,
    '.' + (ruta === '/' || ruta === '/offline/demo' ? '/index.html' : ruta),
  );
  if (!archivo.startsWith(root + '/')) {
    response.writeHead(403).end();
    return;
  }
  try {
    const datos = await readFile(archivo);
    response.writeHead(200, {
      'Content-Type': mime[extname(archivo)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    response.end(datos);
  } catch {
    response.writeHead(404).end();
  }
}).listen(8090, '127.0.0.1');
