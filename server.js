const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function getThaiTimestamp() {
  const now = new Date();
  now.setHours(now.getHours() + 7);
  return now.toISOString().slice(0, 19).replace('T', ' ');
}

function generateTicketId() {
  const now = new Date();
  now.setHours(now.getHours() + 7);
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(100 + Math.random() * 900);
  return `TCK-${dateStr}-${randomNum}`;
}

const dbFile = path.join(__dirname, 'inventory.db');
const db = new sqlite3.Database(dbFile, (err) => {
  if (err) console.error('Error opening database', err.message);
  else console.log('Connected to the Vanitory Cosmetics WMS database.');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS products (
    product_id TEXT PRIMARY KEY,
    product_name TEXT,
    total_quantity INTEGER DEFAULT 0,
    quarantine_quantity INTEGER DEFAULT 0,
    updated_at DATETIME
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS product_lots (
    lot_id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT,
    lot_number TEXT,
    exp_date DATE,
    quantity INTEGER,
    po_number TEXT,
    delivery_note_no TEXT,
    FOREIGN KEY(product_id) REFERENCES products(product_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS documents (
    doc_id TEXT PRIMARY KEY,
    doc_type TEXT,
    reference_info TEXT,
    destination_address TEXT,
    eta_date DATE,
    delivery_note_no TEXT,
    received_by TEXT,
    discrepancy_note TEXT,
    status TEXT DEFAULT 'PENDING',
    created_at DATETIME,
    created_by TEXT,
    completed_at DATETIME
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS document_items (
    item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_id TEXT,
    product_id TEXT,
    ordered_qty INTEGER DEFAULT 0,
    received_qty INTEGER DEFAULT 0,
    FOREIGN KEY(doc_id) REFERENCES documents(doc_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS orders (
    order_id TEXT PRIMARY KEY,
    channel TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    shipping_address TEXT,
    payment_method TEXT,
    cod_amount REAL DEFAULT 0,
    batch_id TEXT,
    status TEXT DEFAULT 'PENDING_CUTOFF',
    created_at DATETIME,
    shipped_at DATETIME
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT,
    product_id TEXT,
    quantity INTEGER,
    FOREIGN KEY(order_id) REFERENCES orders(order_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS product_returns (
    return_id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_order_id TEXT,
    product_id TEXT,
    quantity INTEGER,
    status TEXT,
    note TEXT,
    created_at DATETIME,
    created_by TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME,
    ticket_id TEXT,
    username TEXT,
    action TEXT,
    details TEXT
  )`);

  db.run(`ALTER TABLE documents ADD COLUMN destination_address TEXT`, () => {});
  db.run(`ALTER TABLE documents ADD COLUMN discrepancy_note TEXT`, () => {});
  db.run(`ALTER TABLE products ADD COLUMN quarantine_quantity INTEGER DEFAULT 0`, () => {});
});

function seedInitialData() {
  db.get(`SELECT COUNT(*) as count FROM products`, (err, row) => {
    if (row && row.count === 0) {
      const thaiTime = getThaiTimestamp();
      const todayStr = thaiTime.slice(0, 10);
      db.run(`INSERT INTO products VALUES ('COS-001', 'เซรั่มบำรุงผิวหน้า Vit C (30ml)', 250, 0, ?)`, [thaiTime]);
      db.run(`INSERT INTO products VALUES ('COS-002', 'ลิปทินท์เนื้อละมุน (สีพีช)', 180, 0, ?)`, [thaiTime]);
      db.run(`INSERT INTO products VALUES ('SKC-001', 'ครีมกันแดดสูตรน้ำ SPF50+', 120, 2, ?)`, [thaiTime]);

      db.run(`INSERT INTO product_lots (product_id, lot_number, exp_date, quantity, po_number, delivery_note_no) VALUES ('COS-001', 'LOT-2601A', '2027-01-15', 100, 'PO-INIT', 'DN-001')`);
      db.run(`INSERT INTO product_lots (product_id, lot_number, exp_date, quantity, po_number, delivery_note_no) VALUES ('COS-001', 'LOT-2606B', '2027-06-20', 150, 'PO-INIT', 'DN-002')`);
      db.run(`INSERT INTO product_lots (product_id, lot_number, exp_date, quantity, po_number, delivery_note_no) VALUES ('COS-002', 'LOT-2602A', '2027-02-28', 180, 'PO-INIT', 'DN-001')`);
      db.run(`INSERT INTO product_lots (product_id, lot_number, exp_date, quantity, po_number, delivery_note_no) VALUES ('SKC-001', 'LOT-2603A', '2027-03-10', 120, 'PO-INIT', 'DN-003')`);

      db.run(`INSERT INTO documents (doc_id, doc_type, reference_info, destination_address, eta_date, status, created_at, created_by) VALUES ('PO-202611-001', 'INBOUND_PO', 'บมจ. คอสเมติกส์แล็บ', '-', ?, 'PENDING', ?, 'purchasing_team')`, [todayStr, thaiTime]);
      db.run(`INSERT INTO document_items (doc_id, product_id, ordered_qty) VALUES ('PO-202611-001', 'COS-001', 500)`);

      db.run(`INSERT INTO documents (doc_id, doc_type, reference_info, destination_address, status, created_at, created_by) VALUES ('REQ-20261118-881', 'INTERNAL_REQ', '[Marketing / PR] คุณแพรว (ส่ง Influencer รีวิว)', 'ตึก FYI Center ชั้น 12 อาคาร B ถ.พระราม 4 คลองเตย กทม.', 'PENDING', ?, 'marketing_portal')`, [thaiTime]);
      db.run(`INSERT INTO document_items (doc_id, product_id, ordered_qty) VALUES ('REQ-20261118-881', 'COS-001', 5)`);
      db.run(`INSERT INTO document_items (doc_id, product_id, ordered_qty) VALUES ('REQ-20261118-881', 'COS-002', 2)`);

      db.run(`INSERT INTO orders VALUES ('TT-20261118-999', 'TikTok Shop', 'คุณสมชาย ใจดี', '089-111-2233', '123 ถ.สุขุมวิท กทม.', 'COD', 490, 'BATCH-20261118-0900', 'SHIPPED', ?, ?)`, [thaiTime, thaiTime]);
      db.run(`INSERT INTO order_items (order_id, product_id, quantity) VALUES ('TT-20261118-999', 'COS-002', 2)`);
    }
  });
}
setTimeout(seedInitialData, 800);

function calculateFefoPlan(items, lots, todayStr) {
  const simLots = lots
    .filter(l => l.quantity > 0 && l.exp_date >= todayStr)
    .sort((a, b) => a.exp_date.localeCompare(b.exp_date))
    .map(l => ({ ...l }));

  return items.map(item => {
    let needed = item.quantity || item.ordered_qty;
    const allocations = [];
    for (let lot of simLots) {
      if (lot.product_id === item.product_id && lot.quantity > 0 && needed > 0) {
        const take = Math.min(lot.quantity, needed);
        allocations.push({ lot_id: lot.lot_id, lot_number: lot.lot_number, exp_date: lot.exp_date, pick_qty: take });
        lot.quantity -= take;
        needed -= take;
      }
    }
    return { ...item, req_qty: item.quantity || item.ordered_qty, allocations, shortage: needed };
  });
}

function getBadges(callback) {
  db.get(`SELECT COUNT(*) as c FROM documents WHERE doc_type = 'INBOUND_PO' AND status = 'PENDING'`, (e1, r1) => {
    db.get(`SELECT COUNT(*) as c FROM orders WHERE status = 'PENDING_CUTOFF'`, (e2, r2) => {
      db.get(`SELECT COUNT(*) as c FROM documents WHERE doc_type = 'INTERNAL_REQ' AND status = 'PENDING'`, (e3, r3) => {
        db.get(`SELECT COUNT(*) as c FROM orders WHERE status = 'SHIPPED' AND order_id NOT IN (SELECT original_order_id FROM product_returns)`, (e4, r4) => {
          callback({
            inbound: r1 ? r1.c : 0,
            orders: r2 ? r2.c : 0,
            internal: r3 ? r3.c : 0,
            returns: r4 ? r4.c : 0
          });
        });
      });
    });
  });
}

app.get('/api/page/:page', (req, res) => {
  const page = req.params.page;
  const subId = req.query.id;
  const todayStr = getThaiTimestamp().slice(0, 10);

  getBadges((badges) => {
    if (page === 'dashboard') {
      db.all(`SELECT * FROM products`, [], (err, products) => {
        products = products || [];
        db.all(`SELECT pl.*, p.product_name FROM product_lots pl JOIN products p ON pl.product_id = p.product_id WHERE pl.quantity > 0 ORDER BY pl.exp_date ASC LIMIT 5`, [], (err, nearExpiryLots) => {
          const totalStock = products.reduce((acc, p) => acc + (p.total_quantity || 0), 0);
          res.json({ headerTitle: 'Warehouse Management System', badges, totalStock, nearExpiryLots: nearExpiryLots || [], todayStr });
        });
      });
    } else if (page === 'stock') {
      db.all(`SELECT * FROM products ORDER BY product_id ASC`, [], (err, products) => {
        db.all(`SELECT * FROM product_lots WHERE quantity > 0 ORDER BY exp_date ASC`, [], (err, lots) => {
          res.json({ headerTitle: 'สต็อกและล็อตสินค้า (Stock Balance)', badges, products: products || [], lots: lots || [] });
        });
      });
    } else if (page === 'inbound' && !subId) {
      db.all(`SELECT * FROM documents WHERE doc_type = 'INBOUND_PO' ORDER BY CASE WHEN status = 'PENDING' THEN 0 ELSE 1 END, eta_date ASC`, [], (err, docs) => {
        res.json({ headerTitle: 'ตรวจรับสินค้าเข้าคลัง', badges, docs: docs || [], todayStr });
      });
    } else if (page === 'inbound' && subId) {
      db.get(`SELECT * FROM documents WHERE doc_id = ? AND doc_type = 'INBOUND_PO'`, [subId], (err, doc) => {
        db.all(`SELECT di.*, p.product_name FROM document_items di JOIN products p ON di.product_id = p.product_id WHERE di.doc_id = ?`, [subId], (err, items) => {
          res.json({ headerTitle: `ตรวจรับ PO - ${subId}`, badges, doc, items: items || [] });
        });
      });
    } else if (page === 'orders') {
      db.all(`SELECT * FROM orders ORDER BY created_at DESC`, [], (err, orders) => {
        orders = orders || [];
        db.all(`SELECT oi.*, p.product_name FROM order_items oi JOIN products p ON oi.product_id = p.product_id`, [], (err, allItems) => {
          const pendingCutoffOrders = orders.filter(o => o.status === 'PENDING_CUTOFF');
          const batchMap = {};
          orders.filter(o => o.batch_id).forEach(o => {
            if (!batchMap[o.batch_id]) batchMap[o.batch_id] = { batch_id: o.batch_id, status: o.status, orders: [] };
            batchMap[o.batch_id].orders.push(o);
          });
          const batches = Object.values(batchMap);
          const unshippedBatchesCount = batches.filter(b => b.status === 'BATCHED').length;
          res.json({ headerTitle: 'รอบจัดส่งออร์เดอร์', badges, pendingCutoffOrders, batches, unshippedBatchesCount, allItems: allItems || [] });
        });
      });
    } else if (page === 'internal' && !subId) {
      db.all(`SELECT * FROM documents WHERE doc_type = 'INTERNAL_REQ' ORDER BY created_at DESC`, [], (err, docs) => {
        db.all(`SELECT di.*, p.product_name FROM document_items di JOIN products p ON di.product_id = p.product_id`, [], (err, allItems) => {
          res.json({ headerTitle: 'เบิกสินค้าใช้ภายใน', badges, docs: docs || [], allItems: allItems || [] });
        });
      });
    } else if (page === 'internal' && subId) {
      db.get(`SELECT * FROM documents WHERE doc_id = ? AND doc_type = 'INTERNAL_REQ'`, [subId], (err, doc) => {
        db.all(`SELECT di.*, p.product_name FROM document_items di JOIN products p ON di.product_id = p.product_id WHERE di.doc_id = ?`, [subId], (err, items) => {
          db.all(`SELECT * FROM product_lots WHERE quantity > 0`, [], (err, lots) => {
            const pickPlan = calculateFefoPlan(items || [], lots || [], todayStr);
            res.json({ headerTitle: `รายละเอียดใบเบิก - ${subId}`, badges, doc, pickPlan });
          });
        });
      });
    } else if (page === 'returns' && !subId) {
      db.all(`SELECT * FROM orders WHERE status = 'SHIPPED' AND order_id NOT IN (SELECT original_order_id FROM product_returns) ORDER BY shipped_at DESC`, [], (err, returnQueue) => {
        db.all(`SELECT r.*, p.product_name FROM product_returns r JOIN products p ON r.product_id = p.product_id ORDER BY r.return_id DESC`, [], (err, returnHistory) => {
          res.json({ headerTitle: 'สินค้าตีกลับและ Quarantine', badges, returnQueue: returnQueue || [], returnHistory: returnHistory || [] });
        });
      });
    } else if (page === 'returns' && subId) {
      db.get(`SELECT * FROM orders WHERE order_id = ?`, [subId], (err, order) => {
        db.all(`SELECT oi.*, p.product_name FROM order_items oi JOIN products p ON oi.product_id = p.product_id WHERE oi.order_id = ?`, [subId], (err, items) => {
          res.json({ headerTitle: `ตรวจสอบตีกลับ - ${subId}`, badges, order, items: items || [] });
        });
      });
    } else if (page === 'admin') {
      db.all(`SELECT * FROM activity_logs ORDER BY id DESC`, [], (err, logs) => {
        res.json({ headerTitle: 'ระบบตรวจสอบ (Audit)', badges, logs: logs || [] });
      });
    }
  });
});

app.post('/api/inbound/simulate', (req, res) => {
  const thaiTime = getThaiTimestamp();
  const todayStr = thaiTime.slice(0, 10);
  const offsetDays = Math.floor(Math.random() * 4);
  const etaDateObj = new Date(`${todayStr}T00:00:00`);
  etaDateObj.setDate(etaDateObj.getDate() + offsetDays);
  const etaStr = etaDateObj.toISOString().slice(0, 10);
  const rand = Math.floor(100 + Math.random() * 900);
  const docId = `PO-${todayStr.slice(0, 7).replace('-', '')}-${rand}`;
  const suppliers = ['บจก. สกินแคร์ อินโนเวชั่น', 'บมจ. คอสเมติกส์แล็บ', 'บจก. บิวตี้ ซัพพลาย ไทยแลนด์'];
  db.run(`INSERT INTO documents (doc_id, doc_type, reference_info, destination_address, eta_date, status, created_at, created_by) VALUES (?, 'INBOUND_PO', ?, '-', ?, 'PENDING', ?, 'erp_purchasing_sync')`,
    [docId, suppliers[rand % suppliers.length], etaStr, thaiTime], () => {
      db.run(`INSERT INTO document_items (doc_id, product_id, ordered_qty) VALUES (?, 'COS-002', 200)`, [docId], () => res.json({ ok: true }));
    }
  );
});

app.post('/api/inbound/process', (req, res) => {
  const { doc_id, delivery_note_no, received_by, discrepancy_note, lot_number, exp_date, received_qty, quarantine_qty } = req.body;
  const thaiTime = getThaiTimestamp();
  const ticketId = generateTicketId();
  const recvQty = Math.max(0, parseInt(received_qty || 0, 10));
  const damQty = Math.max(0, parseInt(quarantine_qty || 0, 10));
  const goodQty = Math.max(0, recvQty - damQty);

  db.get(`SELECT product_id FROM document_items WHERE doc_id = ?`, [doc_id], (err, item) => {
    if (!item) return res.json({ ok: false });
    db.run(`UPDATE documents SET status = 'COMPLETED', delivery_note_no = ?, received_by = ?, discrepancy_note = ?, completed_at = ? WHERE doc_id = ?`,
      [delivery_note_no, received_by, discrepancy_note || null, thaiTime, doc_id], () => {
        db.run(`UPDATE document_items SET received_qty = ? WHERE doc_id = ?`, [recvQty, doc_id], () => {
          const insertLot = (cb) => goodQty > 0
            ? db.run(`INSERT INTO product_lots (product_id, lot_number, exp_date, quantity, po_number, delivery_note_no) VALUES (?, ?, ?, ?, ?, ?)`, [item.product_id, lot_number, exp_date, goodQty, doc_id, delivery_note_no], cb)
            : cb();
          insertLot(() => {
            db.run(`UPDATE products SET total_quantity = total_quantity + ?, quarantine_quantity = quarantine_quantity + ?, updated_at = ? WHERE product_id = ?`, [goodQty, damQty, thaiTime, item.product_id], () => {
              const detailText = `ตรวจรับ PO: ${doc_id} (Lot: ${lot_number}, รับจริง: ${recvQty}, พร้อมขาย: ${goodQty}, Quarantine: ${damQty}${discrepancy_note ? `, หมายเหตุ: ${discrepancy_note}` : ''})`;
              db.run(`INSERT INTO activity_logs (timestamp, ticket_id, username, action, details) VALUES (?, ?, ?, ?, ?)`, [thaiTime, ticketId, received_by || 'cosmetic_staff01', 'INBOUND_RECEIVE', detailText], () => res.json({ ok: true }));
            });
          });
        });
      }
    );
  });
});

app.get('/inbound/:id/print', (req, res) => {
  const docId = req.params.id;
  db.get(`SELECT * FROM documents WHERE doc_id = ?`, [docId], (err, doc) => {
    if (!doc) return res.send('ไม่พบเอกสาร');
    db.all(`SELECT di.*, p.product_name FROM document_items di JOIN products p ON di.product_id = p.product_id WHERE di.doc_id = ?`, [docId], (err, items) => {
      res.send(`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>Print PO</title><style>body{font-family:'Sarabun',sans-serif;padding:40px;max-width:800px;margin:auto;}table{width:100%;border-collapse:collapse;margin-top:20px;}th,td{border:1px solid #000;padding:10px;}th{background:#f1f5f9;}</style></head><body><h2>ใบตรวจรับสินค้า - ${doc.doc_id}</h2><p><b>Supplier:</b> ${doc.reference_info}</p><table><tr><th>รหัส</th><th>ชื่อสินค้า</th><th>ยอดสั่ง</th><th>รับจริง</th><th>Lot</th><th>EXP</th></tr>${(items || []).map(i => `<tr><td>${i.product_id}</td><td>${i.product_name}</td><td>${i.ordered_qty}</td><td></td><td></td><td></td></tr>`).join('')}</table><br><button onclick="window.print()">🖨️ พิมพ์</button></body></html>`);
    });
  });
});

app.post('/api/orders/simulate', (req, res) => {
  const thaiTime = getThaiTimestamp();
  const dateCompact = thaiTime.slice(0, 10).replace(/-/g, '');
  const orderId = `TT-${dateCompact}-${Math.floor(100 + Math.random() * 900)}`;
  db.run(`INSERT INTO orders VALUES (?, 'TikTok Shop', 'คุณกานดา ใจดี', '081-234-5678', '99/12 ถ.บรมราชชนนี ทวีวัฒนา กทม.', 'COD', 590, NULL, 'PENDING_CUTOFF', ?, NULL)`, [orderId, thaiTime], () => {
    db.run(`INSERT INTO order_items (order_id, product_id, quantity) VALUES (?, 'COS-001', 1)`, [orderId], () => {
      db.run(`INSERT INTO order_items (order_id, product_id, quantity) VALUES (?, 'COS-002', 2)`, [orderId], () => res.json({ ok: true }));
    });
  });
});

app.post('/api/orders/cutoff', (req, res) => {
  const thaiTime = getThaiTimestamp();
  const batchId = `BATCH-${thaiTime.slice(0, 10).replace(/-/g, '')}-${thaiTime.slice(11, 16).replace(':', '')}`;
  db.run(`UPDATE orders SET batch_id = ?, status = 'BATCHED' WHERE status = 'PENDING_CUTOFF'`, [batchId], () => res.json({ ok: true }));
});

app.get('/orders/batch/:batchId/print', (req, res) => {
  const batchId = req.params.batchId;
  const todayStr = getThaiTimestamp().slice(0, 10);
  db.all(`SELECT * FROM orders WHERE batch_id = ?`, [batchId], (err, orders) => {
    if (!orders || orders.length === 0) return res.send('ไม่พบรอบจัดส่ง');
    const orderIds = orders.map(o => o.order_id);
    const placeholders = orderIds.map(() => '?').join(',');
    db.all(`SELECT oi.*, p.product_name FROM order_items oi JOIN products p ON oi.product_id = p.product_id WHERE oi.order_id IN (${placeholders})`, orderIds, (err, allItems) => {
      const summaryMap = {};
      (allItems || []).forEach(i => {
        if (!summaryMap[i.product_id]) summaryMap[i.product_id] = { product_id: i.product_id, product_name: i.product_name, quantity: 0 };
        summaryMap[i.product_id].quantity += i.quantity;
      });
      db.all(`SELECT * FROM product_lots WHERE quantity > 0`, [], (err, lots) => {
        const pickPlan = calculateFefoPlan(Object.values(summaryMap), lots || [], todayStr);
        res.send(`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>Print Batch</title><style>body{font-family:'Sarabun',sans-serif;padding:30px;max-width:820px;margin:auto;}table{width:100%;border-collapse:collapse;margin-bottom:24px;}th,td{border:1px solid #000;padding:10px;}th{background:#f1f5f9;}.label-box{border:2px solid #000;padding:18px;margin-bottom:20px;page-break-inside:avoid;}.page-break{page-break-before:always;}@media print{.no-print{display:none;}}</style></head><body><div class="no-print" style="margin-bottom:20px;text-align:right;"><button onclick="window.print()" style="padding:10px 20px;background:#0284c7;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">🖨️ พิมพ์ชุดเอกสาร</button></div><h2>ใบสรุปหยิบสินค้า (Batch Pick List - FEFO) - ${batchId}</h2><table><thead><tr><th>รหัส</th><th>ชื่อสินค้า</th><th>หยิบจากล็อต (FEFO)</th><th>รวม</th><th>เช็ก</th></tr></thead><tbody>${pickPlan.map(i => `<tr><td><b>${i.product_id}</b></td><td>${i.product_name}</td><td>${i.allocations.map(a => `${a.lot_number} (EXP: ${a.exp_date}) → ${a.pick_qty}`).join('<br>')}</td><td align="center"><b>${i.req_qty}</b></td><td align="center">☐</td></tr>`).join('')}</tbody></table><div class="page-break"></div><h3>📦 ใบปะหน้าพัสดุ (${orders.length} กล่อง)</h3>${orders.map((ord, idx) => `<div class="label-box"><div><b>กล่อง ${idx + 1}/${orders.length}</b> | ช่องทาง: <b>${ord.channel}</b> | Order: <b>${ord.order_id}</b></div><br><b>ผู้รับ: ${ord.customer_name}</b> (${ord.customer_phone})<br><b>ที่อยู่:</b> ${ord.shipping_address}</div>`).join('')}</body></html>`);
      });
    });
  });
});

app.post('/api/orders/batch/:batchId/ship', (req, res) => {
  const batchId = req.params.batchId;
  const username = (req.body && req.body.username) || 'cosmetic_staff01';
  const thaiTime = getThaiTimestamp();
  const todayStr = thaiTime.slice(0, 10);
  const ticketId = generateTicketId();

  db.all(`SELECT * FROM orders WHERE batch_id = ? AND status = 'BATCHED'`, [batchId], (err, orders) => {
    if (!orders || orders.length === 0) return res.json({ ok: false });
    const orderIds = orders.map(o => o.order_id);
    const placeholders = orderIds.map(() => '?').join(',');
    db.all(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`, orderIds, (err, allItems) => {
      db.all(`SELECT * FROM product_lots WHERE quantity > 0`, [], (err, lots) => {
        const pickPlan = calculateFefoPlan(allItems, lots, todayStr);
        db.serialize(() => {
          pickPlan.forEach(item => {
            item.allocations.forEach(alloc => {
              db.run(`UPDATE product_lots SET quantity = quantity - ? WHERE lot_id = ?`, [alloc.pick_qty, alloc.lot_id]);
              db.run(`UPDATE products SET total_quantity = total_quantity - ?, updated_at = ? WHERE product_id = ?`, [alloc.pick_qty, thaiTime, item.product_id]);
            });
          });
          db.run(`UPDATE orders SET status = 'SHIPPED', shipped_at = ? WHERE batch_id = ?`, [thaiTime, batchId]);
          db.run(`INSERT INTO activity_logs (timestamp, ticket_id, username, action, details) VALUES (?, ?, ?, ?, ?)`, [thaiTime, ticketId, username, 'BATCH_ORDER_SHIPPED', `ตัดสต็อกรอบจัดส่ง ${batchId}`], () => res.json({ ok: true }));
        });
      });
    });
  });
});

app.post('/api/internal/simulate', (req, res) => {
  const thaiTime = getThaiTimestamp();
  const dateCompact = thaiTime.slice(0, 10).replace(/-/g, '');
  const docId = `REQ-${dateCompact}-${Math.floor(100 + Math.random() * 900)}`;
  db.run(`INSERT INTO documents (doc_id, doc_type, reference_info, destination_address, status, created_at, created_by) VALUES (?, 'INTERNAL_REQ', ?, ?, 'PENDING', ?, 'staff_portal_api')`,
    [docId, '[Marketing / PR] คุณแอน (ส่ง Media)', 'ตึกมาลีนนท์ ถ.พระราม 4 กทม.', thaiTime], () => {
      db.run(`INSERT INTO document_items (doc_id, product_id, ordered_qty) VALUES (?, 'COS-001', 5)`, [docId], () => res.json({ ok: true }));
    }
  );
});

app.get('/internal/:id/print', (req, res) => {
  const docId = req.params.id;
  const todayStr = getThaiTimestamp().slice(0, 10);
  db.get(`SELECT * FROM documents WHERE doc_id = ?`, [docId], (err, doc) => {
    db.all(`SELECT di.*, p.product_name FROM document_items di JOIN products p ON di.product_id = p.product_id WHERE di.doc_id = ?`, [docId], (err, items) => {
      db.all(`SELECT * FROM product_lots WHERE quantity > 0`, [], (err, lots) => {
        const pickPlan = calculateFefoPlan(items || [], lots || [], todayStr);
        res.send(`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>Print Requisition</title><style>body{font-family:'Sarabun',sans-serif;padding:40px;max-width:800px;margin:auto;}table{width:100%;border-collapse:collapse;margin-top:16px;}th,td{border:1px solid #000;padding:10px;}th{background:#f1f5f9;}</style></head><body><h2>ใบเบิกสินค้าภายใน - ${doc.doc_id}</h2><p><b>วัตถุประสงค์:</b> ${doc.reference_info}</p><table><thead><tr><th>รหัส</th><th>ชื่อสินค้า</th><th>ล็อต FEFO</th><th>จำนวน</th></tr></thead><tbody>${pickPlan.map(i => `<tr><td><b>${i.product_id}</b></td><td>${i.product_name}</td><td>${i.allocations.map(a => `${a.lot_number} → ${a.pick_qty}`).join('<br>')}</td><td align="center"><b>${i.req_qty}</b></td></tr>`).join('')}</table><br><button onclick="window.print()">🖨️ พิมพ์</button></body></html>`);
      });
    });
  });
});

app.post('/api/internal/:id/issue', (req, res) => {
  const docId = req.params.id;
  const username = (req.body && req.body.username) || 'cosmetic_staff01';
  const thaiTime = getThaiTimestamp();
  const todayStr = thaiTime.slice(0, 10);
  const ticketId = generateTicketId();

  db.get(`SELECT * FROM documents WHERE doc_id = ? AND status = 'PENDING'`, [docId], (err, doc) => {
    if (!doc) return res.json({ ok: false });
    db.all(`SELECT * FROM document_items WHERE doc_id = ?`, [docId], (err, items) => {
      db.all(`SELECT * FROM product_lots WHERE quantity > 0`, [], (err, lots) => {
        const pickPlan = calculateFefoPlan(items, lots, todayStr);
        db.serialize(() => {
          pickPlan.forEach(item => {
            item.allocations.forEach(alloc => {
              db.run(`UPDATE product_lots SET quantity = quantity - ? WHERE lot_id = ?`, [alloc.pick_qty, alloc.lot_id]);
              db.run(`UPDATE products SET total_quantity = total_quantity - ?, updated_at = ? WHERE product_id = ?`, [alloc.pick_qty, thaiTime, item.product_id]);
            });
            db.run(`UPDATE document_items SET received_qty = ? WHERE item_id = ?`, [item.req_qty, item.item_id]);
          });
          db.run(`UPDATE documents SET status = 'COMPLETED', completed_at = ? WHERE doc_id = ?`, [thaiTime, docId]);
          db.run(`INSERT INTO activity_logs (timestamp, ticket_id, username, action, details) VALUES (?, ?, ?, ?, ?)`, [thaiTime, ticketId, username, 'INTERNAL_REQUISITION', `จ่ายสินค้าใบเบิกภายใน ${docId}`], () => res.json({ ok: true }));
        });
      });
    });
  });
});

app.post('/api/returns/simulate', (req, res) => {
  const thaiTime = getThaiTimestamp();
  const dateCompact = thaiTime.slice(0, 10).replace(/-/g, '');
  const orderId = `RET-${dateCompact}-${Math.floor(100 + Math.random() * 900)}`;
  db.run(`INSERT INTO orders VALUES (?, 'Shopee Mall', 'คุณกมล ญาณisara', '085-999-8877', '45/2 ถ.พุทธมณฑล สาย 4 นครปฐม 73170', 'PAID', 0, 'BATCH-20261118-1000', 'SHIPPED', ?, ?)`,
    [orderId, thaiTime, thaiTime], () => {
      db.run(`INSERT INTO order_items (order_id, product_id, quantity) VALUES (?, 'COS-001', 2)`, [orderId], () => res.json({ ok: true }));
    }
  );
});

app.post('/api/returns/process', (req, res) => {
  const { original_order_id, reason_type, status, note, username } = req.body;
  const thaiTime = getThaiTimestamp();
  const ticketId = generateTicketId();
  const fullNote = `[${reason_type}] ${note || ''}`;

  db.all(`SELECT product_id, quantity FROM order_items WHERE order_id = ?`, [original_order_id], (err, items) => {
    items = items || [];
    if (items.length === 0) return res.json({ ok: false });
    db.serialize(() => {
      items.forEach(item => {
        db.run(`INSERT INTO product_returns (original_order_id, product_id, quantity, status, note, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [original_order_id, item.product_id, item.quantity, status, fullNote, thaiTime, username || 'cosmetic_staff01']);
        const col = status === 'GOOD' ? 'total_quantity' : 'quarantine_quantity';
        const statusText = status === 'GOOD' ? 'สภาพดี (คืนคลังพร้อมขาย)' : 'ชำรุด (เข้า Quarantine Zone)';
        db.run(`UPDATE products SET ${col} = ${col} + ?, updated_at = ? WHERE product_id = ?`, [item.quantity, thaiTime, item.product_id]);
        db.run(`INSERT INTO activity_logs (timestamp, ticket_id, username, action, details) VALUES (?, ?, ?, ?, ?)`,
          [thaiTime, ticketId, username || 'cosmetic_staff01', 'RETURN_PROCESS', `รับพัสดุตีกลับ Order: ${original_order_id} | SKU: ${item.product_id} | ผลตรวจ: ${statusText} | สาเหตุ: ${fullNote}`]);
      });
      res.json({ ok: true });
    });
  });
});

const XLSX = require('xlsx');

app.get('/api/export-excel', (req, res) => {
  const tables = [
    'products',
    'product_lots',
    'documents',
    'document_items',
    'orders',
    'order_items',
    'product_returns',
    'activity_logs'
  ];
});

app.listen(PORT, () => {
  console.log(`Vanitory WMS Server running on http://localhost:${PORT}`);
});