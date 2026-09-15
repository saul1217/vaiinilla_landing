import { FirebaseError, getApp, getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  getMultiFactorResolver,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  TotpMultiFactorGenerator,
  updateProfile,
  type Auth,
  type MultiFactorError,
  type MultiFactorResolver,
  type User,
} from 'firebase/auth';
import { beginBrowserSession, endBrowserSession, hasBrowserSession } from './browser-session';
import { isFirebaseConfigReady, resolveFirebaseConfig } from './env';

const hostname = typeof window === 'undefined' ? '' : window.location.hostname;
const firebaseConfig = resolveFirebaseConfig(
  {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  },
  hostname,
);

export const firebaseConfigured = isFirebaseConfigReady(firebaseConfig);

let authInstance: Auth | null = null;
let persistenceReady: Promise<void> | null = null;

function getConfiguredAuth(): Auth {
  if (!firebaseConfigured) {
    throw new Error('Falta configurar Firebase en las variables VITE_FIREBASE_* del proyecto.');
  }
  if (!authInstance) {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    authInstance = getAuth(app);
    persistenceReady = setPersistence(authInstance, browserLocalPersistence);
  }
  return authInstance;
}

export async function readyAuth(): Promise<Auth> {
  const auth = getConfiguredAuth();
  await persistenceReady;
  return auth;
}

export function observeAuth(callback: (user: User | null) => void): () => void {
  if (!firebaseConfigured) {
    callback(null);
    return () => undefined;
  }
  const auth = getConfiguredAuth();
  return onAuthStateChanged(auth, callback);
}

export interface PasswordSignInResult {
  user?: User;
  mfaResolver?: MultiFactorResolver;
}

export async function passwordSignIn(
  email: string,
  password: string,
): Promise<PasswordSignInResult> {
  const auth = await readyAuth();
  const hadBrowserSession = hasBrowserSession();
  beginBrowserSession();
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return { user: credential.user };
  } catch (error) {
    if (error instanceof FirebaseError && error.code === 'auth/multi-factor-auth-required') {
      return { mfaResolver: getMultiFactorResolver(auth, error as MultiFactorError) };
    }
    if (!hadBrowserSession) endBrowserSession();
    throw error;
  }
}

export async function completeTotpSignIn(
  resolver: MultiFactorResolver,
  verificationCode: string,
): Promise<User> {
  beginBrowserSession();
  const totpHint = resolver.hints.find(
    (hint) => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID,
  );
  if (!totpHint) throw new Error('La cuenta no tiene un factor TOTP compatible.');
  const assertion = TotpMultiFactorGenerator.assertionForSignIn(totpHint.uid, verificationCode);
  return (await resolver.resolveSignIn(assertion)).user;
}

export async function createPasswordAccount(
  email: string,
  password: string,
  displayName: string,
): Promise<User> {
  const auth = await readyAuth();
  if (auth.currentUser) {
    endBrowserSession();
    await signOut(auth);
  }
  beginBrowserSession();
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: displayName.trim() });
    return credential.user;
  } catch (error) {
    endBrowserSession();
    throw error;
  }
}

export async function firebaseIdToken(user: User): Promise<string> {
  return user.getIdToken();
}

export async function firebaseSignOut(): Promise<void> {
  endBrowserSession();
  if (!firebaseConfigured) return;
  const auth = await readyAuth();
  await signOut(auth);
}
