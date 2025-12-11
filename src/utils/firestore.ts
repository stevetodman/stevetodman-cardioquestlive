import { 
  getFirestore, 
  collection as fCollection, 
  doc as fDoc, 
  addDoc as fAddDoc, 
  updateDoc as fUpdateDoc, 
  onSnapshot as fOnSnapshot, 
  query as fQuery, 
  where as fWhere, 
  limit as fLimit, 
  getDocs as fGetDocs,
  getDoc as fGetDoc,
  setDoc as fSetDoc,
  runTransaction as fRunTransaction,
  serverTimestamp as fServerTimestamp,
  DocumentSnapshot,
  QuerySnapshot,
  DocumentData
} from "firebase/firestore"; 
import { db as realDb, isConfigured } from "../firebase";

// --- Types ---
type MockDb = { type: 'mock' };
type MockCollection = { type: 'collection'; path: string; parentId?: string };
type MockDoc = { type: 'doc'; path: string; id: string; collectionPath: string; parentId?: string };
type MockQuery = { type: 'query'; collectionPath: string; parentId?: string; filters: Filter[] };
type Filter = { field: string; op: string; value: any };

// --- Shape Validators (mirroring firestore.rules for dev/prod parity) ---

function validateSessionShape(data: any): void {
  const required = ["createdBy", "joinCode", "slides", "questions", "currentSlideIndex", "showResults"];
  for (const field of required) {
    if (!(field in data)) throw new Error(`[mock-firestore] Session missing required field: ${field}`);
  }
  if (typeof data.createdBy !== "string") throw new Error("[mock-firestore] createdBy must be string");
  if (typeof data.joinCode !== "string") throw new Error("[mock-firestore] joinCode must be string");
  if (!Array.isArray(data.slides)) throw new Error("[mock-firestore] slides must be array");
  if (!Array.isArray(data.questions)) throw new Error("[mock-firestore] questions must be array");
  if (typeof data.currentSlideIndex !== "number") throw new Error("[mock-firestore] currentSlideIndex must be number");
  if (typeof data.showResults !== "boolean") throw new Error("[mock-firestore] showResults must be boolean");
}

function validateResponseShape(data: any, responseId: string): void {
  if (typeof data.userId !== "string") throw new Error("[mock-firestore] userId must be string");
  if (typeof data.questionId !== "string") throw new Error("[mock-firestore] questionId must be string");
  if (typeof data.choiceIndex !== "number") throw new Error("[mock-firestore] choiceIndex must be number");
  // Deterministic ID per firestore.rules: responseId == userId + "_" + questionId
  const expectedId = `${data.userId}_${data.questionId}`;
  if (responseId !== expectedId) {
    throw new Error(`[mock-firestore] Response ID mismatch: got "${responseId}", expected "${expectedId}"`);
  }
}

function validateParticipantShape(data: any, sessionId: string): void {
  const required = ["userId", "sessionId", "teamId", "teamName", "points", "streak", "correctCount", "incorrectCount", "createdAt"];
  for (const field of required) {
    if (!(field in data)) throw new Error(`[mock-firestore] Participant missing required field: ${field}`);
  }
  if (typeof data.userId !== "string") throw new Error("[mock-firestore] userId must be string");
  if (data.sessionId !== sessionId) throw new Error("[mock-firestore] sessionId must match parent session");
  if (typeof data.teamId !== "string") throw new Error("[mock-firestore] teamId must be string");
  if (typeof data.teamName !== "string") throw new Error("[mock-firestore] teamName must be string");
  if (typeof data.points !== "number") throw new Error("[mock-firestore] points must be number");
  if (typeof data.streak !== "number") throw new Error("[mock-firestore] streak must be number");
  if (typeof data.correctCount !== "number") throw new Error("[mock-firestore] correctCount must be number");
  if (typeof data.incorrectCount !== "number") throw new Error("[mock-firestore] incorrectCount must be number");
  if (data.role !== undefined && data.role !== "member" && data.role !== "lead") {
    throw new Error("[mock-firestore] role must be 'member' or 'lead'");
  }
}

// --- Storage Helpers ---
const STORAGE_KEY = 'cq_live_db';
let memoryStore: any = null; // Fallback if localStorage fails

function getStore() {
  // If we already have a memory store (e.g. from previous write), use it to stay in sync
  if (memoryStore) return memoryStore;
  
  try {
    const item = localStorage.getItem(STORAGE_KEY);
    const data = item ? JSON.parse(item) : { sessions: {}, responses: {}, participants: {} };
    // Sync memory store to disk state
    memoryStore = data;
    return data;
  } catch (e) {
    console.warn("LocalStorage access failed, using memory store", e);
    // Return empty store or existing memory store
    if (!memoryStore) memoryStore = { sessions: {}, responses: {}, participants: {} };
    return memoryStore;
  }
}

