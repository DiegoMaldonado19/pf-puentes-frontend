import { createServer, request as proxyRequest } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

const backend = new URL(process.env['P8_BACKEND_URL'] ?? 'http://invalid');
if (
  process.env['P8_RECORRIDO_AISLADO'] !== '1' ||
  backend.hostname !== '127.0.0.1' ||
  backend.protocol !== 'http:' ||
  !backend.port ||
  backend.port === '8080'
) {
  throw new Error('Solo se admite el backend temporal creado por RecorridoP8Navegador.');
}
const root = resolve('dist/pf-puentes-frontend/browser');
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

createServer(async (request, response) => {
  if (request.url?.startsWith('/api/')) {
    const upstream = proxyRequest(
      new URL(request.url, backend),
      {
        method: request.method,
        headers: { ...request.headers, host: backend.host },
      },
      (result) => {
        response.writeHead(result.statusCode ?? 502, result.headers);
        result.pipe(response);
      },
    );
    upstream.on('error', () => response.writeHead(502).end());
    request.pipe(upstream);
    return;
  }
  try {
    const ruta = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    const archivo = resolve(root, '.' + (extname(ruta) ? ruta : '/index.html'));
    if (!archivo.startsWith(root + '/')) {
      response.writeHead(403).end();
      return;
    }
    const datos = await readFile(archivo);
    response.writeHead(200, {
      'Content-Type': mime[extname(archivo)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(datos);
  } catch {
    response.writeHead(404).end();
  }
}).listen(8093, '127.0.0.1');
