(function () {
  "use strict";

  const PROJECT_PREFIX = "life-space-v1.";
  const MEDIA_DB = Object.freeze({ name: "life-space-v1.images", version: 1, stores: ["images"] });

  function projectKeys() {
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && key.startsWith(PROJECT_PREFIX)) keys.push(key);
    }
    return keys.sort();
  }

  function getPreference(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value == null ? fallback : JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function setPreference(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    return value;
  }

  function removePreference(key) {
    localStorage.removeItem(key);
  }

  function openDatabase(database) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(database.name, database.version || 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (database.name === MEDIA_DB.name && !db.objectStoreNames.contains("images")) {
          const store = db.createObjectStore("images", { keyPath: "id" });
          store.createIndex("cardId", "cardId", { unique: false });
        }
      };
      request.onerror = () => reject(request.error || new Error(`无法打开 ${database.name}`));
      request.onsuccess = () => resolve(request.result);
    });
  }

  async function listStore(database, storeName) {
    const db = await openDatabase(database);
    try {
      return await new Promise((resolve, reject) => {
        const request = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error || new Error(`无法读取 ${storeName}`));
      });
    } finally {
      db.close();
    }
  }

  async function replaceStore(database, storeName, records) {
    const db = await openDatabase(database);
    try {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        store.clear();
        records.forEach((record) => store.put(record));
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error || new Error(`无法恢复 ${storeName}`));
        transaction.onabort = transaction.onerror;
      });
    } finally {
      db.close();
    }
  }

  async function mergeStore(database, storeName, records) {
    const existing = await listStore(database, storeName);
    const byId = new Map(existing.map((record) => [record.id, record]));
    records.forEach((incoming) => {
      const current = byId.get(incoming.id);
      if (!current) {
        byId.set(incoming.id, incoming);
        return;
      }
      const currentTime = Date.parse(current.updatedAt || current.createdAt || "") || 0;
      const incomingTime = Date.parse(incoming.updatedAt || incoming.createdAt || "") || 0;
      if (incomingTime >= currentTime) byId.set(incoming.id, incoming);
    });
    await replaceStore(database, storeName, Array.from(byId.values()));
  }

  async function clearMedia() {
    await replaceStore(MEDIA_DB, "images", []);
  }

  const adapter = {
    id: "local",
    projectPrefix: PROJECT_PREFIX,
    mediaDatabases: Object.freeze([MEDIA_DB]),
    storage: window.LifeSpaceStorage,
    mediaStorage: window.LifeSpaceImageStorage,
    projectKeys,
    preferences: Object.freeze({
      get: getPreference,
      set: setPreference,
      remove: removePreference
    }),
    localStorage: Object.freeze({
      get(key) { return localStorage.getItem(key); },
      set(key, value) { localStorage.setItem(key, value); },
      remove(key) { localStorage.removeItem(key); },
      keys: projectKeys
    }),
    indexedDB: Object.freeze({
      listStore,
      replaceStore,
      mergeStore,
      clearMedia
    })
  };

  window.LifeSpaceLocalAdapter = Object.freeze(adapter);
})();