function setStore(data: any) {
  memoryStore = data; // Always update memory reference
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    // Dispatch event for same-tab updates
    window.dispatchEvent(new Event('storage-local'));
  } catch (e) {
    console.warn("LocalStorage write failed (using memory only)", e);
    // Still dispatch event so UI updates even if disk write failed
    window.dispatchEvent(new Event('storage-local'));
  }
}

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

// --- Mock Implementations ---

const mockCollection = (_db: any, path: string, ...pathSegments: string[]) => {
  const fullPath = [path, ...pathSegments].join('/');
  // Simplified: map subcollections to top-level stores
  if (fullPath.includes('/responses')) {
      return { type: 'collection', path: 'responses', parentId: fullPath.split('/')[1] };
  }
  if (fullPath.includes('/participants')) {
      return { type: 'collection', path: 'participants', parentId: fullPath.split('/')[1] };
  }
  return { type: 'collection', path: fullPath };
};

const mockDoc = (_db: any, ...segments: any[]) => {
    // Handle doc(collectionRef, id)
    if (segments.length === 2 && segments[0]?.type === 'collection') {
        const coll = segments[0] as MockCollection;
        const docId = segments[1] ?? generateId();
        return { type: 'doc', path: `${coll.path}/${docId}`, id: docId, collectionPath: coll.path, parentId: coll.parentId };
    }

    // Handle doc(db, ...pathSegments)
    if (segments.length >= 2) {
        const pathSegments = segments.slice(0, segments.length - 1);
        const docId = segments[segments.length - 1] ?? generateId();
        const [firstSegment, ...restSegments] = pathSegments as string[];
        const coll = mockCollection(_db, firstSegment, ...restSegments);
        return { type: 'doc', path: `${coll.path}/${docId}`, id: docId, collectionPath: coll.path, parentId: coll.parentId };
    }

    // Fallback for direct path string or collection
    const pathOrColl = segments[0];
    let collectionPath = '';
    let docId = undefined;
    let parentId;

    if (typeof pathOrColl === 'string') {
        const parts = pathOrColl.split('/');
        docId = parts.pop();
        const collPath = parts.join('/');
        collectionPath = collPath.includes('/responses') ? 'responses' : collPath.includes('/participants') ? 'participants' : collPath;
        parentId = parts.length > 1 ? parts[1] : undefined;
    } else if (pathOrColl?.path) {
        collectionPath = pathOrColl.path;
        parentId = (pathOrColl as any).parentId;
    }

    if (!docId) docId = generateId();
    return { type: 'doc', path: `${collectionPath}/${docId}`, id: docId, collectionPath, parentId };
};

const mockAddDoc = async (coll: any, data: any) => {
    const store = getStore();
    const id = generateId();
    const tableName = coll.path;

    if (!store[tableName]) store[tableName] = {};

    const docData = { ...data, id };
    // If this is a subcollection mapping (like responses), ensure we link it
    if (coll.parentId && (tableName === 'responses' || tableName === 'participants')) {
        docData.sessionId = coll.parentId;
    }

    // Validate shape based on collection (mirroring firestore.rules)
    if (tableName === "sessions") {
        validateSessionShape(docData);
    }

    store[tableName][id] = docData;
    setStore(store);
    return { id, path: `${tableName}/${id}` };
};

const mockUpdateDoc = async (docRef: any, data: any) => {
    const store = getStore();
    const tableName = docRef.collectionPath;
    const id = docRef.id;
    
    if (store[tableName] && store[tableName][id]) {
        store[tableName][id] = { ...store[tableName][id], ...data };
        setStore(store);
    }
};

