import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppRouter } from './app/router';
import { AuthProvider } from './context/auth-context';
import { BuyerSessionProvider } from './context/buyer-session';
import { CartProvider } from './context/cart-context';
import './styles/global.css';
import './styles/marketing.css';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BuyerSessionProvider>
        <CartProvider>
          <AppRouter />
        </CartProvider>
      </BuyerSessionProvider>
    </AuthProvider>
  </StrictMode>,
);
