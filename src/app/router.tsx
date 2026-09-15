import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AccountPage } from '../pages/account-page';
import { CartPage } from '../pages/cart-page';
import { DiscoveryPage } from '../pages/discovery-page';
import { HomePage } from '../pages/home-page';
import { MenuPage } from '../pages/menu-page';
import { NotFoundPage } from '../pages/not-found-page';
import { OrderDetailPage } from '../pages/order-detail-page';
import { OrdersPage } from '../pages/orders-page';
import { SupportPage } from '../pages/support-page';
import { TableJoinPage } from '../pages/table-join-page';
import { WalletPage, WalletQrPage } from '../pages/wallet-page';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/soporte" element={<SupportPage />} />
        <Route path="/pedir" element={<DiscoveryPage />} />
        <Route path="/e/:slug" element={<MenuPage />} />
        <Route path="/e/:slug/carrito" element={<CartPage />} />
        <Route path="/e/:slug/m/:token" element={<TableJoinPage />} />
        <Route path="/:slug/m/:token" element={<TableJoinPage />} />
        <Route path="/cuenta" element={<AccountPage />} />
        <Route path="/cuenta/pedidos" element={<OrdersPage />} />
        <Route path="/cuenta/pedidos/:id" element={<OrderDetailPage />} />
        <Route path="/cuenta/saldo" element={<WalletPage />} />
        <Route path="/u/:id" element={<WalletQrPage />} />
        <Route path="/cafeterias" element={<Navigate to="/pedir" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
