// API simulada de la tienda de CI para medir Lighthouse en local sin tocar development.
// Sirve /api/v1/publico/... con ci-vaiinilla y fotos de public/assets. Uso:
//   node docs/evidencia/pr160/api-simulada.mjs <puerto>
//   E2E_API_ORIGIN=http://127.0.0.1:<puerto> npx vite preview --host 127.0.0.1 --port <otro>
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const port = Number(process.argv[2] ?? 47000);
const origin = `http://127.0.0.1:${port}`;
const place = {
  id: '00000000-0000-4000-8000-000000000001', nombre: 'ci-vaiinilla (pruebas automáticas)', slug: 'ci-vaiinilla',
  identificador_cliente_etiqueta: 'Nombre', identificador_cliente_obligatorio: false, tipo: 'restaurante',
  descripcion: 'Tienda de CI', imagen_url: null, acepta_tarjeta: true, permite_saldo: true,
};
const product = (id, nombre, precio, foto) => ({
  id, categoria_id: 1, estacion_preparacion: 'cocina', nombre, descripcion: null, ingredientes: null, alergenos: null,
  tiempo_estimado_min: 10, precio_mostrador: precio, precio_digital: precio, disponible: true,
  imagen_url: `${origin}/fotos/${foto}`, grupos_opcion: [],
});
const routes = {
  '/api/v1/publico/establecimientos': { data: [place], meta: { cursor: null }, error: null },
  '/api/v1/publico/establecimientos/ci-vaiinilla': { data: place, meta: {}, error: null },
  '/api/v1/publico/establecimientos/ci-vaiinilla/catalogo': {
    data: {
      categorias: [{ id: 1, nombre: 'CI Comida', orden: 1 }],
      productos: [product(1, 'CI Tacos de prueba', '85.00', 'vaini-tacos.jpg'), product(2, 'CI Bebida de prueba', '40.00', 'vaini-oxxo.jpg')],
    },
    meta: {}, error: null,
  },
};

createServer((req, res) => {
  const path = new URL(req.url, origin).pathname;
  if (path.startsWith('/fotos/')) {
    try {
      const body = readFileSync(new URL(`../../../public/assets/${path.slice(7).replace(/[^\w.-]/g, '')}`, import.meta.url));
      res.writeHead(200, { 'content-type': 'image/jpeg', 'access-control-allow-origin': '*' });
      return res.end(body);
    } catch {
      res.writeHead(404); return res.end();
    }
  }
  const json = routes[path];
  res.writeHead(json ? 200 : 404, { 'content-type': 'application/json' });
  res.end(JSON.stringify(json ?? { data: null, meta: {}, error: { codigo: 'NO_ENCONTRADO', mensaje: 'Simulado' } }));
}).listen(port, '127.0.0.1', () => console.log(`API simulada en ${origin}`));
