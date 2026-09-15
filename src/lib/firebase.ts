import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';
import { beginBrowserSession, endBrowserSession, hasBrowserSession } from './browser-session';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
);

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

export async function passwordSignIn(email: string, password: string): Promise<User> {
  const auth = await readyAuth();
  beginBrowserSession();
  try {
    return (await signInWithEmailAndPassword(auth, email, password)).user;
  } catch (error) {
    if (!hasBrowserSession()) endBrowserSession();
    throw error;
  }
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
