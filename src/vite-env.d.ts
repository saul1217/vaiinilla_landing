/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV?: 'development' | 'production';
  readonly VITE_API_URL?: string;
  readonly VITE_APP_URL?: string;
  readonly VITE_STAFF_APP_URL?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_AUTH_EMULATOR_URL?: string;
  readonly VITE_ALLOW_UNPUBLISHED_LEGAL_TESTING?: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_FEATURE_HOTEL?: string;
  /** `true` prende las reservas de boliche del cliente (pistas y jugadores). Apagada por defecto. */
  readonly VITE_FEATURE_RESERVAS_BOLICHE?: string;
  readonly VITE_FEATURE_CARTERA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
