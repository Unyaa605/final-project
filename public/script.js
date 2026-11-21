let state = {
  loggedIn: false,
  username: 'cosmetic_staff01',
  role: 'staff', // 'staff' | 'admin'
  page: 'dashboard',
  subId: null,
  activeOrderTab: 'tabPending',
  activeReturnTab: 'tabReturnQueue',
  badges: { inbound: 0, orders: 0, internal: 0, returns: 0 }
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    state.username = document.getElementById('loginUsername').value.trim() || 'cosmetic_staff01';
    state.role = document.getElementById('loginRole').value;
    state.loggedIn = true;
    document.getElementById('loginScreen').classList.add('hidden');
    applyRoleMenuVisibility();
    renderHeaderRole();
    loadPage('dashboard');
  });
});

function logout() {
  state.loggedIn = false;
  document.getElementById('loginScreen').classList.remove('hidden');
}

function switchRole() {
  state.role = state.role === 'staff' ? 'admin' : 'staff';
  if (state.role === 'staff' && state.page === 'admin') {
    state.page = 'dashboard';
    state.subId = null;
  }
  applyRoleMenuVisibility();
  renderHeaderRole();
  loadPage(state.page, state.subId);
}

function applyRoleMenuVisibility() {
  const auditItem = document.querySelector('#sidebarMenu li[data-role-only="admin"]');
  if (auditItem) {
    auditItem.style.display = state.role === 'admin' ? 'block' : 'none';
  }
}

function renderHeaderRole() {
  const el = document.getElementById('roleIndicator');
  const color = state.role === 'admin' ? '#d97706' : '#0284c7';
  const label = state.role === 'admin'
    ? `🛡️ ผู้ตรวจสอบ (Auditor - Read Only) (${state.username})`
    : `🧑‍💻 พนักงานคลัง (Staff) (${state.username})`;
  el.innerHTML = `สิทธิ์การใช้งาน: <b style="color:${color};">${label}</b>`;
}

function navigateTo(page, event) {
  if (event) event.preventDefault();
  loadPage(page, null);
}

function setActiveNav(page) {
  document.querySelectorAll('#sidebarMenu li').forEach(li => {
    li.classList.toggle('active', li.dataset.page === page);
  });
}

function updateBadgesUI(badges) {
  state.badges = badges;
  const map = { inbound: badges.inbound, orders: badges.orders, internal: badges.internal, returns: badges.returns };
  Object.keys(map).forEach(k => {
    const target = document.getElementById(`badge-${k}`);
    if (target) {
      target.innerHTML = map[k] > 0 ? `<span class="badge-alert">${map[k]}</span>` : '';
    }
  });
}

function openCenterConfirm(title, message, onConfirmCallback, icon = '⚠️', showCancel = true) {
  document.getElementById('modalTitle').innerText = title;
  document.getElementById('modalBodyText').innerText = message;
  document.getElementById('modalIcon').innerText = icon;

  const cancelBtn = document.getElementById('modalCancelBtn');
  cancelBtn.style.display = showCancel ? 'inline-block' : 'none';

  const okBtn = document.getElementById('modalOkBtn');
  okBtn.onclick = function () {
    closeCenterModal();
    if (onConfirmCallback) onConfirmCallback();
  };

  document.getElementById('globalCenterModal').classList.add('active');
}

function closeCenterModal() {
  document.getElementById('globalCenterModal').classList.remove('active');
}

