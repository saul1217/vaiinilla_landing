import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppRouter } from './app/router';
import { AuthProvider } from './context/auth-context';
import { BuyerSessionProvider } from './context/buyer-session';
import { CartProvider } from './context/cart-context';
import { ThemeProvider } from './context/theme-context';
import './styles/global.css';
import './styles/marketing.css';
import './styles/app.css';
import './styles/alumno.css';

// iOS Safari only applies :active (our press feedback) when a touch listener exists.
document.addEventListener('touchstart', () => undefined, { passive: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <BuyerSessionProvider>
          <CartProvider>
            <AppRouter />
          </CartProvider>
        </BuyerSessionProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
