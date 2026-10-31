import { useState, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { FloatingCallWaiter } from '../components/floating-call-waiter';
import { ThemeProvider } from '../context/theme-context';
import type { BuyerCallClient, TableCall } from '../lib/mesero-api';
import type { CatalogProduct, OrderDetail, PublicEstablishment } from '../types/api';
import { MenuPage } from './menu-page';

const place: PublicEstablishment = { id: 'qa', nombre: 'Cafetería de prueba', slug: 'menu-mesa-qa', identificador_cliente_etiqueta: 'Matrícula', identificador_cliente_obligatorio: false };
const product = (id: number, nombre: string, precio: string, imagen_url: string | null): CatalogProduct => ({ id, categoria_id: 1, estacion_preparacion: 'cocina', nombre, descripcion: null, ingredientes: null, alergenos: null, tiempo_estimado_min: 8, precio_mostrador: precio, precio_digital: precio, disponible: true, imagen_url, grupos_opcion: [] });
const catalog = { categorias: [{ id: 1, nombre: 'Favoritos', orden: 1 }], productos: [product(1, 'Tacos de prueba', '85.00', '/assets/vaini-tacos.jpg'), product(2, 'Bowl de prueba', '110.00', '/assets/vaini-camion.jpg'), product(3, 'Agua fresca', '35.00', null)] };
const order: OrderDetail = { id: 'qa-order', folio: 505, fecha_operativa: '2026-10-31', estado: 'preparando', metodo_pago: 'efectivo', destino: 'en_espacio', espacio: { id: 5, nombre: 'Mesa 5', tipo: 'mesa' }, subtotal: '85.00', ahorro_combinado: '0.00', cashback_otorgado: '0.00', total: '85.00', version: 1, creado_en: new Date().toISOString(), actualizado_en: new Date().toISOString(), notas_cocina: null, usuario: { nombre: 'María Prueba', matricula: null }, items: [{ id: 1, producto_id: 1, nombre_producto: 'Tacos de prueba', estacion_preparacion: 'cocina', cantidad: 1, precio_digital_unitario: '85.00', subtotal: '85.00', opciones: [] }] };
const qaCallClient: BuyerCallClient = { current: () => Promise.resolve(null), call: () => Promise.reject(new Error('QA')), cancel: (call: TableCall) => Promise.resolve(call) };
function QaFrame({ children }: { children: ReactNode }) { return <ThemeProvider>{children}</ThemeProvider>; }

export function MenuMesaQaPage() {
  const [ready] = useState(() => {
    if (import.meta.env.DEV) localStorage.setItem('vaiinilla.buyer.space.v1', JSON.stringify({ slug: place.slug, espacioId: 5, nombre: 'Mesa 5', tipo: 'mesa', guardadoEn: Date.now() }));
    return true;
  });
  if (!import.meta.env.DEV || !ready) return null;
  return <Routes location={`/__qa/menu-mesa/e/${place.slug}`}><Route path="e/:slug" element={<QaFrame><MenuPage qaFixture={{ user: { displayName: 'María Prueba', email: 'maria@example.test' }, place, catalog, order }} /><FloatingCallWaiter client={qaCallClient} /></QaFrame>} /></Routes>;
}
