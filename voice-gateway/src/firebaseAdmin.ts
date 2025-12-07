import admin from "firebase-admin";

// Idempotent firebase-admin initialization for the gateway.
// Expects credentials via GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT.
// Safe to import even when credentials are missing (firestore will be null).

let app: admin.app.App | null = null;
let firestoreInstance: admin.firestore.Firestore | null = null;
let authInstance: admin.auth.Auth | null = null;
let warned = false;

function getCredential(): admin.credential.Credential | undefined {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (inline) {
    try {
      const parsed = JSON.parse(inline);
      return admin.credential.cert(parsed as admin.ServiceAccount);
    } catch (err) {
      if (!warned) {
        console.warn("[firebase-admin] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON", err);
        warned = true;
      }
    }
  }
  return undefined;
}

function initApp(): admin.app.App | null {
  if (app) return app;
  try {
    const credential = getCredential();
    app = credential ? admin.initializeApp({ credential }) : admin.initializeApp();
    return app;
  } catch (err) {
    if (!warned) {
      console.warn("[firebase-admin] init failed; admin features disabled", err);
      warned = true;
    }
    return null;
  }
}

export function getFirestore(): admin.firestore.Firestore | null {
  if (firestoreInstance) return firestoreInstance;
  const initialized = initApp();
  if (!initialized) return null;
  firestoreInstance = admin.firestore(initialized);
  try {
    firestoreInstance.settings({ ignoreUndefinedProperties: true });
  } catch {
    // ignore if already set or unsupported in this env
  }
  return firestoreInstance;
}

export function getAuth(): admin.auth.Auth | null {
  if (authInstance) return authInstance;
  const initialized = initApp();
  if (!initialized) return null;
  authInstance = admin.auth(initialized);
  return authInstance;
}

export type FirestoreInstance = admin.firestore.Firestore;
