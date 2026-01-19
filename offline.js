/*********************************
 * Offline Orders - IndexedDB
 *********************************/

const DB_NAME = "cashier_offline";
const DB_VERSION = 1;
const STORE_NAME = "orders";

let db = null;

/* فتح قاعدة البيانات */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = e => {
      const database = e.target.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, {
          keyPath: "offline_id"
        });
      }
    };

    request.onsuccess = e => {
      db = e.target.result;
      resolve(db);
    };

    request.onerror = () => {
      reject("فشل فتح IndexedDB");
    };
  });
}

/* حفظ طلب Offline */
export async function saveOfflineOrder(order) {
  if (!db) await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    store.put(order);

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject("فشل حفظ الطلب محليًا");
  });
}

/* جلب كل الطلبات */
export async function getOfflineOrders() {
  if (!db) await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject("فشل قراءة الطلبات");
  });
}

/* حذف طلب بعد المزامنة */
export async function deleteOfflineOrder(offline_id) {
  if (!db) await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    store.delete(offline_id);

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject("فشل حذف الطلب");
  });
}