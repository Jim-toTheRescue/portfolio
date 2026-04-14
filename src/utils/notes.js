const DB_NAME = 'manfolio-notes';
const DB_VERSION = 1;
const STORE_NAME = 'notes';

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('symbol', 'symbol', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export { generateId };

export async function addNote(symbol, name, content, isSystem = false, parentId = null, portfolioId = null, portfolioName = null) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const note = {
      id: generateId(),
      symbol,
      name,
      content,
      isSystem: isSystem || false,
      parentId: parentId,
      portfolioId: portfolioId,
      portfolioName: portfolioName,
      createdAt: now,
      updatedAt: now
    };
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(note);
    request.onsuccess = () => resolve(note);
    request.onerror = () => reject(request.error);
  });
}

export async function addNoteWithId(existingId, symbol, name, content, isSystem = false, parentId = null, portfolioId = null, portfolioName = null) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const note = {
      id: existingId,
      symbol,
      name,
      content,
      isSystem: isSystem || false,
      parentId: parentId,
      portfolioId: portfolioId,
      portfolioName: portfolioName,
      createdAt: now,
      updatedAt: now
    };
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(note);
    request.onsuccess = () => resolve(note);
    request.onerror = () => reject(request.error);
  });
}

export async function updateNote(id, content) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const note = getRequest.result;
      if (note) {
        note.content = content;
        note.updatedAt = new Date().toISOString();
        const putRequest = store.put(note);
        putRequest.onsuccess = () => resolve(note);
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        reject(new Error('Note not found'));
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function deleteNote(id) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getNotesBySymbol(symbol) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('symbol');
    const request = index.getAll(symbol);
    request.onsuccess = () => {
      const notes = request.result;
      notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      resolve(notes);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getAllNotes() {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const notes = request.result;
      notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      resolve(notes);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getNotesByPortfolioId(portfolioId) {
  const notes = await getAllNotes();
  return notes.filter(n => n.portfolioId === portfolioId);
}

export async function getAllSymbols() {
  const notes = await getAllNotes();
  
  // 股票评论卡片：按 symbol 分组
  const stockSymbols = {};
  // 组合评论卡片：按 portfolioId 分组
  const portfolioSymbols = {};
  
  notes.forEach(note => {
    // 股票评论（无 portfolioId）
    if (!note.portfolioId) {
      if (!stockSymbols[note.symbol]) {
        stockSymbols[note.symbol] = { symbol: note.symbol, name: note.name, count: 0 };
      }
      stockSymbols[note.symbol].count++;
      if (new Date(note.updatedAt) > new Date(stockSymbols[note.symbol].updatedAt || 0)) {
        stockSymbols[note.symbol].updatedAt = note.updatedAt;
      }
    }
    // 组合评论（有 portfolioId）
    if (note.portfolioId) {
      if (!portfolioSymbols[note.portfolioId]) {
        portfolioSymbols[note.portfolioId] = { 
          portfolioId: note.portfolioId,
          name: note.portfolioName,
          count: 0 
        };
      }
      portfolioSymbols[note.portfolioId].count++;
      if (new Date(note.updatedAt) > new Date(portfolioSymbols[note.portfolioId].updatedAt || 0)) {
        portfolioSymbols[note.portfolioId].updatedAt = note.updatedAt;
      }
    }
  });
  
  const stockList = Object.values(stockSymbols).sort((a, b) => 
    new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
  );
  const portfolioList = Object.values(portfolioSymbols).sort((a, b) => 
    new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
  );
  
  return [...portfolioList, ...stockList];
}

export async function exportNotes() {
  const notes = await getAllNotes();
  const data = JSON.stringify({ notes, exportedAt: new Date().toISOString() }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `manfolio-notes-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importNotes(notes) {
  if (!notes || !Array.isArray(notes)) return;
  const database = await openDB();
  const transaction = database.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  for (const note of notes) {
    store.put(note);
  }
}