function getEtaBadgeHtml(etaDateStr, todayStr) {
  if (!etaDateStr || etaDateStr === '-') return `<span style="color:#94a3b8;">-</span>`;
  const today = new Date(`${todayStr}T00:00:00`);
  const eta = new Date(`${etaDateStr}T00:00:00`);
  const diffDays = Math.round((eta - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `<span class="badge badge-warning">⚠️ เลยกำหนด ETA (${Math.abs(diffDays)} วัน)</span>`;
  if (diffDays === 0) return `<span class="badge badge-cod">🚨 ส่งเข้าคลังวันนี้!</span>`;
  if (diffDays <= 3) return `<span class="badge badge-pending">⏳ ใกล้ถึง ETA (อีก ${diffDays} วัน)</span>`;
  return `<span class="badge badge-lot">อีก ${diffDays} วัน</span>`;
}

async function loadPage(page, subId = null) {
  state.page = page;
  state.subId = subId;
  setActiveNav(page);

  const res = await fetch(`/api/page/${page}${subId ? `?id=${encodeURIComponent(subId)}` : ''}`);
  const data = await res.json();
  updateBadgesUI(data.badges);
  document.getElementById('pageHeaderTitle').innerText = data.headerTitle;

  const body = document.getElementById('contentBody');
  if (page === 'dashboard') renderDashboard(body, data);
  else if (page === 'stock') renderStock(body, data);
  else if (page === 'inbound' && !subId) renderInboundList(body, data);
  else if (page === 'inbound' && subId) renderInboundDetail(body, data);
  else if (page === 'orders') renderOrders(body, data);
  else if (page === 'internal' && !subId) renderInternalList(body, data);
  else if (page === 'internal' && subId) renderInternalDetail(body, data);
  else if (page === 'returns' && !subId) renderReturnsList(body, data);
  else if (page === 'returns' && subId) renderReturnDetail(body, data);
  else if (page === 'admin') renderAdmin(body, data);
}

// --- 1. Dashboard ---
function renderDashboard(body, data) {
  const todayDate = new Date(`${data.todayStr}T00:00:00`);
  body.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
      <div class="card kpi-card" style="margin:0;" onclick="loadPage('stock')">
        <div style="font-size:13px; color:#64748b; font-weight:600;">📦 สต็อกพร้อมขายรวม</div>
        <div style="font-size:26px; font-weight:bold; color:#16a34a; margin-top:6px;">${data.totalStock} ชิ้น</div>
      </div>
      <div class="card kpi-card" style="margin:0;" onclick="loadPage('orders')">
        <div style="font-size:13px; color:#64748b; font-weight:600;">🚚 ออร์เดอร์รอตัดรอบ</div>
        <div style="font-size:26px; font-weight:bold; color:#d97706; margin-top:6px;">${data.badges.orders} ออร์เดอร์</div>
      </div>
      <div class="card kpi-card" style="margin:0;" onclick="loadPage('internal')">
        <div style="font-size:13px; color:#64748b; font-weight:600;">🏢 ใบเบิกภายในรอจ่าย</div>
        <div style="font-size:26px; font-weight:bold; color:#0284c7; margin-top:6px;">${data.badges.internal} ใบเบิก</div>
      </div>
      <div class="card kpi-card" style="margin:0;" onclick="loadPage('returns')">
        <div style="font-size:13px; color:#64748b; font-weight:600;">🔄 พัสดุตีกลับรอตรวจรับ</div>
        <div style="font-size:26px; font-weight:bold; color:#b91c1c; margin-top:6px;">${data.badges.returns} กล่อง</div>
      </div>
    </div>

    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <div>
          <h3 style="margin:0; color:#1e293b;">⏳ ล็อตสินค้าที่ใกล้หมดอายุ (Near-Expiry / FEFO Watch)</h3>
          <p style="color:#64748b; font-size:13px; margin:4px 0 0 0;">เรียงลำดับตามวันหมดอายุใกล้สุดก่อน เพื่อจัดสรรการหยิบจ่ายตามหลัก FEFO</p>
        </div>
        <button class="btn btn-outline" style="font-size:12px;" onclick="loadPage('stock')">ดูสต็อกทั้งหมด →</button>
      </div>
      <table>
        <thead>
          <tr><th>รหัสสินค้า</th><th>ชื่อสินค้า</th><th>เลขล็อต (Lot)</th><th>วันหมดอายุ (EXP)</th><th>สถานะอายุสินค้า</th><th>คงเหลือในล็อต</th></tr>
        </thead>
        <tbody>
          ${data.nearExpiryLots.length === 0 ? `<tr><td colspan="6" style="text-align:center; color:#94a3b8;">ไม่มีข้อมูลล็อตสินค้าในคลัง</td></tr>` : ''}
          ${data.nearExpiryLots.map(l => {
            const diffDays = Math.ceil((new Date(`${l.exp_date}T00:00:00`) - todayDate) / (1000 * 60 * 60 * 24));
            let badge = `<span class="badge badge-completed">ปกติ (เหลือ ${diffDays} วัน)</span>`;
            if (diffDays <= 60) badge = `<span class="badge badge-warning">⚠️ ใกล้หมดอายุ (${diffDays} วัน)</span>`;
            else if (diffDays <= 120) badge = `<span class="badge badge-pending">⏳ เฝ้าระวัง (${diffDays} วัน)</span>`;
            return `<tr><td><b>${l.product_id}</b></td><td>${l.product_name}</td><td><span class="badge badge-lot">${l.lot_number}</span></td><td><b>${l.exp_date}</b></td><td>${badge}</td><td><b>${l.quantity} ชิ้น</b></td></tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// --- 2. Stock ---
function renderStock(body, data) {
  body.innerHTML = `
    <div class="card">
      <h2>📦 สต็อกสินค้าและล็อตตามหลัก FEFO & Quarantine Zone</h2>
      <table>
        <thead><tr><th>รหัสสินค้า</th><th>ชื่อสินค้า</th><th>รายละเอียดล็อต (เรียงตาม EXP ใกล้สุดก่อน)</th><th>พร้อมขาย</th><th>Quarantine</th></tr></thead>
        <tbody>
          ${data.products.map(p => {
            const pLots = data.lots.filter(l => l.product_id === p.product_id);
            return `
              <tr>
                <td><b>${p.product_id}</b></td><td>${p.product_name}</td>
                <td>${pLots.length === 0 ? `<span style="color:#94a3b8;">ไม่มีสต็อกในล็อต</span>` : pLots.map(l => `<div style="margin-bottom:4px;"><span class="badge badge-lot">Lot: ${l.lot_number}</span> คงเหลือ: <b>${l.quantity}</b> ชิ้น (EXP: ${l.exp_date})</div>`).join('')}</td>
                <td><b style="color:#16a34a; font-size:15px;">${p.total_quantity} ชิ้น</b></td>
                <td><b style="color:#d97706; font-size:15px;">${p.quarantine_quantity || 0} ชิ้น</b></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// --- 3. Inbound ---
function renderInboundList(body, data) {
  const nearCount = data.docs.filter(d => {
    if (d.status !== 'PENDING' || !d.eta_date) return false;
    const diff = Math.round((new Date(`${d.eta_date}T00:00:00`) - new Date(`${data.todayStr}T00:00:00`)) / (1000 * 60 * 60 * 24));
    return diff <= 3;
  }).length;

  body.innerHTML = `
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:12px;">
        <div>
          <h2 style="margin:0;">📥 รายการใบสั่งซื้อรอตรวจรับเข้าคลัง (Goods Receipt)</h2>
          <p style="color:#64748b; font-size:13px; margin:4px 0 0 0;">ตรวจสอบกำหนดส่งเข้าคลัง (ETA) และคลิกเลขที่ PO เพื่อบันทึกผลตรวจรับ</p>
        </div>
        ${state.role === 'staff' ? `<button class="btn btn-outline" onclick="simulateInboundPo()">+ จำลองใบสั่งซื้อ (PO) เข้าใหม่</button>` : ''}
      </div>
      ${nearCount > 0 ? `<div class="alert-banner"><span>🔔</span><div><b>แจ้งเตือนกำหนดส่งเข้าคลัง:</b> มีใบสั่งซื้อ (PO) ที่ถึงกำหนดส่งวันนี้หรือใกล้ถึง ETA จำนวน <b>${nearCount} รายการ</b> กรุณาเตรียมพื้นที่รับสินค้า</div></div>` : ''}
      <table>
        <thead><tr><th>เลขที่ PO</th><th>ซัพพลายเออร์</th><th>ETA</th><th>แจ้งเตือนกำหนดส่ง</th><th>สถานะ</th><th>พิมพ์ใบตรวจรับ</th></tr></thead>
        <tbody>
          ${data.docs.map(doc => {
            let statusBadge = `<span class="badge badge-pending">PENDING</span>`;
            if (doc.status === 'COMPLETED') {
              statusBadge = doc.discrepancy_note ? `<span class="badge badge-warning">COMPLETED (มีส่วนต่าง)</span>` : `<span class="badge badge-completed">COMPLETED (ครบถ้วน)</span>`;
            }
            const etaBadge = doc.status === 'PENDING' ? getEtaBadgeHtml(doc.eta_date, data.todayStr) : `<span style="color:#94a3b8;">รับแล้ว</span>`;
            return `
              <tr>
                <td><a href="#inbound/${doc.doc_id}" style="color:#0284c7; text-decoration:none; font-weight:bold;" onclick="event.preventDefault(); loadPage('inbound', '${doc.doc_id}')">${doc.doc_id} 🔍</a></td>
                <td>${doc.reference_info}</td>
                <td>${doc.eta_date || '-'}</td>
                <td>${etaBadge}</td>
                <td>${statusBadge}</td>
                <td><a href="/inbound/${doc.doc_id}/print" target="_blank" class="btn btn-outline" style="font-size:12px; padding:6px 12px;">🖨️ พิมพ์ PDF</a></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function simulateInboundPo() {
  await fetch('/api/inbound/simulate', { method: 'POST' });
  loadPage('inbound');
}

function renderInboundDetail(body, data) {
  const doc = data.doc;
  const isPending = doc.status === 'PENDING' && state.role === 'staff';
  body.innerHTML = `
    <div class="card">
      <button class="btn btn-secondary" style="margin-bottom:16px;" onclick="loadPage('inbound')">← กลับ</button>
      <h2>📥 รายละเอียดใบ PO: <span style="color:#0284c7;">${doc.doc_id}</span></h2>
      <p style="color:#475569; font-size:13px; margin-top:4px;"><b>ซัพพลายเออร์:</b> ${doc.reference_info} | <b>กำหนดส่ง (ETA):</b> ${doc.eta_date || '-'}</p>
      <form id="inboundApiForm">
        <input type="hidden" name="doc_id" value="${doc.doc_id}">
        ${isPending ? `
          <div style="background:#eff6ff; padding:16px; border-radius:6px; margin-bottom:20px; border:1px solid #bfdbfe;">
            <div style="display:flex; gap:16px; margin-bottom:12px;">
              <div style="flex:1;"><label><b>DO No.: *</b></label><br><input type="text" name="delivery_note_no" required style="width:100%; margin-top:4px; background:white;"></div>
              <div style="flex:1;"><label><b>ผู้ตรวจรับ: *</b></label><br><input type="text" name="received_by" value="${state.username}" required style="width:100%; margin-top:4px; background:white;"></div>
            </div>
            <div><label><b>หมายเหตุส่วนต่าง / สาเหตุของเสีย:</b></label><br><textarea name="discrepancy_note" rows="2" placeholder="ระบุกรณีรับของไม่ครบ เกิน หรือมีสินค้าชำรุดบุบส่งเข้า Quarantine" style="width:100%; margin-top:4px; background:white;"></textarea></div>
          </div>
        ` : ''}
        <table>
          <thead><tr><th>รหัส</th><th>ชื่อสินค้า</th><th>ยอดสั่ง</th>${isPending ? `<th>Lot *</th><th>EXP *</th><th>รับจริง *</th><th>Quarantine (เสีย/บุบ)</th><th>เข้าพร้อมขายจริง</th>` : `<th>รับจริง</th>`}</tr></thead>
          <tbody>
            ${data.items.map((item, idx) => `
              <tr>
                <td><b>${item.product_id}</b></td><td>${item.product_name}</td><td><b>${item.ordered_qty} ชิ้น</b></td>
                ${isPending ? `
                  <td><input type="text" name="lot_number" required style="width:130px;"></td>
                  <td><input type="date" name="exp_date" required style="width:145px;"></td>
                  <td><input type="number" name="received_qty" id="recv_${idx}" value="${item.ordered_qty}" min="0" required style="width:100px;" oninput="recalcInbound(${idx})"></td>
                  <td><input type="number" name="quarantine_qty" id="dam_${idx}" value="0" min="0" style="width:110px;" oninput="recalcInbound(${idx})"></td>
                  <td><b id="good_${idx}" style="color:#16a34a; font-size:15px;">${item.ordered_qty} ชิ้น</b></td>
                ` : `<td><b>${item.received_qty} ชิ้น</b></td>`}
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${isPending ? `<br><button type="submit" class="btn btn-success">✅ ยืนยันตรวจรับเข้าคลัง</button>` : ''}
      </form>
    </div>
  `;

  if (isPending) {
    document.getElementById('inboundApiForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const recvVal = parseInt(fd.get('received_qty') || 0, 10);
      const damVal = parseInt(fd.get('quarantine_qty') || 0, 10);
      if (damVal < 0 || recvVal < 0) {
        openCenterConfirm('ข้อมูลไม่ถูกต้อง', 'จำนวนรับจริงและจำนวนเข้า Quarantine ต้องไม่ติดลบครับ', null, '⚠️', false);
        return;
      }
      if (damVal > recvVal) {
        openCenterConfirm('จำนวนเกินยอดรับจริง', `จำนวนสินค้าเสีย/บุบเข้า Quarantine (${damVal} ชิ้น) มากกว่าจำนวนที่รับจริง (${recvVal} ชิ้น)`, null, '⚠️', false);
        return;
      }
      const goodVal = recvVal - damVal;
      openCenterConfirm('ยืนยันตรวจรับ', `ยืนยันบันทึก PO นี้ใช่หรือไม่? (เข้าพร้อมขาย: ${goodVal} ชิ้น | เข้า Quarantine: ${damVal} ชิ้น)`, async () => {
        await fetch('/api/inbound/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.fromEntries(fd.entries()))
        });
        loadPage('stock');
      }, '📥', true);
    });
  }
}

function recalcInbound(idx) {
  const r = parseInt(document.getElementById(`recv_${idx}`).value || 0, 10);
  const d = parseInt(document.getElementById(`dam_${idx}`).value || 0, 10);
  document.getElementById(`good_${idx}`).innerText = `${Math.max(0, r - d)} ชิ้น`;
}

// --- 4. Orders ---
function renderOrders(body, data) {
  body.innerHTML = `
    <div class="tab-nav">
      <button class="tab-btn ${state.activeOrderTab === 'tabPending' ? 'active' : ''}" onclick="switchOrderTab('tabPending')">📥 ออร์เดอร์รอตัดรอบ (${data.pendingCutoffOrders.length})</button>
      <button class="tab-btn ${state.activeOrderTab === 'tabBatches' ? 'active' : ''}" onclick="switchOrderTab('tabBatches')">🚚 ชุดรอบจัดส่งพัสดุ (${data.unshippedBatchesCount})</button>
    </div>

    <div id="tabPending" class="tab-pane ${state.activeOrderTab === 'tabPending' ? 'active' : ''}">
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
          <div><h3 style="margin:0;">คิวออร์เดอร์รอตัดรอบส่ง</h3><p style="color:#64748b; font-size:13px; margin:4px 0 0 0;">ออร์เดอร์ใหม่จากช่องทางออนไลน์</p></div>
          <div style="display:flex; gap:10px;">
            ${state.role === 'staff' ? `
              <button class="btn btn-outline" onclick="simulateNewOrder()">🔄 จำลองออร์เดอร์เข้าใหม่</button>
              ${data.pendingCutoffOrders.length > 0 ? `<button class="btn btn-primary" onclick="confirmCutoffBatch(${data.pendingCutoffOrders.length})">✂️ ตัดรอบส่งทั้งหมด</button>` : ''}
            ` : ''}
          </div>
        </div>
        <table>
          <thead><tr><th>เลขออร์เดอร์ / ช่องทาง</th><th>ข้อมูลผู้รับ & ที่อยู่</th><th>การชำระเงิน</th><th>รายการสินค้า</th></tr></thead>
          <tbody>
            ${data.pendingCutoffOrders.length === 0 ? `<tr><td colspan="4" style="text-align:center; color:#94a3b8;">ไม่มีออร์เดอร์ค้างรอตัดรอบ</td></tr>` : ''}
            ${data.pendingCutoffOrders.map(ord => {
              const items = data.allItems.filter(i => i.order_id === ord.order_id);
              return `<tr><td><b>${ord.order_id}</b><br><span class="badge badge-lot">${ord.channel}</span></td><td style="max-width:300px;"><b>${ord.customer_name}</b> (${ord.customer_phone})<br><span style="font-size:12px; color:#475569;">${ord.shipping_address}</span></td><td>${ord.payment_method === 'COD' ? `<span class="badge badge-cod">💵 COD: ${ord.cod_amount} ฿</span>` : `<span class="badge badge-paid">✅ โอนแล้ว</span>`}</td><td>${items.map(i => `<div style="font-size:13px;">• <b>${i.product_id}</b> (${i.product_name}) × <b>${i.quantity}</b></div>`).join('')}</td></tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div id="tabBatches" class="tab-pane ${state.activeOrderTab === 'tabBatches' ? 'active' : ''}">
      <div class="card">
        <h3 style="margin-top:0;">ชุดรอบจัดส่งพัสดุ (Shipping Batches)</h3>
        <table>
          <thead><tr><th>รหัสรอบส่ง</th><th>จำนวนออร์เดอร์</th><th>สถานะ</th><th>พิมพ์เอกสารทั้งรอบ</th><th>ตัดสต็อก</th></tr></thead>
          <tbody>
            ${data.batches.length === 0 ? `<tr><td colspan="5" style="text-align:center; color:#94a3b8;">ยังไม่มีรอบจัดส่ง</td></tr>` : ''}
            ${data.batches.map(b => `
              <tr>
                <td><b style="color:#0284c7;">${b.batch_id}</b></td><td><b>${b.orders.length} ออร์เดอร์</b></td><td>${b.status === 'BATCHED' ? '<span class="badge badge-pending">BATCHED</span>' : '<span class="badge badge-completed">SHIPPED</span>'}</td>
                <td><a href="/orders/batch/${b.batch_id}/print" target="_blank" class="btn btn-outline">🖨️ พิมพ์ Pick List + ใบปะหน้า</a></td>
                <td>
                  ${b.status === 'BATCHED' && state.role === 'staff' ? `<button class="btn btn-success" onclick="confirmShipBatch('${b.batch_id}', ${b.orders.length})">✅ ยืนยันแพ็ก & ตัดสต็อก</button>` : `<span style="color:#16a34a; font-size:13px;">✔️ เรียบร้อย</span>`}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function switchOrderTab(tabId) {
  state.activeOrderTab = tabId;
  loadPage('orders');
}

async function simulateNewOrder() {
  await fetch('/api/orders/simulate', { method: 'POST' });
  loadPage('orders');
}

function confirmCutoffBatch(count) {
  openCenterConfirm('ตัดรอบจัดส่งออร์เดอร์', `ต้องการตัดรอบออร์เดอร์ ${count} รายการใช่หรือไม่?`, async () => {
    await fetch('/api/orders/cutoff', { method: 'POST' });
    state.activeOrderTab = 'tabBatches';
    loadPage('orders');
  }, '✂️');
}

function confirmShipBatch(batchId, orderCount) {
  openCenterConfirm('ยืนยันตัดสต็อกทั้งรอบ', `ยืนยันแพ็กครบ ${orderCount} ออร์เดอร์ในรอบ ${batchId} และตัดสต็อก FEFO?`, async () => {
    await fetch(`/api/orders/batch/${encodeURIComponent(batchId)}/ship`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: state.username }) });
    loadPage('stock');
  }, '🚚');
}

// --- 5. Internal Requisition ---
function renderInternalList(body, data) {
  body.innerHTML = `
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div>
          <h3 style="margin:0;">🏢 Inbox ใบขอเบิกสินค้าใช้ภายใน</h3>
          <p style="color:#64748b; font-size:13px; margin:4px 0 0 0;">คลิกที่ "เลขที่ใบเบิก" เพื่อตรวจสอบรายละเอียดและยืนยันจ่ายสินค้า</p>
        </div>
        ${state.role === 'staff' ? `<button class="btn btn-outline" onclick="simulateInternalReq()">📥 จำลองใบขอเบิกใหม่เข้ามา</button>` : ''}
      </div>
      <table>
        <thead><tr><th>เลขที่ใบเบิก</th><th>วัตถุประสงค์ & ผู้ขอเบิก</th><th>ปลายทาง</th><th>รายการสินค้า</th><th>สถานะ</th></tr></thead>
        <tbody>
          ${data.docs.length === 0 ? `<tr><td colspan="5" style="text-align:center; color:#94a3b8;">ไม่มีใบขอเบิกค้างดำเนินการ</td></tr>` : ''}
          ${data.docs.map(d => {
            const items = data.allItems.filter(i => i.doc_id === d.doc_id);
            return `
              <tr>
                <td><a href="#internal/${d.doc_id}" style="color:#0284c7; text-decoration:none; font-weight:bold;" onclick="event.preventDefault(); loadPage('internal', '${d.doc_id}')">${d.doc_id} 🔍</a></td>
                <td><b>${d.reference_info}</b></td>
                <td>${d.destination_address || '-'}</td>
                <td>${items.map(i => `${i.product_id} x ${i.ordered_qty}`).join(', ')}</td>
                <td>${d.status === 'PENDING' ? '<span class="badge badge-pending">PENDING</span>' : '<span class="badge badge-completed">ISSUED</span>'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function simulateInternalReq() {
  await fetch('/api/internal/simulate', { method: 'POST' });
  loadPage('internal');
}

function renderInternalDetail(body, data) {
  const doc = data.doc;
  const isPending = doc.status === 'PENDING' && state.role === 'staff';
  body.innerHTML = `
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
        <button class="btn btn-secondary" onclick="loadPage('internal')">← กลับหน้ารายการเบิกภายใน</button>
        <a href="/internal/${doc.doc_id}/print" target="_blank" class="btn btn-outline">🖨️ พิมพ์ใบเบิก PDF</a>
      </div>
      <h2 style="margin-top:0;">🏢 รายละเอียดใบเบิกสินค้าภายใน: <span style="color:#0284c7;">${doc.doc_id}</span></h2>
      <div style="background:#f8fafc; padding:16px; border-radius:6px; margin-bottom:20px; border:1px solid #e2e8f0;">
        <p style="margin:0 0 6px 0;"><b>วัตถุประสงค์ & ผู้ขอเบิก:</b> ${doc.reference_info}</p>
        <p style="margin:0 0 6px 0;"><b>ที่อยู่ปลายทาง:</b> ${doc.destination_address || '-'}</p>
        <p style="margin:0;"><b>สถานะ:</b> ${doc.status === 'PENDING' ? '<span class="badge badge-pending">PENDING (รอจ่ายของ)</span>' : '<span class="badge badge-completed">ISSUED (จ่ายของแล้ว)</span>'}</p>
      </div>
      <table>
        <thead><tr><th>รหัสสินค้า</th><th>ชื่อสินค้า</th><th>แผนการหยิบตาม FEFO</th><th>จำนวนที่ขอเบิก</th></tr></thead>
        <tbody>
          ${data.pickPlan.map(item => `
            <tr>
              <td><b>${item.product_id}</b></td>
              <td>${item.product_name}</td>
              <td>${item.allocations.length === 0 ? `<span style="color:#94a3b8;">ไม่มีล็อตพร้อมจ่าย</span>` : item.allocations.map(a => `<div style="margin-bottom:2px;"><span class="badge badge-lot">${a.lot_number}</span> (EXP: ${a.exp_date}) → <b>${a.pick_qty}</b> ชิ้น</div>`).join('')}</td>
              <td><b>${item.req_qty} ชิ้น</b></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${isPending ? `<button class="btn btn-success" style="margin-top:20px; padding:10px 22px; font-size:14px;" onclick="confirmIssueInternal('${doc.doc_id}')">✅ ยืนยันจ่ายของและตัดสต็อก</button>` : ''}
    </div>
  `;
}

function confirmIssueInternal(docId) {
  openCenterConfirm('ยืนยันจ่ายสินค้าภายใน', `ยืนยันจ่ายของตามใบเบิก ${docId} และตัดสต็อก FEFO ใช่หรือไม่?`, async () => {
    await fetch(`/api/internal/${encodeURIComponent(docId)}/issue`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: state.username }) });
    loadPage('stock');
  }, '🏢');
}

// --- 6. Returns ---
function renderReturnsList(body, data) {
  body.innerHTML = `
    <div class="tab-nav">
      <button class="tab-btn ${state.activeReturnTab === 'tabReturnQueue' ? 'active' : ''}" onclick="switchReturnTab('tabReturnQueue')">📥 พัสดุตีกลับรอตรวจรับ (${data.returnQueue.length})</button>
      <button class="tab-btn ${state.activeReturnTab === 'tabReturnHistory' ? 'active' : ''}" onclick="switchReturnTab('tabReturnHistory')">📜 ประวัติการรับคืนสินค้า (${data.returnHistory.length})</button>
    </div>

    <div id="tabReturnQueue" class="tab-pane ${state.activeReturnTab === 'tabReturnQueue' ? 'active' : ''}">
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
          <div><h3 style="margin:0; color:#1e293b;">รายการพัสดุตีกลับจากขนส่ง (Return Queue)</h3><p style="color:#64748b; font-size:13px; margin:4px 0 0 0;">คลิกที่ "เลขออร์เดอร์" เพื่อตรวจสอบสินค้าภายในกล่องและบันทึกผลการตรวจรับ</p></div>
          ${state.role === 'staff' ? `<button class="btn btn-outline" onclick="simulateReturnItem()">🔄 จำลองพัสดุตีกลับใหม่เข้ามา</button>` : ''}
        </div>
        <table>
          <thead><tr><th>เลขออร์เดอร์ / ช่องทาง</th><th>ข้อมูลลูกค้าผู้รับ</th><th>วันที่จัดส่งออก</th><th>จัดการ</th></tr></thead>
          <tbody>
            ${data.returnQueue.length === 0 ? `<tr><td colspan="4" style="text-align:center; color:#94a3b8;">ไม่มีพัสดุตีกลับค้างตรวจสอบ</td></tr>` : ''}
            ${data.returnQueue.map(ord => `
              <tr>
                <td><b><a href="#returns/${ord.order_id}" style="color:#0284c7; text-decoration:none;" onclick="event.preventDefault(); loadPage('returns', '${ord.order_id}')">${ord.order_id} 🔍</a></b><br><span class="badge badge-lot">${ord.channel}</span></td>
                <td><b>${ord.customer_name}</b> (${ord.customer_phone})<br><span style="font-size:12px; color:#475569;">${ord.shipping_address}</span></td>
                <td>${ord.shipped_at || '-'}</td>
                <td><button class="btn btn-primary" style="font-size:12px; padding:6px 14px;" onclick="loadPage('returns', '${ord.order_id}')">🔍 ตรวจสอบและรับคืน</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div id="tabReturnHistory" class="tab-pane ${state.activeReturnTab === 'tabReturnHistory' ? 'active' : ''}">
      <div class="card">
        <h3 style="margin-top:0; color:#1e293b;">ประวัติรายการสินค้าตีกลับย้อนหลัง</h3>
        <table>
          <thead><tr><th>ออร์เดอร์เดิม</th><th>สินค้า</th><th>จำนวน</th><th>สถานะการจัดเก็บ</th><th>สาเหตุการตีกลับ & หมายเหตุ</th><th>เวลาที่รับคืน</th></tr></thead>
          <tbody>
            ${data.returnHistory.length === 0 ? `<tr><td colspan="6" style="text-align:center; color:#94a3b8;">ยังไม่มีประวัติสินค้าตีกลับ</td></tr>` : ''}
            ${data.returnHistory.map(r => `
              <tr>
                <td><b>${r.original_order_id}</b></td><td>${r.product_name} (${r.product_id})</td><td><b>${r.quantity}</b></td>
                <td>${r.status === 'GOOD' ? '<span class="badge badge-completed">✨ สภาพดี (คืนคลัง)</span>' : '<span class="badge badge-warning">⚠️ Quarantine (กักกัน)</span>'}</td>
                <td>${r.note || '-'}</td><td>${r.created_at}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function switchReturnTab(tabId) {
  state.activeReturnTab = tabId;
  loadPage('returns');
}

async function simulateReturnItem() {
  await fetch('/api/returns/simulate', { method: 'POST' });
  loadPage('returns');
}

function renderReturnDetail(body, data) {
  const ord = data.order;
  body.innerHTML = `
    <div class="card">
      <button class="btn btn-secondary" style="margin-bottom:16px;" onclick="loadPage('returns')">← กลับหน้าหลักตีกลับ</button>
      <h2>🔄 ตรวจรับพัสดุตีกลับ: <span style="color:#0284c7;">${ord.order_id}</span></h2>
      <div style="background:#eff6ff; padding:16px; border-radius:6px; margin-bottom:20px; border:1px solid #bfdbfe;">
        <p style="margin:0 0 6px 0;"><b>ช่องทางสั่งซื้อ:</b> ${ord.channel}</p>
        <p style="margin:0 0 6px 0;"><b>ลูกค้าผู้รับ:</b> ${ord.customer_name} (${ord.customer_phone})</p>
        <p style="margin:0;"><b>ที่อยู่จัดส่งเดิม:</b> ${ord.shipping_address}</p>
      </div>
      <form id="returnApiForm">
        <input type="hidden" name="original_order_id" value="${ord.order_id}">
        <div style="margin-bottom:16px; max-width:400px;">
          <label><b>สาเหตุการตีกลับ: *</b></label><br>
          <select name="reason_type" required style="width:100%; margin-top:4px;">
            <option value="ลูกค้าปฏิเสธรับพัสดุ (เปลี่ยนใจ/ติดต่อไม่ได้)">❌ ลูกค้าปฏิเสธรับพัสดุ (เปลี่ยนใจ/ติดต่อไม่ได้)</option>
            <option value="กล่องพัสดุบุบ/เสียหายรุนแรงจากขนส่ง">📦 กล่องพัสดุบุบ/เสียหายรุนแรงจากขนส่ง</option>
            <option value="ที่อยู่จัดส่งไม่ถูกต้อง/ไม่พบผู้รับ">📍 ที่อยู่จัดส่งไม่ถูกต้อง/ไม่พบผู้รับ</option>
            <option value="อื่นๆ (ระบุในหมายเหตุ)">📝 อื่นๆ (ระบุในหมายเหตุ)</option>
          </select>
        </div>
        <div style="margin-bottom:16px; max-width:400px;">
          <label><b>ผลการตรวจสภาพสินค้าในกล่อง: *</b></label><br>
          <select name="status" id="inspectStatus" required style="width:100%; margin-top:4px;">
            <option value="GOOD">✨ สภาพดี (ซีลครบ / คืนคลังพร้อมขาย)</option>
            <option value="QUARANTINE">⚠️ ชำรุดเสียหาย (ส่งเข้า Quarantine Zone)</option>
          </select>
        </div>
        <div style="margin-bottom:20px; max-width:600px;">
          <label><b>หมายเหตุเพิ่มเติม:</b></label><br>
          <input type="text" name="note" placeholder="ระบุรายละเอียดเพิ่มเติม (ถ้ามี)" style="width:100%; margin-top:4px;">
        </div>
        <table>
          <thead><tr><th>รหัสสินค้า</th><th>ชื่อสินค้า</th><th>จำนวนที่ตีกลับ</th></tr></thead>
          <tbody>${data.items.map(i => `<tr><td><b>${i.product_id}</b></td><td>${i.product_name}</td><td><b>${i.quantity} ชิ้น</b></td></tr>`).join('')}</tbody>
        </table>
        ${state.role === 'staff' ? `<br><button type="submit" class="btn btn-success" style="padding:10px 24px; font-size:15px;">✅ ยืนยันการตรวจรับและจัดเก็บเข้าคลัง</button>` : `<p style="color:#d97706;">🔒 โหมด Read-Only ไม่สามารถกดรับคืนได้</p>`}
      </form>
    </div>
  `;

  if (state.role === 'staff') {
    document.getElementById('returnApiForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(e.target).entries());
      payload.username = state.username;
      const msg = payload.status === 'GOOD' ? 'ยืนยันรับสินค้าสภาพดีกลับเข้าสต็อกพร้อมขายใช่หรือไม่?' : 'ยืนยันส่งสินค้าชำรุดเข้า Quarantine Zone ทันทีใช่หรือไม่?';
      openCenterConfirm('ยืนยันรับพัสดุตีกลับ', msg, async () => {
        await fetch('/api/returns/process', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        loadPage('returns');
      }, '🔄');
    });
  }
}

// --- 7. Audit ---
function renderAdmin(body, data) {
  body.innerHTML = `
    <div class="card">
      <h2>🛡️ ระบบตรวจสอบภายในองค์กร (Immutable Audit Trail)</h2>
      <table>
        <thead><tr><th>เวลา</th><th>Ticket ID</th><th>ผู้ใช้งาน</th><th>กิจกรรม</th><th>รายละเอียด</th></tr></thead>
        <tbody>${data.logs.map(l => `<tr><td>${l.timestamp}</td><td><span class="badge badge-lot">${l.ticket_id}</span></td><td><b>${l.username}</b></td><td><span class="badge" style="background:#0f172a; color:white;">${l.action}</span></td><td>${l.details}</td></tr>`).join('')}</tbody>
      </table>
    </div>
  `;
}