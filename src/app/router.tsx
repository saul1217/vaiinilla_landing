import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { FloatingCallWaiter } from '../components/floating-call-waiter';
import { AssistantPage } from '../pages/assistant-page';
import { CUSTOMER_ASSISTANT_ENABLED } from '../lib/customer-assistant-flag';
import { TrackingPage } from '../pages/tracking-page';
import { AccountPage } from '../pages/account-page';
import { CartPage } from '../pages/cart-page';
import { ReservationsPage } from '../pages/reservations-page';
import { DiscoveryPage } from '../pages/discovery-page';
import { EmailVerificationPage, PasswordResetPage } from '../pages/email-action-page';
import { HomePage } from '../pages/home-page';
import { CartRoute, HotelPage } from '../pages/hotel-page';
import { isHotelGuestEnabled } from '../lib/hotel-routes';
import { MenuPage } from '../pages/menu-page';
import { NotFoundPage } from '../pages/not-found-page';
import { OrderDetailPage } from '../pages/order-detail-page';
import { OrdersPage } from '../pages/orders-page';
import { SupportPage } from '../pages/support-page';
import { TableJoinPage } from '../pages/table-join-page';
import { TableWhoPage } from '../pages/table-who-page';
import { WalletPage, WalletQrPage } from '../pages/wallet-page';
import { ChildAccountPage, ParentModePage } from '../pages/parent-mode-page';
import { WalletReloadPage } from '../pages/wallet-reload-page';
import { SHOW_PARENT_MODE, SHOW_WALLET_RELOAD } from '../lib/features';
import { useRouteMeta } from '../lib/use-route-meta';
import {
  AlumnoQaCartPage,
  AlumnoQaFilledCartPage,
  AlumnoQaOrderDetailPage,
  AlumnoQaOrdersPage,
  AlumnoQaTableOrderPage,
  AlumnoQaNewOrdersPage,
  AlumnoQaCourtsPage,
  AlumnoQaWalletPage,
  AlumnoQaMarketingEntryPage,
  MenuMesaQaPage,
} from '../pages/alumno-qa-page';

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export function AppRoutes({
  walletReload = SHOW_WALLET_RELOAD,
  parentMode = SHOW_PARENT_MODE,
}: { walletReload?: boolean; parentMode?: boolean } = {}) {
  useRouteMeta();
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/soporte" element={<SupportPage />} />
        <Route path="/pedir" element={<DiscoveryPage />} />
        <Route path="/e/:slug" element={<MenuPage />} />
        <Route path="/e/:slug/carrito" element={<CartRoute><CartPage /></CartRoute>} />
        {/* Huésped de hotel: solo con VITE_FEATURE_HOTEL=true; apagado, cae en la página 404. */}
        {isHotelGuestEnabled() && (
          <>
            <Route path="/e/:slug/hotel" element={<HotelPage />} />
            <Route path="/e/:slug/hotel/:view" element={<HotelPage />} />
          </>
        )}
        <Route path="/e/:slug/canchas" element={<ReservationsPage />} />
        {/* Asistente de pedidos del cliente: solo con VITE_FEATURE_ASISTENTE_CLIENTE=true. */}
        {CUSTOMER_ASSISTANT_ENABLED ? <Route path="/e/:slug/asistente" element={<AssistantPage />} /> : null}
        <Route path="/e/:slug/m/:token" element={<TableJoinPage />} />
        <Route path="/:slug/m/:token" element={<TableJoinPage />} />
        <Route path="/e/:slug/m/:token/quien" element={<TableWhoPage />} />
        <Route path="/:slug/m/:token/quien" element={<TableWhoPage />} />
        <Route path="/seguimiento/:token" element={<TrackingPage />} />
        <Route path="/cuenta" element={<AccountPage />} />
        <Route path="/acceso" element={<Navigate to="/cuenta" replace />} />
        <Route path="/acceso/verificar" element={<EmailVerificationPage />} />
        <Route path="/acceso/recuperar" element={<PasswordResetPage />} />
        <Route path="/cuenta/pedidos" element={<OrdersPage />} />
        <Route path="/cuenta/reservas" element={<Navigate to="/cuenta/pedidos" replace />} />
        <Route path="/cuenta/pedidos/:id" element={<OrderDetailPage />} />
        <Route path="/cuenta/saldo" element={<WalletPage />} />
        <Route path="/u/:id" element={<WalletQrPage />} />
        {walletReload ? <Route path="/cuenta/saldo/recargar" element={<WalletReloadPage />} /> : null}
        {parentMode ? (
          <>
            <Route path="/cuenta/hijos" element={<ParentModePage />} />
            <Route path="/cuenta/hijos/:id" element={<ChildAccountPage />} />
          </>
        ) : null}
        {import.meta.env.DEV ? (
          <>
            <Route path="/__qa/menu-mesa/*" element={<MenuMesaQaPage />} />
            <Route path="/__qa/entrada" element={<AlumnoQaMarketingEntryPage />} />
            <Route path="/__qa/carrito" element={<AlumnoQaCartPage />} />
            <Route path="/__qa/carrito-lleno" element={<AlumnoQaFilledCartPage />} />
            <Route path="/__qa/cartera" element={<AlumnoQaWalletPage />} />
            <Route path="/__qa/pedidos" element={<AlumnoQaOrdersPage />} />
            <Route path="/__qa/pedido" element={<AlumnoQaOrderDetailPage />} />
            <Route path="/__qa/pedido-mesa" element={<AlumnoQaTableOrderPage />} />
            <Route path="/__qa/pedidos-nuevos" element={<AlumnoQaNewOrdersPage />} />
            <Route path="/__qa/canchas" element={<AlumnoQaCourtsPage />} />
          </>
        ) : null}
        <Route path="/cafeterias" element={<Navigate to="/pedir" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <FloatingCallWaiter />
    </>
  );
}
