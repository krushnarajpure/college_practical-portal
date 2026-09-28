const memoryStore = new Map();

export function apiResponse(message, data) {
  return { success: true, message, data };
}

export function readCollection(key, initialValue = []) {
  try {
    const stored = globalThis.localStorage?.getItem(key);
    if (stored !== null && stored !== undefined) return JSON.parse(stored);
  } catch {
    return memoryStore.get(key) ?? initialValue;
  }
  return memoryStore.get(key) ?? initialValue;
}

export function writeCollection(key, value) {
  memoryStore.set(key, value);
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    return value;
  }
  return value;
}

export function createCollectionService({ key, name, initialValue = [] }) {
  return {
    getAll: async (filters = {}) => {
      const records = readCollection(key, initialValue);
      const data = records.filter((record) => Object.entries(filters || {}).every(([field, value]) => value === undefined || record[field] === value));
      return apiResponse(`${name} loaded.`, data);
    },
    getById: async (id) => apiResponse(`${name.slice(0, -1)} loaded.`, readCollection(key, initialValue).find((record) => record.id === id) || null),
    create: async (input) => {
      const records = readCollection(key, initialValue);
      const record = { ...input, id: input.id || `${key}-${Date.now()}` };
      writeCollection(key, [...records, record]);
      return apiResponse(`${name.slice(0, -1)} created.`, record);
    },
    update: async (id, changes) => {
      const records = readCollection(key, initialValue);
      let updated = null;
      const next = records.map((record) => {
        if (record.id !== id) return record;
        updated = { ...record, ...changes, id };
        return updated;
      });
      if (updated) writeCollection(key, next);
      return apiResponse(updated ? `${name.slice(0, -1)} updated.` : `${name.slice(0, -1)} not found.`, updated);
    },
    remove: async (id) => {
      const records = readCollection(key, initialValue);
      const next = records.filter((record) => record.id !== id);
      writeCollection(key, next);
      return apiResponse(`${name.slice(0, -1)} removed.`, { id, removed: next.length !== records.length });
    }
  };
}