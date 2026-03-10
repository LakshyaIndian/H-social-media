// db.js - IndexedDB handler for Hitgram
const DB_NAME = 'HitgramDB';
const DB_VERSION = 1;
const STORE_NAME = 'images';
const MAX_IMAGES = 300;

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('addedDate', 'addedDate', { unique: false });
        store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
      }
    };
    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    request.onerror = (e) => reject(e.target.error);
  });
}

async function addImage(blob, tags = []) {
  const database = await openDB();
  const count = await getImageCount();
  if (count >= MAX_IMAGES) throw new Error(`Maximum ${MAX_IMAGES} images reached.`);
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record = { blob, tags, addedDate: Date.now(), favorite: false };
    const req = store.add(record);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function getAllImages() {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function getImageById(id) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function getImageCount() {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.count();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function toggleFavorite(id) {
  const database = await openDB();
  return new Promise(async (resolve, reject) => {
    const image = await getImageById(id);
    if (!image) return reject(new Error('Image not found'));
    image.favorite = !image.favorite;
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(image);
    req.onsuccess = () => resolve(image.favorite);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function deleteImage(id) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function getFavorites() {
  const images = await getAllImages();
  return images.filter(img => img.favorite);
}

window.HitgramDB = {
  addImage, getAllImages, getImageById, getImageCount,
  toggleFavorite, deleteImage, getFavorites, MAX_IMAGES
};
