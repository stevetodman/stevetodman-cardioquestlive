import { initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, type Functions, connectFunctionsEmulator } from "firebase/functions";
import {
  getAuth,
  signInAnonymously,
  type Auth,
  connectAuthEmulator,
} from "firebase/auth";

function envValue(key: string): string | undefined {
  const raw =
    (typeof import.meta !== "undefined" &&
      (import.meta as any).env &&
      (import.meta as any).env[key]) ??
    process.env[key];
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalize(value: string | undefined, placeholder: string): string | undefined {
  if (!value) return undefined;
  if (value === placeholder) return undefined;
  if (/^YOUR_/i.test(value)) return undefined;
  return value;
}

const placeholderConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_FIREBASE_PROJECT.firebaseapp.com",
  projectId: "YOUR_FIREBASE_PROJECT",
  storageBucket: "YOUR_FIREBASE_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID",
};

const envConfig = {
  apiKey: normalize(envValue("VITE_FIREBASE_API_KEY"), placeholderConfig.apiKey),
  authDomain: normalize(envValue("VITE_FIREBASE_AUTH_DOMAIN"), placeholderConfig.authDomain),
  projectId: normalize(envValue("VITE_FIREBASE_PROJECT_ID"), placeholderConfig.projectId),
  storageBucket: normalize(envValue("VITE_FIREBASE_STORAGE_BUCKET"), placeholderConfig.storageBucket),
  messagingSenderId: normalize(envValue("VITE_FIREBASE_MESSAGING_SENDER_ID"), placeholderConfig.messagingSenderId),
  appId: normalize(envValue("VITE_FIREBASE_APP_ID"), placeholderConfig.appId),
  measurementId: normalize(envValue("VITE_FIREBASE_MEASUREMENT_ID"), placeholderConfig.measurementId),
};

const firebaseConfig = {
  apiKey: envConfig.apiKey ?? placeholderConfig.apiKey,
  authDomain: envConfig.authDomain ?? placeholderConfig.authDomain,
  projectId: envConfig.projectId ?? placeholderConfig.projectId,
  storageBucket: envConfig.storageBucket ?? placeholderConfig.storageBucket,
  messagingSenderId: envConfig.messagingSenderId ?? placeholderConfig.messagingSenderId,
  appId: envConfig.appId ?? placeholderConfig.appId,
  measurementId: envConfig.measurementId ?? placeholderConfig.measurementId,
};

export const isConfigured =
  Boolean(envConfig.apiKey) &&
  Boolean(envConfig.authDomain) &&
  Boolean(envConfig.projectId) &&
  Boolean(envConfig.appId);

const useEmulators = (envValue("VITE_USE_EMULATORS") ?? "").toLowerCase() === "true";
const emulatorHost = envValue("VITE_EMULATOR_HOST") ?? "127.0.0.1";
const firestoreEmulatorPort = Number(envValue("VITE_FIRESTORE_EMULATOR_PORT") ?? 8088);
const authEmulatorPort = Number(envValue("VITE_AUTH_EMULATOR_PORT") ?? 9099);
const functionsEmulatorPort = Number(envValue("VITE_FUNCTIONS_EMULATOR_PORT") ?? 5001);

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let functions: Functions | undefined;
let auth: Auth | undefined;

if (isConfigured) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  functions = getFunctions(app);
  auth = getAuth(app);

  if (useEmulators) {
    if (db) connectFirestoreEmulator(db, emulatorHost, firestoreEmulatorPort);
    if (functions) connectFunctionsEmulator(functions, emulatorHost, functionsEmulatorPort);
    if (auth) connectAuthEmulator(auth, `http://${emulatorHost}:${authEmulatorPort}`, { disableWarnings: true });
  }
}

let authInitPromise: Promise<void> | null = null;

export async function ensureSignedIn(): Promise<void> {
  if (!auth) return;
  if (auth.currentUser) return;
  if (!authInitPromise) {
    authInitPromise = signInAnonymously(auth).catch((error) => {
      authInitPromise = null;
      throw error;
    });
  }
  return authInitPromise;
}

export { app, db, functions, auth };
