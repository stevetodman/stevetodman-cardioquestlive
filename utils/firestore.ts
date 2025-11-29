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
  getDocs as fGetDocs
} from "firebase/firestore"; 
import { db as realDb, isConfigured } from "../firebase";

// --- Types ---
type Filter = { field: string; op: string; value: any };

// --- Storage Helpers ---
const STORAGE_KEY = 'cq_live_db';
let memoryStore: any = null; // Fallback if localStorage fails

function getStore() {
  if (memoryStore) return memoryStore;
  
  try {
    const item = localStorage.getItem(STORAGE_KEY);
    const data = item ? JSON.parse(item) : { sessions: {}, responses: {} };
    memoryStore = data;
    return data;
  } catch (e) {
    console.warn("LocalStorage access failed, using memory store", e);
    if (!memoryStore) memoryStore = { sessions: {}, responses: {} };
    return memoryStore;
  }
}

function setStore(data: any) {
  memoryStore = data;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event('storage-local'));
  } catch (e) {
    console.warn("LocalStorage write failed (using memory only)", e);
    window.dispatchEvent(new Event('storage-local'));
  }
}

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

// --- Mock Implementations ---

const mockCollection = (_db: any, path: string, ...pathSegments: string[]) => {
  const fullPath = [path, ...pathSegments].join('/');
  if (fullPath.includes('/responses')) {
      return { type: 'collection', path: 'responses', parentId: fullPath.split('/')[1] };
  }
  return { type: 'collection', path: fullPath };
};

const mockDoc = (_db: any, pathOrColl: string | any, id?: string) => {
    let collectionPath = '';
    let docId = id;
    
    if (typeof pathOrColl === 'string') {
        const parts = pathOrColl.split('/');
        collectionPath = parts[0];
        docId = parts[1];
    } else {
        collectionPath = pathOrColl.path;
    }
    
    if (!docId) docId = generateId();
    
    return { type: 'doc', path: `${collectionPath}/${docId}`, id: docId, collectionPath };
};

const mockAddDoc = async (coll: any, data: any) => {
    const store = getStore();
    const id = generateId();
    const tableName = coll.path;
    
    if (!store[tableName]) store[tableName] = {};
    
    const docData = { ...data, id };
    if (coll.parentId && tableName === 'responses') {
        docData.sessionId = coll.parentId;
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

const mockOnSnapshot = (queryOrRef: any, callback: (snap: any) => void) => {
    const handler = () => {
        const store = getStore();
        
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
        
        let items = [];
        const tableName = queryOrRef.collectionPath || queryOrRef.path;
        
        if (store[tableName]) {
            items = Object.values(store[tableName]);
        }
        
        if (queryOrRef.type === 'query' && queryOrRef.filters) {
            items = items.filter((item: any) => {
                return queryOrRef.filters.every((f: Filter) => {
                    if (f.op === '==') return item[f.field] === f.value;
                    return true;
                });
            });
        }
        
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

    handler();
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
const mockLimit = (_n: number) => ({ type: 'limit' });

const mockGetDocs = async (q: any) => {
    return new Promise<any>((resolve) => {
        mockOnSnapshot(q, (snap) => resolve(snap));
    });
};

// Use the existing 'db' exported from firebase.ts, which is already configured
export const db = isConfigured ? realDb : ({ type: 'mock' } as any);

export const collection = isConfigured ? fCollection : (mockCollection as any);
export const doc = isConfigured ? fDoc : (mockDoc as any);
export const addDoc = isConfigured ? fAddDoc : (mockAddDoc as any);
export const updateDoc = isConfigured ? fUpdateDoc : (mockUpdateDoc as any);
export const onSnapshot = isConfigured ? fOnSnapshot : (mockOnSnapshot as any);
export const query = isConfigured ? fQuery : (mockQuery as any);
export const where = isConfigured ? fWhere : (mockWhere as any);
export const limit = isConfigured ? fLimit : (mockLimit as any);
export const getDocs = isConfigured ? fGetDocs : (mockGetDocs as any);
