/*********************************
 * Offline Orders - IndexedDB
 *********************************/

import { supabase } from "./supabase.js";

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

    request.onerror = () => reject("Failed to open IndexedDB");
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
    tx.onerror = () => reject("Failed to save offline order");
  });
}

/* جلب الطلبات */
async function getOfflineOrders() {
  if (!db) await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject("Failed to read offline orders");
  });
}

/* حذف طلب */
async function deleteOfflineOrder(offline_id) {
  if (!db) await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(offline_id);

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject("Failed to delete offline order");
  });
}

/* مزامنة الطلبات مع Supabase */
export async function syncOfflineOrders(businessDayId) {
  const orders = await getOfflineOrders();
  if (!orders.length) return;

  for (const o of orders) {
    try {
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          total: o.total,
          status: "active",
          business_day_id: businessDayId || o.business_day_id,
          timer_started_at: o.created_at,
          offline_id: o.offline_id
        })
        .select("id")
        .single();

      if (error || !order) throw error;

      await supabase.from("order_items").insert(
        o.cart.map(i => ({
          order_id: order.id,
          product_id: i.product_id,
          variant_id: i.variant_id || null,
          item_name: i.item_name,
          qty: i.qty,
          price: i.price,
          extras_removed: i.extras_removed || []
        }))
      );

      await deleteOfflineOrder(o.offline_id);

    } catch (e) {
      console.error("OFFLINE SYNC FAILED:", o.offline_id, e);
    }
  }
}