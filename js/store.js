// softlight Finance — ข้อมูล: เก็บในเครื่อง (ใช้ได้แม้ออฟไลน์) + ซิงก์ไป Google Drive เมื่อเข้าสู่ระบบ
//   ซิงก์แบบรวมรายการ: แต่ละรายการมี updatedAt — ใหม่กว่าชนะ · ลบ = ทำเครื่องหมาย deleted (ไม่หายจากเครื่องอื่น)
//   เลขที่เอกสาร: QT/INV/RC-ปี พ.ศ.-ลำดับ (รันต่อเนื่องแยกตามประเภทและปี)

const Store = (() => {
  const KEY = 'fin-data-v1', OLD_QUOTE_KEY = 'softlight-quotes-v1';
  const COLL = ['docs', 'customers', 'subs', 'catalog'];
  const DEFAULT_SELLER = { name: 'softlight', owner: 'Oannob Aphairun', addr: '', taxId: '', branch: '', phone: '', email: '', bank: '', vatReg: false };
  const blank = () => ({ v: 1, seller: Object.assign({}, DEFAULT_SELLER), sellerAt: 0, settings: { whtRate: 3, dueDays: 7, validDays: 30, terms: {} }, settingsAt: 0, seq: {}, docs: {}, customers: {}, subs: {}, catalog: {}, updatedAt: 0 });

  let D = load(), syncState = { status: 'local', at: 0, error: '' }, remoteAt = null, saveTimer = 0, syncing = null, dirty = false;
  const listeners = new Set();
  const emit = () => listeners.forEach(f => { try { f(syncState); } catch (e) {} });

  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.v) return Object.assign(blank(), s); } catch (e) {}
    return blank();
  }
  function persistLocal() {
    try { localStorage.setItem(KEY, JSON.stringify(D)); return true; } catch (e) { return false; }
  }
  // ทุกการแก้ไข: บันทึกในเครื่องทันที แล้วซิงก์ Drive หลังหยุดพิมพ์ 1.5 วินาที
  function touch() {
    D.updatedAt = Date.now();
    const ok = persistLocal();
    dirty = true;
    if (Drive.signedIn()) { syncState = { status: 'pending', at: syncState.at }; emit(); clearTimeout(saveTimer); saveTimer = setTimeout(() => sync().catch(() => {}), 1500); }
    else { syncState = { status: ok ? 'local' : 'error', at: Date.now(), error: ok ? '' : 'บันทึกในเครื่องไม่ได้' }; emit(); }
  }

  // ----- รวมข้อมูลสองฝั่ง -----
  function merge(a, b) {
    const out = blank();
    out.seller = (b.sellerAt || 0) > (a.sellerAt || 0) ? b.seller : a.seller; out.sellerAt = Math.max(a.sellerAt || 0, b.sellerAt || 0);
    out.settings = (b.settingsAt || 0) > (a.settingsAt || 0) ? b.settings : a.settings; out.settingsAt = Math.max(a.settingsAt || 0, b.settingsAt || 0);
    out.seq = Object.assign({}, a.seq);
    Object.keys(b.seq || {}).forEach(k => { out.seq[k] = Math.max(out.seq[k] || 0, b.seq[k]); });
    COLL.forEach(c => {
      out[c] = Object.assign({}, a[c] || {});
      Object.values(b[c] || {}).forEach(r => { const x = out[c][r.id]; if (!x || (r.updatedAt || 0) > (x.updatedAt || 0)) out[c][r.id] = r; });
    });
    out.updatedAt = Math.max(a.updatedAt || 0, b.updatedAt || 0);
    return out;
  }
  // ซิงก์: ดึงของบน Drive ถ้ามีการเปลี่ยนจากเครื่องอื่น → รวม → อัปโหลด
  async function sync() {
    if (!Drive.signedIn()) return;
    if (syncing) { await syncing; if (!dirty) return; }
    syncing = (async () => {
      syncState = { status: 'syncing', at: syncState.at }; emit();
      try {
        const rm = await Drive.remoteModified();
        let changed = false;
        if (rm && rm !== remoteAt) {
          const r = await Drive.loadData();
          if (r && r.data && r.data.v) { const before = JSON.stringify(D); D = merge(D, r.data); changed = JSON.stringify(D) !== before; }
        }
        dirty = false;
        remoteAt = await Drive.saveData(D);
        persistLocal();
        syncState = { status: 'synced', at: Date.now() }; emit();
        if (changed) listeners.forEach(f => { try { f(syncState, true); } catch (e) {} });
      } catch (e) {
        syncState = { status: 'error', at: syncState.at, error: e.message }; emit();
        throw e;
      } finally { syncing = null; }
    })();
    return syncing;
  }
  // เข้าสู่ระบบแล้ว: ดึงข้อมูล Drive มารวมกับในเครื่อง (ครั้งแรกจะอัปข้อมูลในเครื่องขึ้นไป)
  async function connect() {
    remoteAt = null; dirty = true;
    await sync();
  }
  function disconnect() { clearTimeout(saveTimer); remoteAt = null; syncState = { status: 'local', at: Date.now() }; emit(); }
  // ซิงก์ซ้ำเมื่อกลับมาที่แอป (อาจแก้จากอีกเครื่อง)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Drive.signedIn()) sync().catch(() => {}); });

  // ----- เลขที่เอกสาร -----
  function nextNo(type, date) {
    const k = `${DOC_TYPES[type].prefix}-${thYear(date)}`;
    // กันเลขซ้ำกับที่มีอยู่ (เช่น นำเข้าข้อมูล/แก้มือ)
    const used = Object.values(D.docs).filter(d => !d.deleted && d.no && d.no.startsWith(k + '-')).map(d => Number(d.no.slice(k.length + 1)) || 0);
    const n = Math.max(D.seq[k] || 0, ...used, 0) + 1;
    D.seq[k] = n;
    return `${k}-${String(n).padStart(4, '0')}`;
  }

  // ----- รายการ -----
  const list = c => Object.values(D[c]).filter(r => !r.deleted);
  const get = (c, id) => { const r = D[c][id]; return r && !r.deleted ? r : null; };
  function put(c, r) { r.updatedAt = Date.now(); if (!r.createdAt) r.createdAt = r.updatedAt; D[c][r.id] = r; touch(); return r; }
  function remove(c, id) { const r = D[c][id]; if (!r) return; D[c][id] = { id, deleted: true, updatedAt: Date.now() }; touch(); }
  function setSeller(s) { D.seller = Object.assign({}, D.seller, s); D.sellerAt = Date.now(); touch(); }
  function setSettings(s) { D.settings = Object.assign({}, D.settings, s); D.settingsAt = Date.now(); touch(); }

  // ----- นำเข้าใบเสนอราคาจากโปรแกรมเดิม (bysoftlight.github.io/quotation — โดเมนเดียวกัน อ่าน localStorage ได้) -----
  function oldQuotes() {
    try { const s = JSON.parse(localStorage.getItem(OLD_QUOTE_KEY) || 'null'); return s && s.docs ? s : null; } catch (e) { return null; }
  }
  function importOldQuotes() {
    const s = oldQuotes(); if (!s) return 0;
    const have = new Set(Object.values(D.docs).map(d => d.importedFrom).filter(Boolean));
    let n = 0;
    Object.values(s.docs).forEach(q => {
      if (have.has(q.id)) return;
      const cust = findOrCreateCustomer(q.customer || {});
      const terms = [q.terms, q.showServices && q.services ? 'บริการดูแลระบบ: ' + String(q.services).split('\n').join(' / ') : '', q.showAddons && q.addons ? 'ฟังก์ชันเสริม: ' + String(q.addons).split('\n').join(' / ') : ''].filter(Boolean).join('\n');
      const doc = { id: uid(), type: 'QT', no: q.no, date: q.date, validDays: q.validDays || 30, status: 'sent', badge: q.badge || '', title: q.title, intro: q.intro,
        customerId: cust ? cust.id : '', customer: q.customer || {}, items: (q.items || []).map(it => ({ t: it.t, d: it.d, qty: it.qty, unit: it.unit, price: it.price })),
        discount: q.discount || 0, discountType: q.discountType || 'amount', discountLabel: q.discountLabel || 'ส่วนลด',
        vat: !!(q.seller && q.seller.vatReg), vatIncl: false, wht: !!q.withholding, whtRate: 3, terms, category: 'software', importedFrom: q.id, payments: [] };
      put('docs', doc); n++;
    });
    if (s.seller && !D.sellerAt) setSeller(Object.assign({}, s.seller));
    return n;
  }
  function findOrCreateCustomer(c) {
    if (!c || !c.name) return null;
    const key = String(c.name).trim().toLowerCase();
    const ex = list('customers').find(x => String(x.name).trim().toLowerCase() === key);
    if (ex) return ex;
    return put('customers', { id: uid(), name: c.name, addr: c.addr || '', taxId: c.taxId || '', branch: c.branch || '', attn: c.attn || '', email: c.email || '', phone: c.phone || c.contact || '' });
  }

  // ----- สำรอง/กู้คืนเป็นไฟล์ -----
  function exportJson() { return JSON.stringify(D, null, 1); }
  function importJson(text) {
    const o = JSON.parse(text);
    if (!o || !o.v || !o.docs) throw new Error('ไม่ใช่ไฟล์ข้อมูล softlight Finance');
    D = merge(D, o); touch();
  }

  return {
    data: () => D, list, get, put, remove, nextNo, setSeller, setSettings, findOrCreateCustomer,
    connect, disconnect, sync, state: () => syncState, onChange: f => listeners.add(f),
    oldQuotes, importOldQuotes, exportJson, importJson, _merge: merge
  };
})();
