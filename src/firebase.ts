import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

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

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