// Polling for "Realtime" updates in Mock mode
const mockOnSnapshot = (queryOrRef: any, callback: (snap: any) => void) => {
    const handler = () => {
        const store = getStore();
        
        // Handle Doc Ref
        if (queryOrRef.type === 'doc') {
            const tableName = queryOrRef.collectionPath;
            const id = queryOrRef.id;
            const data = store[tableName]?.[id];
            
            const snap = {
                exists: () => !!data,
                id: id,
                data: () => data
            };
            callback(snap);
            return;
        }
        
        // Handle Query/Collection Ref
        let items = [];
        const tableName = queryOrRef.collectionPath || queryOrRef.path;
        
        if (store[tableName]) {
            items = Object.values(store[tableName]);
        }
        
        // Apply filters
        if (queryOrRef.type === 'query' && queryOrRef.filters) {
            items = items.filter((item: any) => {
                return queryOrRef.filters.every((f: Filter) => {
                    if (f.op === '==') return item[f.field] === f.value;
                    return true;
                });
            });
        }
        
        // Apply implicit parent filter for responses
        if (queryOrRef.parentId) {
             items = items.filter((item: any) => item.sessionId === queryOrRef.parentId);
        }

        const docs = items.map((item: any) => ({
            id: item.id,
            data: () => item
        }));
        
        callback({
            docs,
            empty: docs.length === 0,
            forEach: (fn: any) => docs.forEach(fn)
        });
    };

    // Initial call
    handler();

    // Listen for changes
    window.addEventListener('storage', handler);
    window.addEventListener('storage-local', handler);
    
    return () => {
        window.removeEventListener('storage', handler);
        window.removeEventListener('storage-local', handler);
    };
};

const mockQuery = (coll: any, ...constraints: any[]) => {
    const filters: Filter[] = [];
    constraints.forEach(c => {
        if (c.type === 'where') filters.push(c);
    });
    
    return { 
        type: 'query', 
        collectionPath: coll.path, 
        parentId: coll.parentId,
        filters 
    };
};

const mockWhere = (field: string, op: string, value: any) => ({ type: 'where', field, op, value });
const mockLimit = (_n: number) => ({ type: 'limit' }); // Ignored in mock for simplicity
const mockServerTimestamp = () => new Date();

const mockGetDocs = async (q: any) => {
    return new Promise<any>((resolve) => {
        mockOnSnapshot(q, (snap) => resolve(snap));
    });
};

const mockGetDoc = async (docRef: any) => {
    const store = getStore();
    const tableName = docRef.collectionPath;
    const id = docRef.id;
    const data = store[tableName]?.[id];
    return {
        exists: () => !!data,
        id,
        data: () => data
    };
};

const mockSetDoc = async (docRef: any, data: any) => {
    const store = getStore();
    const tableName = docRef.collectionPath;
    if (!store[tableName]) store[tableName] = {};

    // Validate shape based on collection (mirroring firestore.rules)
    if (tableName === "sessions") {
        validateSessionShape(data);
    } else if (tableName === "responses") {
        validateResponseShape(data, docRef.id);
    } else if (tableName === "participants" && docRef.parentId) {
        validateParticipantShape(data, docRef.parentId);
    }

    store[tableName][docRef.id] = { ...data, id: docRef.id, sessionId: docRef.parentId ?? data.sessionId };
    setStore(store);
};

const mockRunTransaction = async (_db: any, updateFunction: any) => {
    return updateFunction({
        get: async (docRef: any) => mockGetDoc(docRef),
        set: (docRef: any, data: any, options?: any) => {
            if (options?.merge && storeHas(docRef.collectionPath, docRef.id)) {
                return mockUpdateDoc(docRef, data);
            }
            return mockSetDoc(docRef, data);
        },
        update: (docRef: any, data: any) => mockUpdateDoc(docRef, data),
    });
};

function storeHas(collectionPath: string, id: string) {
    const store = getStore();
    return Boolean(store[collectionPath]?.[id]);
}

// --- Export Logic ---

// Use the existing 'db' exported from firebase.ts, which is already configured
const mockDb = { type: "mock" } as any;
export const db = isConfigured && realDb ? realDb : mockDb;

export const collection = isConfigured ? fCollection : (mockCollection as any);
export const doc = isConfigured ? fDoc : (mockDoc as any);
export const addDoc = isConfigured ? fAddDoc : (mockAddDoc as any);
export const updateDoc = isConfigured ? fUpdateDoc : (mockUpdateDoc as any);
export const onSnapshot = isConfigured ? fOnSnapshot : (mockOnSnapshot as any);
export const query = isConfigured ? fQuery : (mockQuery as any);
export const where = isConfigured ? fWhere : (mockWhere as any);
export const limit = isConfigured ? fLimit : (mockLimit as any);
export const getDocs = isConfigured ? fGetDocs : (mockGetDocs as any);
export const getDoc = isConfigured ? fGetDoc : (mockGetDoc as any);
export const setDoc = isConfigured ? fSetDoc : (mockSetDoc as any);
export const runTransaction = isConfigured ? fRunTransaction : (mockRunTransaction as any);
export const serverTimestamp = isConfigured ? fServerTimestamp : (mockServerTimestamp as any);
