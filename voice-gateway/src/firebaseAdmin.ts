import admin from "firebase-admin";

// Idempotent firebase-admin initialization for the gateway.
// Expects credentials via GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT.
// Safe to import even when credentials are missing (firestore will be null).

let app: admin.app.App | null = null;
let firestoreInstance: admin.firestore.Firestore | null = null;
let authInstance: admin.auth.Auth | null = null;

export function getFirestore(): admin.firestore.Firestore | null {
  if (firestoreInstance) return firestoreInstance;
  try {
    if (!admin.apps || admin.apps.length === 0) {
      app = admin.initializeApp();
    } else {
      app = admin.apps[0]!;
    }
    firestoreInstance = admin.firestore(app);
    return firestoreInstance;
  } catch (err) {
    console.warn("[firestore] firebase-admin init failed; persistence disabled", err);
    return null;
  }
}

export function getAuth(): admin.auth.Auth | null {
  if (authInstance) return authInstance;
  try {
    if (!admin.apps || admin.apps.length === 0) {
      app = admin.initializeApp();
    } else {
      app = admin.apps[0]!;
    }
    authInstance = admin.auth(app);
    return authInstance;
  } catch (err) {
    console.warn("[auth] firebase-admin init failed; ws auth disabled", err);
    return null;
  }
}

export type FirestoreInstance = admin.firestore.Firestore;
