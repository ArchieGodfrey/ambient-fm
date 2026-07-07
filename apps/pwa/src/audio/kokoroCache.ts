// A transformers.js custom cache backed by IndexedDB.
//
// Safari's Cache Storage API throws "Failed to execute 'put' on 'Cache':
// Unexpected internal error" on the Hugging Face model responses, so the Kokoro
// weights never persist and re-download every session (and it spams the log).
// IndexedDB is reliable on iOS/Safari, so we point transformers.js at a custom
// cache implementing the Web Cache API's match/put — fixing both the error and
// cross-session persistence.

const DB_NAME = "ambientfm-model-cache";
const STORE = "responses";

type Record = { buffer: ArrayBuffer; headers: [string, string][] };

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(key: string): Promise<Record | undefined> {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const r = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result as Record | undefined);
    r.onerror = () => reject(r.error);
  }));
}

function idbPut(key: string, value: Record): Promise<void> {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

// Implements the subset of the Web Cache API transformers.js uses.
export const idbModelCache = {
  async match(key: string | Request): Promise<Response | undefined> {
    try {
      const rec = await idbGet(typeof key === "string" ? key : key.url);
      return rec ? new Response(rec.buffer, { headers: rec.headers }) : undefined;
    } catch {
      return undefined;
    }
  },
  async put(key: string | Request, response: Response): Promise<void> {
    try {
      const buffer = await response.clone().arrayBuffer();
      const headers: [string, string][] = [];
      response.headers.forEach((v, k) => headers.push([k, v]));
      await idbPut(typeof key === "string" ? key : key.url, { buffer, headers });
    } catch (e) {
      console.warn("Model cache put failed", e);
    }
  },
};

export async function clearModelCache(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* ignore */ }
}
