(function () {
  "use strict";

  const EXPORT_VERSION = "1.0";
  const APP_VERSION = "v1.0-local-full-loop";
  const adapter = window.DataService.backupAdapter;

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
      reader.onerror = () => reject(reader.error || new Error("Blob 转换失败"));
      reader.readAsDataURL(blob);
    });
  }

  async function encodeValue(value) {
    if (value instanceof Blob) {
      return {
        __lifeSpaceType: "Blob",
        mimeType: value.type || "application/octet-stream",
        size: value.size,
        base64: await blobToBase64(value)
      };
    }
    if (Array.isArray(value)) return Promise.all(value.map(encodeValue));
    if (value && typeof value === "object") {
      const output = {};
      for (const [key, child] of Object.entries(value)) output[key] = await encodeValue(child);
      return output;
    }
    return value;
  }

  function base64ToBlob(value) {
    const binary = atob(value.base64 || "");
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: value.mimeType || "application/octet-stream" });
  }

  function decodeValue(value) {
    if (Array.isArray(value)) return value.map(decodeValue);
    if (value && typeof value === "object") {
      if (value.__lifeSpaceType === "Blob") return base64ToBlob(value);
      const output = {};
      Object.entries(value).forEach(([key, child]) => { output[key] = decodeValue(child); });
      return output;
    }
    return value;
  }

  function parseJson(value, fallback) {
    try { return JSON.parse(value); } catch (error) { return fallback; }
  }

  function calculateStatistics(localData, databases) {
    const users = parseJson(localData["life-space-v1.users"], []);
    const contentKeys = Object.keys(localData).filter((key) => key.startsWith("life-space-v1.cards."));
    const contents = contentKeys.reduce((sum, key) => sum + (parseJson(localData[key], []) || []).length, 0);
    const interactions = parseJson(localData["life-space-v1.interactions"], { hearts: [], replies: [], follows: [] }) || {};
    const notifications = parseJson(localData["life-space-v1.notifications"], []) || [];
    const mediaFiles = databases.reduce((sum, database) => sum + database.stores.reduce((storeSum, store) => storeSum + store.records.length, 0), 0);
    return {
      users: users.length,
      contents,
      mediaFiles,
      stars: (interactions.hearts || []).length,
      responses: (interactions.replies || []).length,
      follows: (interactions.follows || []).length,
      notifications: notifications.length
    };
  }

  async function createExportPayload() {
    const localData = {};
    adapter.projectKeys().forEach((key) => { localData[key] = adapter.localStorage.get(key); });
    const databases = [];
    for (const database of adapter.mediaDatabases) {
      const stores = [];
      for (const storeName of database.stores) {
        const records = await adapter.indexedDB.listStore(database, storeName);
        stores.push({ name: storeName, records: await encodeValue(records) });
      }
      databases.push({ name: database.name, version: database.version, stores });
    }
    return {
      exportVersion: EXPORT_VERSION,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      sourceOrigin: location.origin,
      localStorage: localData,
      indexedDB: { databases },
      statistics: calculateStatistics(localData, databases)
    };
  }

  function validatePayload(payload) {
    if (!payload || typeof payload !== "object") throw new Error("备份文件不是有效对象");
    if (payload.exportVersion !== EXPORT_VERSION) throw new Error(`不支持的 exportVersion：${payload.exportVersion || "缺失"}`);
    if (!payload.localStorage || typeof payload.localStorage !== "object") throw new Error("缺少 localStorage 数据");
    if (!payload.indexedDB || !Array.isArray(payload.indexedDB.databases)) throw new Error("缺少 IndexedDB 数据");
    const invalidKey = Object.keys(payload.localStorage).find((key) => !key.startsWith(adapter.projectPrefix));
    if (invalidKey) throw new Error(`备份包含非本项目数据：${invalidKey}`);
    payload.indexedDB.databases.forEach((database) => {
      const supported = adapter.mediaDatabases.find((item) => item.name === database.name);
      if (!supported) throw new Error(`不支持的数据库：${database.name}`);
      if (!Array.isArray(database.stores)) throw new Error(`数据库 ${database.name} 缺少 stores`);
      database.stores.forEach((store) => {
        if (!supported.stores.includes(store.name) || !Array.isArray(store.records)) throw new Error(`不支持的对象仓库：${store.name}`);
      });
    });
    return payload;
  }

  function recordTime(record) {
    return Date.parse(record && (record.updatedAt || record.createdAt || record.signedInAt) || "") || 0;
  }

  function mergeById(current, incoming) {
    const map = new Map();
    (Array.isArray(current) ? current : []).forEach((item) => { if (item && item.id) map.set(item.id, item); });
    (Array.isArray(incoming) ? incoming : []).forEach((item) => {
      if (!item || !item.id) return;
      const existing = map.get(item.id);
      if (!existing || recordTime(item) >= recordTime(existing)) map.set(item.id, item);
    });
    return Array.from(map.values());
  }

  function mergeLocalValue(key, currentRaw, incomingRaw) {
    if (currentRaw == null) return incomingRaw;
    if (key === "life-space-v1.session") return currentRaw;
    const current = parseJson(currentRaw, null);
    const incoming = parseJson(incomingRaw, null);
    if (Array.isArray(current) && Array.isArray(incoming)) return JSON.stringify(mergeById(current, incoming));
    if (key === "life-space-v1.interactions" && current && incoming) {
      return JSON.stringify({
        hearts: mergeById(current.hearts, incoming.hearts),
        replies: mergeById(current.replies, incoming.replies),
        follows: mergeById(current.follows, incoming.follows)
      });
    }
    if (current && incoming && typeof current === "object" && typeof incoming === "object") {
      return JSON.stringify(recordTime(incoming) >= recordTime(current) ? incoming : current);
    }
    return incomingRaw;
  }

  async function clearProjectData() {
    adapter.projectKeys().forEach((key) => adapter.localStorage.remove(key));
    await adapter.indexedDB.clearMedia();
  }

  async function restorePayload(payload, mode) {
    validatePayload(payload);
    if (mode !== "replace" && mode !== "merge") throw new Error("导入模式必须是 replace 或 merge");
    if (mode === "replace") await clearProjectData();
    Object.entries(payload.localStorage).forEach(([key, value]) => {
      const next = mode === "merge" ? mergeLocalValue(key, adapter.localStorage.get(key), value) : value;
      adapter.localStorage.set(key, next);
    });
    for (const database of payload.indexedDB.databases) {
      const supported = adapter.mediaDatabases.find((item) => item.name === database.name);
      for (const store of database.stores) {
        const records = decodeValue(store.records);
        if (mode === "replace") await adapter.indexedDB.replaceStore(supported, store.name, records);
        else await adapter.indexedDB.mergeStore(supported, store.name, records);
      }
    }
    return payload.statistics || calculateStatistics(payload.localStorage, payload.indexedDB.databases);
  }

  function filename() {
    const date = new Date();
    const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}-${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`;
    return `life-space-v1-data-backup-${stamp}.json`;
  }

  window.LifeSpaceDataBackup = Object.freeze({
    exportVersion: EXPORT_VERSION,
    appVersion: APP_VERSION,
    createExportPayload,
    validatePayload,
    restorePayload,
    clearProjectData,
    filename
  });
})();
