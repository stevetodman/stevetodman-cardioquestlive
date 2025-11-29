import { initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getFunctions, type Functions } from "firebase/functions";
import {
  getAuth,
  signInAnonymously,
  type Auth,
} from "firebase/auth";

const placeholderConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_FIREBASE_PROJECT.firebaseapp.com",
  projectId: "YOUR_FIREBASE_PROJECT",
  storageBucket: "YOUR_FIREBASE_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID",
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? placeholderConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? placeholderConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? placeholderConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? placeholderConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? placeholderConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? placeholderConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? placeholderConfig.measurementId,
};

export const isConfigured =
  firebaseConfig.apiKey !== placeholderConfig.apiKey &&
  firebaseConfig.projectId !== placeholderConfig.projectId;

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let functions: Functions | undefined;
let auth: Auth | undefined;

if (isConfigured) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  functions = getFunctions(app);
  auth = getAuth(app);
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
