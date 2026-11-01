// softlight Finance — หน้าจอทั้งหมด
//   #home ภาพรวม · #docs เอกสาร · #doc/<id> แก้ไขเอกสาร · #customers ลูกค้า · #subs Subscription · #reports ภาษี/รายงาน · #settings ตั้งค่า

const APP_VERSION = '1.0.0';
const D = () => Store.data();
const seller = () => D().seller;
const settings = () => D().settings;
const track = (e, o) => { try { if (typeof Analytics !== 'undefined') Analytics.track(e, o); } catch (err) {} };

// ===================== UI ทั่วไป =====================
let toastTimer = 0;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('is-on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('is-on'), 2800);
}
function ask(title, text, yes = 'ตกลง', danger = false) {
  return new Promise(res => {
    const d = $('askDlg'); $('askTitle').textContent = title; $('askText').textContent = text;
    $('askYes').textContent = yes; $('askYes').className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
    const done = v => { d.close(); res(v); };
    $('askYes').onclick = () => done(true); $('askNo').onclick = () => done(false); d.oncancel = () => res(false);
    d.showModal();
  });
}
// แผ่นแก้ไข: fields = HTML · onSave(form) คืน false เพื่อไม่ปิด
function openSheet(title, body, { save = 'บันทึก', onSave, extra = '' } = {}) {
  const d = $('sheet');
  $('sheetTitle').textContent = title; $('sheetBody').innerHTML = body;
  $('sheetFoot').innerHTML = `${extra}<button type="button" class="btn btn-outline" data-close>ยกเลิก</button>${onSave ? `<button type="submit" class="btn btn-primary">${save}</button>` : ''}`;
  $('sheetForm').onsubmit = async e => { e.preventDefault(); if (onSave && (await onSave($('sheetForm'))) === false) return; d.close(); };
  d.querySelectorAll('[data-close]').forEach(b => { b.onclick = () => d.close(); });
  d.showModal();
  const f = d.querySelector('input:not([type=hidden]), select, textarea'); if (f && matchMedia('(hover: hover)').matches) f.focus();
  return d;
}
const fv = (form, name) => { const el = form.elements[name]; return el ? (el.type === 'checkbox' ? el.checked : el.value.trim()) : ''; };
const field = (label, name, value = '', o = {}) => `<label class="field${o.wide ? ' wide' : ''}"><span>${label}</span>${o.area
  ? `<textarea name="${name}" rows="${o.rows || 3}" placeholder="${esc(o.ph || '')}">${esc(value)}</textarea>`
  : `<input name="${name}" type="${o.type || 'text'}" value="${esc(value)}" placeholder="${esc(o.ph || '')}"${o.step ? ` step="${o.step}"` : ''}${o.req ? ' required' : ''}${o.mode ? ` inputmode="${o.mode}"` : ''}>`}${o.hint ? `<small>${o.hint}</small>` : ''}</label>`;
const check = (label, name, on, hint = '') => `<label class="check"><input type="checkbox" name="${name}"${on ? ' checked' : ''}><span>${label}${hint ? `<small>${hint}</small>` : ''}</span></label>`;
const select = (label, name, opts, value) => `<label class="field"><span>${label}</span><select name="${name}">${Object.entries(opts).map(([k, v]) => `<option value="${esc(k)}"${String(k) === String(value) ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></label>`;
const badge = (d) => { const s = d.void ? 'void' : d.type === 'INV' ? invoiceStatus(d) : d.status; return `<span class="badge st-${esc(s)}">${esc(statusLabel(d))}</span>`; };
const typeChip = t => `<span class="type t-${t}">${DOC_TYPES[t].prefix}</span>`;

// ===================== ธีม =====================
const THEMES = [['system', 'i-auto', 'ตามเครื่อง'], ['light', 'i-sun', 'สว่าง'], ['dark', 'i-moon', 'มืด']];
function getTheme() { try { return localStorage.getItem('softlight-theme') || 'system'; } catch (e) { return 'system'; } }
function applyTheme(t) {
  if (t === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  const i = THEMES.find(x => x[0] === t) || THEMES[0];
  $('btnTheme').innerHTML = `<svg class="ic"><use href="#${i[1]}"/></svg>`; $('btnTheme').setAttribute('aria-label', 'ธีม: ' + i[2]);
}

// ===================== สถานะซิงก์ =====================
function renderSync(st) {
  const el = $('syncState'), s = st || Store.state();
  const map = { local: ['local', 'เก็บในเครื่องนี้'], pending: ['pending', 'รอซิงก์…'], syncing: ['pending', 'กำลังซิงก์…'], synced: ['ok', 'ซิงก์ Google Drive แล้ว'], error: ['bad', 'ซิงก์ไม่สำเร็จ'] };
  const [cls, text] = map[s.status] || map.local;
  el.className = 'sync is-' + cls; el.querySelector('span').textContent = text; el.title = s.error || '';
  el.onclick = s.status === 'error' || (s.status === 'local' && Drive.configured()) ? () => connectGoogle() : null;
  el.classList.toggle('is-action', !!el.onclick);
}
async function connectGoogle() {
  try {
    const u = await Drive.signIn(false);
    await Store.connect();
    toast('เชื่อม Google Drive แล้ว · ' + u.email);
    track('login', { l: 'google' });
    route();
  } catch (e) { toast(e.message); renderSync(); throw e; }
}

// ===================== เส้นทาง =====================
const VIEWS = {};
let CUR = '';
function go(hash) { if (location.hash !== '#' + hash) location.hash = hash; else route(); }
function route() {
  const h = (location.hash || '#home').slice(1), [v, id] = h.split('/');
  CUR = VIEWS[v] ? v : 'home';
  document.querySelectorAll('.nav [data-go]').forEach(b => b.setAttribute('aria-current', String(b.dataset.go === (CUR === 'doc' ? 'docs' : CUR))));
  document.body.dataset.view = CUR;
  $('page').innerHTML = '';
  VIEWS[CUR](id);
  window.scrollTo(0, 0);
  try { if (typeof Analytics !== 'undefined') Analytics.page(CUR); } catch (e) {}
}

// ===================== ข้อมูลช่วยคำนวณ =====================
const docsOf = t => Store.list('docs').filter(d => !t || d.type === t);
const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '') || (b.no || '').localeCompare(a.no || '');
function custName(d) { return (d.customer && d.customer.name) || (Store.get('customers', d.customerId) || {}).name || '(ไม่ระบุลูกค้า)'; }
function outstanding(d) { const t = totals(d); return round2(Math.max(0, t.grand - paidOf(d))); }
function yearOf(iso) { return Number(String(iso).slice(0, 4)); }
// รายได้ตามใบเสร็จ (เกณฑ์เงินสด): ใช้ใบเสร็จที่ไม่ยกเลิก
function receiptRows(year) {
  return docsOf('RC').filter(d => !d.void && yearOf(d.date) === year).map(d => {
    const t = totals(d), pays = d.payments || [];
    const wht = pays.length ? round2(pays.reduce((s, p) => s + (Number(p.wht) || 0), 0)) : t.wht;
    const received = pays.length ? round2(pays.reduce((s, p) => s + (Number(p.amount) || 0), 0)) : t.pay;
    return { d, month: Number(d.date.slice(5, 7)) - 1, base: t.base, vat: t.vat, grand: t.grand, wht, received, category: d.category || 'other' };
  });
}

// ===================== ภาพรวม =====================
VIEWS.home = () => {
  const today = todayIso(), y = yearOf(today), m = Number(today.slice(5, 7)) - 1;
  const rows = receiptRows(y), month = rows.filter(r => r.month === m);
  const inv = docsOf('INV').filter(d => !d.void && d.status !== 'draft' && outstanding(d) > 0);
  const overdue = inv.filter(d => invoiceStatus(d) === 'overdue');
  const qtOpen = docsOf('QT').filter(d => !d.void && d.status === 'sent');
  const soon = Store.list('subs').filter(s => s.status === 'active' && s.next && s.next <= addDays(today, 14)).sort((a, b) => a.next.localeCompare(b.next));
  const sum = (a, k) => round2(a.reduce((s, r) => s + r[k], 0));
  const recent = Store.list('docs').sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 6);
  $('page').innerHTML = `
  <section class="view-head"><div><p class="eyebrow">${thDate(today)}</p><h1>ภาพรวม</h1></div>
    <div class="head-actions"><button class="btn btn-tonal" data-new="QT"><svg class="ic"><use href="#i-plus"/></svg>ใบเสนอราคา</button><button class="btn btn-tonal" data-new="INV"><svg class="ic"><use href="#i-plus"/></svg>ใบแจ้งหนี้</button><button class="btn btn-tonal" data-new="RC"><svg class="ic"><use href="#i-plus"/></svg>ใบเสร็จ</button></div></section>
  ${banners()}
  <section class="kpis">
    <a class="kpi" href="#reports"><span>รายรับเดือน${TH_MONTHS[m]}</span><b>${money0(sum(month, 'grand'))}</b><small>ทั้งปี ${money0(sum(rows, 'grand'))} บาท</small></a>
    <a class="kpi${inv.length ? ' is-warn' : ''}" href="#docs/INV"><span>ค้างชำระ</span><b>${money0(round2(inv.reduce((s, d) => s + outstanding(d), 0)))}</b><small>${inv.length} ใบ${overdue.length ? ` · เกินกำหนด ${overdue.length}` : ''}</small></a>
    <a class="kpi" href="#docs/QT"><span>ใบเสนอราคารอตอบ</span><b>${qtOpen.length}</b><small>มูลค่า ${money0(round2(qtOpen.reduce((s, d) => s + totals(d).grand, 0)))}</small></a>
    <a class="kpi${soon.length ? ' is-accent' : ''}" href="#subs"><span>Subscription ครบรอบ 14 วัน</span><b>${soon.length}</b><small>${money0(round2(soon.reduce((s, x) => s + Number(x.price || 0), 0)))} บาท</small></a>
  </section>
  <div class="cols">
    <section class="card"><div class="card-head"><h2>รอชำระ</h2><a class="link" href="#docs/INV">ทั้งหมด</a></div>
      ${inv.length ? `<ul class="rows">${inv.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')).slice(0, 6).map(d => docRow(d, `<b class="mono">${money(outstanding(d))}</b>`)).join('')}</ul>` : empty('ไม่มีบิลค้างชำระ')}</section>
    <section class="card"><div class="card-head"><h2>ครบรอบเร็วๆ นี้</h2><a class="link" href="#subs">ทั้งหมด</a></div>
      ${soon.length ? `<ul class="rows">${soon.map(subRow).join('')}</ul>` : empty('ไม่มี subscription ที่ครบรอบใน 14 วัน')}</section>
    <section class="card wide"><div class="card-head"><h2>แก้ไขล่าสุด</h2><a class="link" href="#docs">เอกสารทั้งหมด</a></div>
      ${recent.length ? `<ul class="rows">${recent.map(d => docRow(d)).join('')}</ul>` : empty('ยังไม่มีเอกสาร — เริ่มจากปุ่มด้านบน')}</section>
  </div>`;
  bindCommon();
};
function empty(t) { return `<p class="empty">${t}</p>`; }
function banners() {
  const out = [], old = Store.oldQuotes();
  const imported = new Set(Store.list('docs').map(d => d.importedFrom).filter(Boolean));
  const left = old ? Object.keys(old.docs).filter(id => !imported.has(id)).length : 0;
  if (left) out.push(`<div class="banner"><svg class="ic"><use href="#i-doc"/></svg><p>พบใบเสนอราคา <b>${left}</b> ใบจากโปรแกรมใบเสนอราคาเดิมในเครื่องนี้</p><button class="btn btn-tonal" data-act="import-old">นำเข้า</button></div>`);
  if (!Drive.signedIn() && Drive.configured()) out.push(`<div class="banner is-soft"><svg class="ic"><use href="#i-cloud"/></svg><p>ข้อมูลยังอยู่แค่ในเครื่องนี้ — เชื่อม Google Drive เพื่อใช้ได้ทุกเครื่องและส่งลิงก์บิลให้ลูกค้า</p><button class="btn btn-tonal" data-act="connect">เชื่อม Google</button></div>`);
  if (!seller().addr && !seller().taxId) out.push(`<div class="banner is-soft"><svg class="ic"><use href="#i-gear"/></svg><p>ใส่ที่อยู่และเลขประจำตัวผู้เสียภาษีของ softlight เพื่อให้เอกสารใช้ประกอบการยื่นภาษีได้</p><a class="btn btn-tonal" href="#settings">ตั้งค่า</a></div>`);
  return out.join('');
}
function docRow(d, right) {
  return `<li><a class="row" href="#doc/${d.id}">${typeChip(d.type)}<span class="row-main"><b>${esc(custName(d))}</b><small><span class="mono">${esc(d.no)}</span> · ${thDateShort(d.date)}${d.title ? ' · ' + esc(d.title) : ''}</small></span><span class="row-side">${right || `<b class="mono">${money(totals(d).grand)}</b>`}${badge(d)}</span></a></li>`;
}
function subRow(s) {
  const c = Store.get('customers', s.customerId);
  return `<li><div class="row"><span class="type t-SUB">${s.cycle === 'year' ? 'ปี' : 'ด.'}</span><span class="row-main"><b>${esc(s.name)}</b><small>${esc(c ? c.name : '')} · ครบรอบ ${thDateShort(s.next)}</small></span><span class="row-side"><b class="mono">${money(s.price)}</b><button class="btn btn-chip" data-bill-sub="${s.id}">ออกใบแจ้งหนี้</button></span></div></li>`;
}

// ===================== เอกสาร: รายการ =====================
let DOC_FILTER = { type: '', q: '', year: '' };
VIEWS.docs = (type) => {
  if (type && DOC_TYPES[type]) DOC_FILTER.type = type;
  const years = [...new Set(Store.list('docs').map(d => yearOf(d.date)))].sort((a, b) => b - a);
  $('page').innerHTML = `
  <section class="view-head"><div><h1>เอกสาร</h1><p class="sub">ใบเสนอราคา ใบแจ้งหนี้ และใบเสร็จทั้งหมด</p></div>
    <div class="head-actions"><button class="btn btn-primary" data-new="${DOC_FILTER.type || 'QT'}"><svg class="ic"><use href="#i-plus"/></svg>สร้าง${DOC_FILTER.type ? DOC_TYPES[DOC_FILTER.type].th : 'ใบเสนอราคา'}</button></div></section>
  <div class="toolbar">
    <div class="seg" role="tablist">${[['', 'ทั้งหมด'], ['QT', 'ใบเสนอราคา'], ['INV', 'ใบแจ้งหนี้'], ['RC', 'ใบเสร็จ']].map(([k, v]) => `<button type="button" data-type="${k}" aria-selected="${DOC_FILTER.type === k}">${v}</button>`).join('')}</div>
    <label class="search"><svg class="ic ic-16"><use href="#i-search"/></svg><input type="search" id="docQ" placeholder="ค้นหาเลขที่ ลูกค้า หัวข้อ" value="${esc(DOC_FILTER.q)}"></label>
    <select id="docYear" aria-label="ปี"><option value="">ทุกปี</option>${years.map(y => `<option value="${y}"${String(y) === String(DOC_FILTER.year) ? ' selected' : ''}>พ.ศ. ${y + 543}</option>`).join('')}</select>
  </div>
  <section class="card"><ul class="rows" id="docList"></ul></section>`;
  const draw = () => {
    const q = DOC_FILTER.q.toLowerCase();
    const list = Store.list('docs').filter(d => (!DOC_FILTER.type || d.type === DOC_FILTER.type) && (!DOC_FILTER.year || yearOf(d.date) === Number(DOC_FILTER.year))
      && (!q || [d.no, custName(d), d.title].join(' ').toLowerCase().includes(q))).sort(byDateDesc);
    $('docList').innerHTML = list.length ? list.map(d => docRow(d)).join('') : `<li>${empty('ไม่พบเอกสาร')}</li>`;
  };
  document.querySelectorAll('[data-type]').forEach(b => b.onclick = () => { DOC_FILTER.type = b.dataset.type; VIEWS.docs(); });
  $('docQ').oninput = e => { DOC_FILTER.q = e.target.value; draw(); };
  $('docYear').onchange = e => { DOC_FILTER.year = e.target.value; draw(); };
  draw(); bindCommon();
};

// ===================== เอกสาร: สร้าง =====================
function newDoc(type, o = {}) {
  const date = o.date || todayIso(), st = settings();
  const d = Object.assign({
    id: uid(), type, no: '', date, status: type === 'QT' ? 'draft' : type === 'INV' ? 'unpaid' : 'issued',
    validDays: st.validDays || 30, dueDate: type === 'INV' ? addDays(date, Number(st.dueDays) || 7) : '',
    customerId: '', customer: {}, title: '', intro: '', items: [], discount: 0, discountType: 'amount', discountLabel: 'ส่วนลด',
    vat: !!seller().vatReg, vatIncl: false, wht: false, whtRate: Number(st.whtRate) || 3,
    terms: (st.terms && st.terms[type]) || DEFAULT_TERMS[type] || '', category: 'other', payments: []
  }, o);
  if (!d.no) d.no = Store.nextNo(type, d.date); // ออกเลขครั้งเดียวหลังรู้วันที่จริง (ไม่ให้เลขข้าม)
  Store.put('docs', d);
  track('doc_new', { l: type });
  return d;
}
function copyFields(src) {
  return { customerId: src.customerId, customer: Object.assign({}, src.customer), title: src.title, intro: src.intro, items: JSON.parse(JSON.stringify(src.items || [])),
    discount: src.discount, discountType: src.discountType, discountLabel: src.discountLabel, vat: src.vat, vatIncl: src.vatIncl, wht: src.wht, whtRate: src.whtRate, category: src.category, badge: src.badge || '' };
}
function toInvoice(qt) {
  const inv = newDoc('INV', Object.assign(copyFields(qt), { ref: qt.no, refId: qt.id }));
  if (qt.status !== 'accepted') { qt.status = 'accepted'; Store.put('docs', qt); }
  return inv;
}
// ใบเสร็จจากการรับชำระ: ชำระครบในครั้งเดียว = คัดลอกรายการทั้งหมด · บางส่วน = รายการเดียวตามสัดส่วน
function receiptFor(inv, p) {
  const t = totals(inv), gross = round2((Number(p.amount) || 0) + (Number(p.wht) || 0));
  const full = Math.abs(gross - t.grand) < 0.01 && (inv.payments || []).length <= 1;
  const o = Object.assign(copyFields(inv), { ref: inv.no, refId: inv.id, date: p.date, payments: [Object.assign({}, p)], status: 'issued' });
  if (!full) {
    const share = t.grand ? gross / t.grand : 1;
    o.items = [{ t: `รับชำระตามใบแจ้งหนี้ ${inv.no}${inv.title ? ' — ' + inv.title : ''}`, d: `ชำระ ${Math.round(share * 100)}% ของยอด ${money(t.grand)} บาท`, qty: 1, unit: 'งวด', price: round2(inv.vat && !inv.vatIncl ? t.base * share : gross) }];
    o.discount = 0;
  }
  return newDoc('RC', o);
}

// ===================== เอกสาร: แก้ไข =====================
let DOC = null, saveTimer = 0, shareTimer = 0;
VIEWS.doc = (id) => {
  DOC = Store.get('docs', id);
  if (!DOC) { $('page').innerHTML = empty('ไม่พบเอกสารนี้') + '<p><a class="link" href="#docs">กลับไปหน้าเอกสาร</a></p>'; return; }
  const d = DOC, T = docTitle(d, seller()), locked = d.void;
  const customers = Store.list('customers').sort((a, b) => a.name.localeCompare(b.name, 'th'));
  $('page').innerHTML = `
  <section class="view-head doc-head"><div><a class="back" href="#docs/${d.type}"><svg class="ic"><use href="#i-back"/></svg>เอกสาร</a>
    <h1>${typeChip(d.type)} ${T.th} <span class="mono">${esc(d.no)}</span> ${badge(d)}</h1></div>
    <div class="head-actions">${docActions(d)}</div></section>
  <div class="layout">
    <form class="editor" id="docForm" autocomplete="off"${locked ? ' inert' : ''}>
      ${locked ? '<p class="banner is-bad">เอกสารนี้ถูกยกเลิกแล้ว แก้ไขไม่ได้ (ยังเก็บไว้เป็นหลักฐาน)</p>' : ''}
      <section class="card"><h2>ข้อมูลเอกสาร</h2><div class="grid2">
        ${field('เลขที่', 'no', d.no, { hint: 'รันอัตโนมัติ แก้ได้ถ้าจำเป็น' })}${field('วันที่', 'date', d.date, { type: 'date' })}
        ${d.type === 'QT' ? field('ยืนราคา (วัน)', 'validDays', d.validDays, { type: 'number', mode: 'numeric' }) + select('สถานะ', 'status', STATUS.QT, d.status) : ''}
        ${d.type === 'INV' ? field('ครบกำหนดชำระ', 'dueDate', d.dueDate, { type: 'date' }) + select('สถานะ', 'status', { draft: 'ร่าง (ยังไม่ส่ง)', unpaid: 'ส่งแล้ว (คำนวณจากการชำระ)' }, d.status === 'draft' ? 'draft' : 'unpaid') : ''}
        ${select('หมวดรายได้', 'category', CATEGORIES, d.category)}${field('อ้างอิง', 'ref', d.ref || '', { ph: 'เช่น เลขใบสั่งซื้อ / เอกสารต้นทาง' })}
      </div></section>
      <section class="card"><div class="card-head"><h2>ลูกค้า</h2><button type="button" class="btn btn-chip" data-act="cust-new"><svg class="ic ic-16"><use href="#i-plus"/></svg>ลูกค้าใหม่</button></div>
        <label class="field"><span>เลือกลูกค้า</span><select name="customerId"><option value="">— เลือก —</option>${customers.map(c => `<option value="${c.id}"${c.id === d.customerId ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
        <div class="cust-snap" id="custSnap"></div></section>
      <section class="card"><h2>หัวเรื่อง</h2>${field('หัวเรื่อง', 'title', d.title, { ph: 'เช่น ถ่ายภาพงานสัมมนา 12 ธ.ค.' })}${field('รายละเอียด', 'intro', d.intro, { area: true, rows: 2 })}</section>
      <section class="card"><div class="card-head"><h2>รายการ</h2><span class="sum-mini mono" id="sumMini"></span></div>
        <div class="items" id="items"></div>
        <div class="row-btns"><button type="button" class="btn btn-outline" data-act="item-add"><svg class="ic"><use href="#i-plus"/></svg>เพิ่มรายการ</button><button type="button" class="btn btn-outline" data-act="item-catalog">เลือกจากรายการสินค้า/บริการ</button></div></section>
      <section class="card"><h2>ส่วนลดและภาษี</h2><div class="grid2">
        ${field('ส่วนลด', 'discount', d.discount || '', { type: 'number', mode: 'decimal', step: 'any' })}${select('หน่วยส่วนลด', 'discountType', { amount: 'บาท', percent: '%' }, d.discountType)}
        ${field('ชื่อส่วนลด', 'discountLabel', d.discountLabel || 'ส่วนลด', { wide: true })}</div>
        ${check('มีภาษีมูลค่าเพิ่ม 7%', 'vat', d.vat, seller().vatReg ? '' : 'ตั้งค่าไว้ว่ายังไม่จด VAT — เปิดเฉพาะกรณีจดแล้ว')}
        ${check('ราคาในรายการรวม VAT แล้ว', 'vatIncl', d.vatIncl)}
        ${check('ลูกค้าหักภาษี ณ ที่จ่าย', 'wht', d.wht, 'นิติบุคคลหักจากค่าบริการก่อน VAT · บริการทั่วไป/ถ่ายภาพ 3% · โฆษณา 2%')}
        ${select('อัตราหัก ณ ที่จ่าย', 'whtRate', { 1: '1%', 2: '2%', 3: '3%', 5: '5%' }, d.whtRate || 3)}</section>
      ${d.type === 'INV' || d.type === 'RC' ? `<section class="card"><div class="card-head"><h2>การชำระเงิน</h2>${d.type === 'INV' ? '<button type="button" class="btn btn-tonal" data-act="pay"><svg class="ic"><use href="#i-cash"/></svg>รับชำระ</button>' : ''}</div><div id="payList"></div></section>` : ''}
      <section class="card"><h2>${d.type === 'QT' ? 'เงื่อนไข' : 'หมายเหตุ'}</h2>${field('บรรทัดละข้อ', 'terms', d.terms, { area: true, rows: 4 })}${field('บันทึกภายใน (ไม่แสดงในเอกสาร)', 'memo', d.memo || '', { area: true, rows: 2 })}</section>
    </form>
    <aside class="preview"><div class="preview-head"><span id="zoomInfo"></span><button type="button" class="btn btn-chip" data-act="print"><svg class="ic ic-16"><use href="#i-print"/></svg>พิมพ์ / PDF</button></div><div class="paper" id="paper"></div></aside>
  </div>`;
  renderCust(); renderItems(); renderPays(); renderPaper();
  const form = $('docForm');
  form.addEventListener('input', onDocInput); form.addEventListener('change', onDocInput);
  bindCommon();
};
function docActions(d) {
  const a = [];
  if (d.type === 'QT' && !d.void) a.push('<button class="btn btn-tonal" data-act="to-inv">ออกใบแจ้งหนี้</button>');
  if (d.type === 'INV' && !d.void && outstanding(d) > 0 && d.status !== 'draft') a.push('<button class="btn btn-primary" data-act="pay"><svg class="ic"><use href="#i-cash"/></svg>รับชำระ</button>');
  a.push('<button class="btn btn-outline" data-act="share"><svg class="ic"><use href="#i-link"/></svg>ลิงก์ให้ลูกค้า</button>');
  a.push('<button class="btn btn-outline" data-act="print"><svg class="ic"><use href="#i-print"/></svg><span class="only-wide">พิมพ์ / PDF</span></button>');
  a.push('<button class="btn btn-outline" data-act="more" aria-label="เพิ่มเติม">⋯</button>');
  return a.join('');
}
function onDocInput(e) {
  const el = e.target, d = DOC; if (!d || !el.name) return;
  if (el.closest('.item')) return onItemInput(el);
  const k = el.name;
  if (el.type === 'checkbox') d[k] = el.checked;
  else if (['discount', 'validDays', 'whtRate'].includes(k)) d[k] = Number(el.value) || 0;
  else d[k] = el.value;
  if (k === 'customerId') { const c = Store.get('customers', el.value); d.customer = c ? snapshot(c) : {}; renderCust(); }
  if (k === 'date' && d.type === 'INV' && e.type === 'change' && !d._dueTouched) { d.dueDate = addDays(d.date, Number(settings().dueDays) || 7); const f = $('docForm').elements.dueDate; if (f) f.value = d.dueDate; }
  if (k === 'dueDate') d._dueTouched = true;
  if (k === 'no' && e.type === 'change') { const dup = Store.list('docs').find(x => x.id !== d.id && x.no === d.no); if (dup) toast('เลขที่นี้ซ้ำกับเอกสารอื่น — กรุณาตรวจสอบ'); }
  renderPaper(); queueSave();
}
const snapshot = c => ({ name: c.name, branch: c.branch, addr: c.addr, taxId: c.taxId, attn: c.attn, email: c.email, phone: c.phone });
function renderCust() {
  const c = DOC.customer || {};
  $('custSnap').innerHTML = c.name ? `<p>${lines([`<b>${esc(c.name)}</b>${c.branch ? ` (${esc(c.branch)})` : ''}`, txt(c.addr), c.taxId && 'เลขผู้เสียภาษี ' + esc(c.taxId), join([esc(c.attn), esc(c.phone), esc(c.email)])])}</p>
    ${DOC.customerId ? '<button type="button" class="btn btn-chip" data-act="cust-edit">แก้ข้อมูลลูกค้า</button>' : ''}` : '<p class="muted">ยังไม่ได้เลือกลูกค้า</p>';
  bindCommon($('custSnap'));
}
function queueSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!DOC) return;
    Store.put('docs', DOC);
    // แชร์ไว้แล้ว: อัปเดตไฟล์ของลูกค้าตามด้วย
    if (DOC.share && DOC.share.fileId && Drive.signedIn()) { clearTimeout(shareTimer); const d = DOC; shareTimer = setTimeout(() => publishDoc(d, true).catch(() => {}), 2500); }
  }, 400);
}
// ----- รายการสินค้า -----
function renderItems() {
  const items = DOC.items;
  $('items').innerHTML = items.map((it, i) => `<div class="item" data-i="${i}">
    <div class="item-top"><span class="item-no">${i + 1}</span><input name="t" value="${esc(it.t)}" placeholder="ชื่อรายการ" aria-label="ชื่อรายการ ${i + 1}">
      <button type="button" class="icon-btn sm" data-item="up" aria-label="เลื่อนขึ้น"${i ? '' : ' disabled'}><svg class="ic ic-16"><use href="#i-up"/></svg></button>
      <button type="button" class="icon-btn sm" data-item="down" aria-label="เลื่อนลง"${i < items.length - 1 ? '' : ' disabled'}><svg class="ic ic-16"><use href="#i-down"/></svg></button>
      <button type="button" class="icon-btn sm is-bad" data-item="del" aria-label="ลบรายการ"><svg class="ic ic-16"><use href="#i-trash"/></svg></button></div>
    <textarea name="d" rows="${Math.min(6, Math.max(1, String(it.d || '').split('\n').length))}" placeholder="รายละเอียด (บรรทัดละข้อ)">${esc(it.d || '')}</textarea>
    <div class="item-nums"><label><span>จำนวน</span><input name="qty" type="number" inputmode="decimal" step="any" value="${esc(it.qty)}"></label><label><span>หน่วย</span><input name="unit" value="${esc(it.unit || '')}"></label>
      <label><span>ราคา/หน่วย</span><input name="price" type="number" inputmode="decimal" step="any" value="${esc(it.price)}"></label><output class="mono">${money((Number(it.qty) || 0) * (Number(it.price) || 0))}</output></div>
  </div>`).join('') || empty('ยังไม่มีรายการ');
  $('items').querySelectorAll('[data-item]').forEach(b => b.onclick = () => {
    const i = Number(b.closest('.item').dataset.i), it = DOC.items;
    if (b.dataset.item === 'del') it.splice(i, 1);
    if (b.dataset.item === 'up' && i) [it[i - 1], it[i]] = [it[i], it[i - 1]];
    if (b.dataset.item === 'down' && i < it.length - 1) [it[i + 1], it[i]] = [it[i], it[i + 1]];
    renderItems(); renderPaper(); queueSave();
  });
  sumMini();
}
function onItemInput(el) {
  const box = el.closest('.item'), it = DOC.items[Number(box.dataset.i)];
  it[el.name] = ['qty', 'price'].includes(el.name) ? (el.value === '' ? '' : Number(el.value)) : el.value;
  if (el.name === 'd') el.rows = Math.min(6, Math.max(1, el.value.split('\n').length));
  box.querySelector('output').textContent = money((Number(it.qty) || 0) * (Number(it.price) || 0));
  sumMini(); renderPaper(); queueSave();
}
function sumMini() { const t = totals(DOC); $('sumMini').textContent = 'ยอดสุทธิ ' + money(t.grand); }
// ----- การชำระเงิน -----
function renderPays() {
  const el = $('payList'); if (!el) return;
  const d = DOC, pays = d.payments || [], t = totals(d);
  el.innerHTML = (pays.length ? `<ul class="rows">${pays.map((p, i) => `<li><div class="row"><span class="row-main"><b>${thDate(p.date)}</b><small>${esc(PAY_METHODS[p.method] || p.method || '')}${p.note ? ' · ' + esc(p.note) : ''}${p.receiptId ? ` · <a class="link" href="#doc/${p.receiptId}">ใบเสร็จ</a>` : ''}</small></span><span class="row-side"><b class="mono">${money(p.amount)}</b>${Number(p.wht) ? `<small>หัก ณ ที่จ่าย ${money(p.wht)}</small>` : ''}${d.type === 'INV' && !d.void ? `<button type="button" class="icon-btn sm is-bad" data-pay-del="${i}" aria-label="ลบรายการชำระ"><svg class="ic ic-16"><use href="#i-trash"/></svg></button>` : ''}</span></div></li>`).join('')}</ul>` : empty('ยังไม่มีการชำระ'))
    + (d.type === 'INV' ? `<p class="pay-sum">ยอดสุทธิ ${money(t.grand)} · รับแล้ว (รวมหัก ณ ที่จ่าย) ${money(paidOf(d))} · คงค้าง <b>${money(outstanding(d))}</b></p>` : '');
  el.querySelectorAll('[data-pay-del]').forEach(b => b.onclick = async () => {
    const p = d.payments[Number(b.dataset.payDel)];
    if (!(await ask('ลบรายการชำระนี้?', p.receiptId ? 'ใบเสร็จที่ออกจากการชำระนี้จะถูกยกเลิกด้วย' : 'ยอดคงค้างจะกลับมาเหมือนเดิม', 'ลบ', true))) return;
    if (p.receiptId) { const r = Store.get('docs', p.receiptId); if (r) { r.void = true; Store.put('docs', r); } }
    d.payments.splice(Number(b.dataset.payDel), 1); Store.put('docs', d); VIEWS.doc(d.id);
  });
}
function paySheet(d) {
  const t = totals(d), left = outstanding(d), first = !(d.payments || []).length;
  const whtDefault = d.wht && first ? Math.min(t.wht, left) : 0;
  openSheet(`รับชำระ ${d.no}`, `<div class="grid2">
    ${field('วันที่รับเงิน', 'date', todayIso(), { type: 'date' })}${select('ช่องทาง', 'method', PAY_METHODS, 'transfer')}
    ${field('จำนวนที่ได้รับ (บาท)', 'amount', round2(left - whtDefault), { type: 'number', step: 'any', mode: 'decimal', hint: 'ยอดที่เข้าบัญชีจริง' })}
    ${field('ภาษีที่ลูกค้าหัก ณ ที่จ่าย', 'wht', whtDefault || 0, { type: 'number', step: 'any', mode: 'decimal', hint: 'ใช้ยื่นเครดิตภาษีปลายปี' })}
    ${field('หมายเหตุ', 'note', '', { wide: true, ph: 'เช่น เลขอ้างอิงการโอน / ได้รับ 50 ทวิ แล้ว' })}</div>
    ${check('ออกใบเสร็จรับเงินอัตโนมัติ', 'receipt', true)}<p class="muted">คงค้างก่อนรับชำระ ${money(left)} บาท</p>`, {
    save: 'บันทึกการชำระ',
    onSave: f => {
      const p = { id: uid(), date: fv(f, 'date') || todayIso(), method: fv(f, 'method'), amount: round2(Number(fv(f, 'amount')) || 0), wht: round2(Number(fv(f, 'wht')) || 0), note: fv(f, 'note') };
      if (p.amount + p.wht <= 0) { toast('ใส่จำนวนเงิน'); return false; }
      d.payments = d.payments || []; d.payments.push(p);
      if (fv(f, 'receipt')) { const rc = receiptFor(d, p); p.receiptId = rc.id; }
      Store.put('docs', d);
      track('payment', { v: p.amount });
      toast(p.receiptId ? 'บันทึกการชำระและออกใบเสร็จแล้ว' : 'บันทึกการชำระแล้ว');
      VIEWS.doc(d.id);
    }
  });
}
// ----- แสดงตัวอย่าง A4 -----
let paperTimer = 0;
function renderPaper() {
  clearTimeout(paperTimer);
  paperTimer = setTimeout(() => { if (!$('paper') || !DOC) return; $('paper').innerHTML = renderPaperHtml(DOC, seller()); fitPaper(); }, 60);
}
function fitPaper() {
  const wrap = document.querySelector('.preview'), paper = $('paper'); if (!wrap || !paper || !wrap.offsetWidth) return;
  paper.style.zoom = '';
  const cs = getComputedStyle(wrap), avail = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), full = paper.offsetWidth;
  const z = avail > 0 && full > avail ? Math.max(0.3, avail / full) : 1;
  if (z < 1) paper.style.zoom = String(z);
  if ($('zoomInfo')) $('zoomInfo').textContent = z < 1 ? `ย่อ ${Math.round(z * 100)}% ให้พอดีจอ · พิมพ์ขนาดจริง` : 'ขนาดจริง (A4)';
}
window.addEventListener('resize', () => { clearTimeout(paperTimer); paperTimer = setTimeout(fitPaper, 80); });
window.addEventListener('beforeprint', () => { if ($('paper')) $('paper').style.zoom = ''; });
window.addEventListener('afterprint', fitPaper);
// ----- แชร์ลิงก์ให้ลูกค้า -----
function viewUrl(fileId) { return new URL('view.html#' + fileId, location.href.split('#')[0]).href; }
async function publishDoc(d, quiet) {
  const id = await Drive.publish(d.share && d.share.fileId, `${d.no}.json`, publicCopy(d, seller()));
  d.share = { fileId: id, at: Date.now() }; Store.put('docs', d);
  if (!quiet) track('share', { l: d.type });
  return viewUrl(id);
}
async function shareSheet(d) {
  if (!Drive.configured()) return toast('ยังไม่ได้ตั้งค่า Google — ไปที่ ตั้งค่า → บัญชี Google');
  if (!Drive.signedIn()) { if (!(await ask('เชื่อม Google Drive ก่อน', 'ลิงก์ให้ลูกค้าเก็บไฟล์บิลไว้ใน Google Drive ของคุณ', 'เชื่อม Google'))) return; await connectGoogle(); }
  let url;
  try { toast('กำลังสร้างลิงก์…'); url = await publishDoc(d); } catch (e) { return toast('สร้างลิงก์ไม่สำเร็จ: ' + e.message); }
  const msg = `${docTitle(d, seller()).th} ${d.no} จาก ${seller().name}\nยอดสุทธิ ${money(totals(d).grand)} บาท\n${url}`;
  openSheet('ลิงก์ให้ลูกค้า', `<p>ลูกค้าเปิดดูและพิมพ์ ${esc(docTitle(d, seller()).th)} นี้ได้ทันที ไม่ต้องสมัครหรือเข้าสู่ระบบ · แก้เอกสารแล้วลิงก์จะอัปเดตตาม</p>
    <label class="field"><span>ลิงก์</span><input readonly value="${esc(url)}" id="shareUrl"></label>
    <div class="row-btns"><button type="button" class="btn btn-primary" id="copyLink"><svg class="ic"><use href="#i-copy"/></svg>คัดลอกลิงก์</button><button type="button" class="btn btn-outline" id="copyMsg">คัดลอกข้อความพร้อมลิงก์</button>${navigator.share ? '<button type="button" class="btn btn-outline" id="nativeShare">แชร์…</button>' : ''}<a class="btn btn-outline" href="${esc(url)}" target="_blank" rel="noopener">เปิดดู</a></div>`,
    { extra: '<button type="button" class="btn btn-danger" id="unshare">ยกเลิกการแชร์</button>' });
  const copy = async (text, done) => { try { await navigator.clipboard.writeText(text); toast(done); } catch (e) { $('shareUrl').select(); toast('กดค้างที่ลิงก์เพื่อคัดลอก'); } };
  $('copyLink').onclick = () => copy(url, 'คัดลอกลิงก์แล้ว');
  $('copyMsg').onclick = () => copy(msg, 'คัดลอกข้อความแล้ว');
  if ($('nativeShare')) $('nativeShare').onclick = () => navigator.share({ title: d.no, text: msg }).catch(() => {});
  $('unshare').onclick = async () => {
    if (!(await ask('ยกเลิกการแชร์?', 'ลิงก์เดิมจะเปิดไม่ได้อีก', 'ยกเลิกการแชร์', true))) return;
    try { await Drive.unpublish(d.share.fileId); d.share = null; Store.put('docs', d); $('sheet').close(); toast('ยกเลิกการแชร์แล้ว'); } catch (e) { toast(e.message); }
  };
}
// ----- เมนูเพิ่มเติมของเอกสาร -----
function moreSheet(d) {
  const a = [];
  a.push(['dup', 'ทำซ้ำเป็นเอกสารใหม่']);
  if (d.type === 'INV' && !d.void && outstanding(d) <= 0 && !(d.payments || []).some(p => p.receiptId)) a.push(['receipt', 'ออกใบเสร็จจากใบแจ้งหนี้นี้']);
  if (!d.void) a.push(['void', d.type === 'RC' ? 'ยกเลิกใบเสร็จ' : 'ยกเลิกเอกสาร']);
  if (d.void) a.push(['unvoid', 'เลิกยกเลิก (กลับมาใช้งาน)']);
  a.push(['delete', 'ลบถาวร']);
  openSheet('เพิ่มเติม', `<div class="menu">${a.map(([k, v]) => `<button type="button" class="menu-item${k === 'delete' || k === 'void' ? ' is-bad' : ''}" data-more="${k}">${v}</button>`).join('')}</div>
    <p class="muted">เอกสารที่ออกให้ลูกค้าแล้วควร "ยกเลิก" แทนการลบ เพื่อให้เลขที่เอกสารต่อเนื่องสำหรับตรวจสอบภาษี</p>`);
  document.querySelectorAll('[data-more]').forEach(b => b.onclick = async () => {
    const k = b.dataset.more; $('sheet').close();
    if (k === 'dup') { const n = newDoc(d.type, copyFields(d)); go('doc/' + n.id); toast('สร้างสำเนา ' + n.no); }
    if (k === 'receipt') { const p = { id: uid(), date: todayIso(), method: 'transfer', amount: totals(d).pay, wht: d.wht ? totals(d).wht : 0, note: '' }; const rc = Object.assign({}, p); const r = receiptFor(d, rc); go('doc/' + r.id); }
    if (k === 'void' && await ask('ยกเลิกเอกสารนี้?', 'เลขที่ยังคงอยู่ในระบบ พร้อมตราว่า "ยกเลิก"', 'ยกเลิกเอกสาร', true)) { d.void = true; Store.put('docs', d); VIEWS.doc(d.id); }
    if (k === 'unvoid') { d.void = false; Store.put('docs', d); VIEWS.doc(d.id); }
    if (k === 'delete' && await ask('ลบถาวร?', 'ลบแล้วกู้คืนไม่ได้ ถ้าเคยส่งให้ลูกค้าแล้วแนะนำให้ "ยกเลิก" แทน', 'ลบถาวร', true)) {
      if (d.share && d.share.fileId && Drive.signedIn()) Drive.unpublish(d.share.fileId).catch(() => {});
      Store.remove('docs', d.id); toast('ลบแล้ว'); go('docs');
    }
  });
}
// ----- เลือกจากแคตตาล็อก -----
function catalogPicker() {
  const items = Store.list('catalog').sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.t.localeCompare(b.t, 'th'));
  const groups = Object.keys(CATEGORIES).map(c => [c, items.filter(i => (i.category || 'other') === c)]).filter(g => g[1].length);
  openSheet('เลือกรายการ', groups.length ? groups.map(([c, list]) => `<h3 class="group">${CATEGORIES[c]}</h3><div class="menu">${list.map(i => `<button type="button" class="menu-item" data-cat="${i.id}"><span>${esc(i.t)}</span><b class="mono">${money(i.price)}${i.unit ? ' / ' + esc(i.unit) : ''}</b></button>`).join('')}</div>`).join('')
    : empty('ยังไม่มีรายการ — เพิ่มได้ที่ ตั้งค่า → รายการสินค้า/บริการ'));
  document.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => {
    const i = Store.get('catalog', b.dataset.cat);
    DOC.items.push({ t: i.t, d: i.d || '', qty: 1, unit: i.unit || '', price: i.price });
    if (DOC.category === 'other' && i.category) { DOC.category = i.category; const f = $('docForm').elements.category; if (f) f.value = i.category; }
    $('sheet').close(); renderItems(); renderPaper(); queueSave(); toast('เพิ่ม ' + i.t);
  });
}

// ===================== ลูกค้า =====================
VIEWS.customers = () => {
  const list = Store.list('customers').sort((a, b) => a.name.localeCompare(b.name, 'th'));
  const docs = Store.list('docs');
  $('page').innerHTML = `
  <section class="view-head"><div><h1>ลูกค้า</h1><p class="sub">${list.length} ราย</p></div><div class="head-actions"><button class="btn btn-primary" data-act="cust-new"><svg class="ic"><use href="#i-plus"/></svg>ลูกค้าใหม่</button></div></section>
  <section class="card">${list.length ? `<ul class="rows">${list.map(c => {
    const mine = docs.filter(d => d.customerId === c.id), owe = round2(mine.filter(d => d.type === 'INV' && !d.void && d.status !== 'draft').reduce((s, d) => s + outstanding(d), 0));
    const paid = round2(receiptsTotal(mine));
    return `<li><button type="button" class="row" data-cust="${c.id}"><span class="avatar">${esc((c.name || '?').trim().charAt(0))}</span><span class="row-main"><b>${esc(c.name)}</b><small>${esc(join([c.taxId && 'เลขผู้เสียภาษี ' + c.taxId, c.phone, c.email]) || 'ยังไม่มีข้อมูลติดต่อ')}</small></span>
      <span class="row-side"><small>รับแล้ว ${money0(paid)}</small>${owe ? `<b class="mono is-warn">ค้าง ${money(owe)}</b>` : ''}<small>${mine.length} เอกสาร</small></span></button></li>`;
  }).join('')}</ul>` : empty('ยังไม่มีลูกค้า')}</section>`;
  document.querySelectorAll('[data-cust]').forEach(b => b.onclick = () => customerDetail(Store.get('customers', b.dataset.cust)));
  bindCommon();
};
function receiptsTotal(docs) { return docs.filter(d => d.type === 'RC' && !d.void).reduce((s, d) => s + totals(d).grand, 0); }
function customerDetail(c) {
  const mine = Store.list('docs').filter(d => d.customerId === c.id).sort(byDateDesc);
  openSheet(c.name, `<p>${lines([txt(c.addr), c.taxId && 'เลขประจำตัวผู้เสียภาษี ' + esc(c.taxId) + (c.branch ? ` (${esc(c.branch)})` : ''), join([esc(c.attn), esc(c.phone), esc(c.email)])]) || '<span class="muted">ยังไม่มีรายละเอียด</span>'}</p>
    <div class="row-btns"><button type="button" class="btn btn-chip" data-cnew="QT">+ ใบเสนอราคา</button><button type="button" class="btn btn-chip" data-cnew="INV">+ ใบแจ้งหนี้</button><button type="button" class="btn btn-chip" data-cnew="RC">+ ใบเสร็จ</button></div>
    <h3 class="group">เอกสาร (${mine.length})</h3>${mine.length ? `<ul class="rows">${mine.map(d => docRow(d)).join('')}</ul>` : empty('ยังไม่มีเอกสาร')}`,
    { extra: '<button type="button" class="btn btn-outline" id="custEdit">แก้ไขข้อมูล</button>' });
  $('custEdit').onclick = () => { $('sheet').close(); customerSheet(c); };
  document.querySelectorAll('[data-cnew]').forEach(b => b.onclick = () => { $('sheet').close(); const d = newDoc(b.dataset.cnew, { customerId: c.id, customer: snapshot(c) }); go('doc/' + d.id); });
  document.querySelectorAll('#sheet a.row').forEach(a => a.addEventListener('click', () => $('sheet').close()));
}
function customerSheet(c, onDone) {
  const isNew = !c; c = c || { id: uid() };
  openSheet(isNew ? 'ลูกค้าใหม่' : 'แก้ไขลูกค้า', `<div class="grid2">
    ${field('ชื่อลูกค้า / บริษัท', 'name', c.name || '', { wide: true, req: true })}
    ${field('เลขประจำตัวผู้เสียภาษี', 'taxId', c.taxId || '', { mode: 'numeric', ph: '13 หลัก' })}${field('สาขา', 'branch', c.branch || '', { ph: 'สำนักงานใหญ่ / สาขาที่ …' })}
    ${field('ที่อยู่', 'addr', c.addr || '', { area: true, wide: true, rows: 2 })}
    ${field('ผู้ติดต่อ (เรียน)', 'attn', c.attn || '')}${field('โทรศัพท์', 'phone', c.phone || '', { type: 'tel' })}
    ${field('อีเมล', 'email', c.email || '', { type: 'email', wide: true })}${field('บันทึก', 'note', c.note || '', { area: true, wide: true, rows: 2 })}</div>`, {
    extra: isNew ? '' : '<button type="button" class="btn btn-danger" id="custDel">ลบ</button>',
    onSave: f => {
      if (!fv(f, 'name')) { toast('ใส่ชื่อลูกค้า'); return false; }
      ['name', 'taxId', 'branch', 'addr', 'attn', 'phone', 'email', 'note'].forEach(k => { c[k] = fv(f, k); });
      Store.put('customers', c); toast('บันทึกลูกค้าแล้ว');
      if (onDone) onDone(c); else if (CUR === 'customers') VIEWS.customers();
    }
  });
  if (!isNew) $('custDel').onclick = async () => {
    const used = Store.list('docs').some(d => d.customerId === c.id) || Store.list('subs').some(s => s.customerId === c.id);
    if (!(await ask('ลบลูกค้านี้?', used ? 'เอกสารเดิมยังแสดงชื่อลูกค้าตามที่บันทึกไว้' : 'ลบแล้วกู้คืนไม่ได้', 'ลบ', true))) return;
    Store.remove('customers', c.id); $('sheet').close(); VIEWS[CUR] && route();
  };
}

// ===================== Subscription =====================
const CYCLES = { month: 'รายเดือน', year: 'รายปี' };
const SUB_STATUS = { active: 'ใช้งาน', paused: 'พักไว้', cancelled: 'ยกเลิก' };
VIEWS.subs = () => {
  const list = Store.list('subs').sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1) || (a.next || '').localeCompare(b.next || ''));
  const active = list.filter(s => s.status === 'active');
  const mrr = round2(active.reduce((s, x) => s + (x.cycle === 'year' ? Number(x.price) / 12 : Number(x.price)), 0));
  $('page').innerHTML = `
  <section class="view-head"><div><h1>Subscription</h1><p class="sub">ใช้งาน ${active.length} ราย · รายได้ประจำเฉลี่ย ${money0(mrr)} บาท/เดือน</p></div><div class="head-actions"><button class="btn btn-primary" data-act="sub-new"><svg class="ic"><use href="#i-plus"/></svg>เพิ่ม Subscription</button></div></section>
  <section class="card">${list.length ? `<ul class="rows">${list.map(s => {
    const c = Store.get('customers', s.customerId), due = s.status === 'active' && s.next && s.next <= todayIso();
    return `<li><div class="row"><span class="type t-SUB">${s.cycle === 'year' ? 'ปี' : 'ด.'}</span><button type="button" class="row-main as-btn" data-sub="${s.id}"><b>${esc(s.name)}</b><small>${esc(c ? c.name : '—')} · ${CYCLES[s.cycle]} · ${s.status === 'active' ? `ครบรอบ ${thDateShort(s.next)}` : SUB_STATUS[s.status]}</small></button>
      <span class="row-side"><b class="mono">${money(s.price)}</b>${s.status === 'active' ? `<button class="btn btn-chip${due ? ' is-due' : ''}" data-bill-sub="${s.id}">ออกใบแจ้งหนี้</button>` : `<span class="badge">${SUB_STATUS[s.status]}</span>`}</span></div></li>`;
  }).join('')}</ul>` : empty('ยังไม่มี subscription — เพิ่มลูกค้าที่จ่ายรายเดือน/รายปี แล้วระบบจะเตือนเมื่อครบรอบ')}</section>`;
  document.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => subSheet(Store.get('subs', b.dataset.sub)));
  bindCommon();
};
function subSheet(s) {
  const isNew = !s; s = s || { id: uid(), cycle: 'month', status: 'active', start: todayIso(), next: todayIso(), category: 'subscription', vat: !!seller().vatReg, wht: false };
  const customers = Store.list('customers').sort((a, b) => a.name.localeCompare(b.name, 'th'));
  const subItems = Store.list('catalog').filter(i => i.category === 'subscription');
  openSheet(isNew ? 'เพิ่ม Subscription' : 'แก้ไข Subscription', `
    <label class="field"><span>ลูกค้า</span><select name="customerId" required><option value="">— เลือก —</option>${customers.map(c => `<option value="${c.id}"${c.id === s.customerId ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
    ${subItems.length ? `<label class="field"><span>เลือกจากแพ็กเกจ</span><select name="preset"><option value="">— ไม่เลือก —</option>${subItems.map(i => `<option value="${i.id}">${esc(i.t)} · ${money(i.price)}</option>`).join('')}</select></label>` : ''}
    <div class="grid2">${field('ชื่อบริการ', 'name', s.name || '', { wide: true, req: true })}
    ${field('ราคาต่อรอบ (บาท)', 'price', s.price || '', { type: 'number', step: 'any', mode: 'decimal' })}${select('รอบบิล', 'cycle', CYCLES, s.cycle)}
    ${field('เริ่มใช้งาน', 'start', s.start, { type: 'date' })}${field('ออกบิลครั้งถัดไป', 'next', s.next, { type: 'date' })}
    ${select('สถานะ', 'status', SUB_STATUS, s.status)}${select('หมวดรายได้', 'category', CATEGORIES, s.category || 'subscription')}</div>
    ${field('รายละเอียดในบิล', 'd', s.d || '', { area: true, rows: 2 })}
    ${check('มีภาษีมูลค่าเพิ่ม 7%', 'vat', s.vat)}${check('ลูกค้าหักภาษี ณ ที่จ่าย 3%', 'wht', s.wht)}`, {
    extra: isNew ? '' : '<button type="button" class="btn btn-danger" id="subDel">ลบ</button>',
    onSave: f => {
      if (!fv(f, 'customerId') || !fv(f, 'name')) { toast('เลือกลูกค้าและใส่ชื่อบริการ'); return false; }
      ['customerId', 'name', 'cycle', 'start', 'next', 'status', 'category', 'd'].forEach(k => { s[k] = fv(f, k); });
      s.price = round2(Number(fv(f, 'price')) || 0); s.vat = fv(f, 'vat'); s.wht = fv(f, 'wht');
      Store.put('subs', s); toast('บันทึกแล้ว'); route();
    }
  });
  const pre = $('sheetForm').elements.preset;
  if (pre) pre.onchange = () => { const i = Store.get('catalog', pre.value); if (!i) return; const f = $('sheetForm').elements; f.name.value = i.t; f.price.value = i.price; f.d.value = i.d || ''; if (i.unit === 'ปี') f.cycle.value = 'year'; };
  if (!isNew) $('subDel').onclick = async () => { if (await ask('ลบ Subscription นี้?', 'ใบแจ้งหนี้ที่ออกไปแล้วยังอยู่', 'ลบ', true)) { Store.remove('subs', s.id); $('sheet').close(); route(); } };
}
// ออกใบแจ้งหนี้รอบนี้ แล้วเลื่อนวันครบรอบถัดไป
function billSub(s) {
  const c = Store.get('customers', s.customerId), from = s.next || todayIso(), to = addDays(addMonths(from, s.cycle === 'year' ? 12 : 1), -1);
  const inv = newDoc('INV', { customerId: s.customerId, customer: c ? snapshot(c) : {}, category: s.category || 'subscription', vat: !!s.vat, wht: !!s.wht, subId: s.id,
    title: s.name, items: [{ t: `${s.name} (${thDateShort(from)} – ${thDateShort(to)})`, d: s.d || '', qty: 1, unit: s.cycle === 'year' ? 'ปี' : 'เดือน', price: s.price }] });
  s.next = addMonths(from, s.cycle === 'year' ? 12 : 1); s.lastInvoiceId = inv.id; Store.put('subs', s);
  track('sub_bill', { v: s.price });
  toast(`ออก ${inv.no} แล้ว · รอบถัดไป ${thDateShort(s.next)}`);
  go('doc/' + inv.id);
}

// ===================== ภาษี / รายงาน =====================
let REPORT_YEAR = yearOf(todayIso());
VIEWS.reports = () => {
  const years = [...new Set([yearOf(todayIso()), ...Store.list('docs').map(d => yearOf(d.date))])].sort((a, b) => b - a);
  const rows = receiptRows(REPORT_YEAR), months = TH_MONTHS.map((m, i) => { const r = rows.filter(x => x.month === i); const s = k => round2(r.reduce((a, x) => a + x[k], 0)); return { m, base: s('base'), vat: s('vat'), grand: s('grand'), wht: s('wht'), received: s('received'), n: r.length }; });
  const tot = k => round2(months.reduce((a, x) => a + x[k], 0));
  const max = Math.max(1, ...months.map(m => m.grand));
  const cats = Object.keys(CATEGORIES).map(c => [c, round2(rows.filter(r => r.category === c).reduce((a, r) => a + r.base, 0))]).filter(x => x[1]);
  const owe = docsOf('INV').filter(d => !d.void && d.status !== 'draft' && yearOf(d.date) === REPORT_YEAR && outstanding(d) > 0);
  $('page').innerHTML = `
  <section class="view-head"><div><h1>ภาษี / รายงาน</h1><p class="sub">นับรายได้ตามใบเสร็จรับเงิน (เกณฑ์เงินสด) — ตรงกับการยื่นภาษีเงินได้บุคคลธรรมดา</p></div>
    <div class="head-actions"><select id="repYear" aria-label="ปีภาษี">${years.map(y => `<option value="${y}"${y === REPORT_YEAR ? ' selected' : ''}>ปีภาษี ${y + 543}</option>`).join('')}</select></div></section>
  <section class="kpis">
    <div class="kpi"><span>รายได้ (ก่อน VAT)</span><b>${money0(tot('base'))}</b><small>${rows.length} ใบเสร็จ</small></div>
    <div class="kpi"><span>ภาษีขาย (VAT)</span><b>${money0(tot('vat'))}</b><small>${seller().vatReg ? 'ยื่น ภ.พ.30 รายเดือน' : 'ยังไม่จด VAT'}</small></div>
    <div class="kpi"><span>ถูกหัก ณ ที่จ่าย</span><b>${money0(tot('wht'))}</b><small>ใช้เป็นเครดิตภาษีปลายปี</small></div>
    <div class="kpi"><span>เงินเข้าจริง</span><b>${money0(tot('received'))}</b><small>หลังหัก ณ ที่จ่าย</small></div>
  </section>
  <section class="card"><div class="card-head"><h2>รายเดือน พ.ศ. ${REPORT_YEAR + 543}</h2><div class="row-btns">
    <button class="btn btn-chip" data-csv="months"><svg class="ic ic-16"><use href="#i-download"/></svg>สรุปรายเดือน</button>
    <button class="btn btn-chip" data-csv="receipts"><svg class="ic ic-16"><use href="#i-download"/></svg>ใบเสร็จทั้งปี</button>
    <button class="btn btn-chip" data-csv="wht"><svg class="ic ic-16"><use href="#i-download"/></svg>ภาษีถูกหัก ณ ที่จ่าย</button>
    <button class="btn btn-chip" data-csv="docs"><svg class="ic ic-16"><use href="#i-download"/></svg>เอกสารทั้งหมด</button></div></div>
    <div class="bars" role="img" aria-label="กราฟรายได้รายเดือน">${months.map(m => `<div class="bar" title="${m.m} ${money(m.grand)}"><i style="height:${Math.round(m.grand / max * 100)}%"></i><span>${m.m}</span></div>`).join('')}</div>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>เดือน</th><th class="num">ใบเสร็จ</th><th class="num">รายได้ก่อน VAT</th><th class="num">VAT</th><th class="num">รวม</th><th class="num">ถูกหัก ณ ที่จ่าย</th><th class="num">เงินเข้า</th></tr></thead>
      <tbody>${months.map(m => `<tr><td>${m.m}</td><td class="num">${m.n || ''}</td><td class="num">${m.base ? money(m.base) : '–'}</td><td class="num">${m.vat ? money(m.vat) : '–'}</td><td class="num">${m.grand ? money(m.grand) : '–'}</td><td class="num">${m.wht ? money(m.wht) : '–'}</td><td class="num">${m.received ? money(m.received) : '–'}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td>รวม</td><td class="num">${rows.length}</td><td class="num">${money(tot('base'))}</td><td class="num">${money(tot('vat'))}</td><td class="num">${money(tot('grand'))}</td><td class="num">${money(tot('wht'))}</td><td class="num">${money(tot('received'))}</td></tr></tfoot></table></div></section>
  <div class="cols">
    <section class="card"><h2>รายได้ตามหมวด</h2>${cats.length ? `<ul class="rows">${cats.map(([c, v]) => `<li><div class="row"><span class="row-main"><b>${CATEGORIES[c]}</b></span><span class="row-side"><b class="mono">${money(v)}</b></span></div></li>`).join('')}</ul>` : empty('ยังไม่มีรายได้ในปีนี้')}</section>
    <section class="card"><h2>ค้างรับ (ออกบิลปีนี้)</h2>${owe.length ? `<ul class="rows">${owe.map(d => docRow(d, `<b class="mono">${money(outstanding(d))}</b>`)).join('')}</ul>` : empty('ไม่มียอดค้างรับ')}</section>
  </div>
  <section class="card note"><h2>ใช้ยื่นภาษีอย่างไร</h2><ol>
    <li><b>ภ.ง.ด.90/94</b>: ใช้ "รายได้ก่อน VAT" ทั้งปี (แยกตามหมวดได้) — งานรับจ้าง/บริการมักเป็นเงินได้ 40(2) หรือ 40(8) ขึ้นกับลักษณะงาน</li>
    <li><b>เครดิตภาษี</b>: ยอด "ถูกหัก ณ ที่จ่าย" นำไปหักภาษีที่ต้องชำระได้ — เก็บหนังสือรับรอง 50 ทวิ จากลูกค้าไว้คู่กับไฟล์ "ภาษีถูกหัก ณ ที่จ่าย"</li>
    <li><b>VAT</b> (ถ้าจดทะเบียน): ภาษีขายรายเดือนใช้ยื่น ภ.พ.30 ภายในวันที่ 15 ของเดือนถัดไป</li>
    <li>ไฟล์ส่งออกเป็น CSV เปิดด้วย Excel/Google Sheets ได้ทันที · ปรึกษานักบัญชีเพื่อยืนยันประเภทเงินได้</li></ol></section>`;
  $('repYear').onchange = e => { REPORT_YEAR = Number(e.target.value); VIEWS.reports(); };
  document.querySelectorAll('[data-csv]').forEach(b => b.onclick = () => exportCsv(b.dataset.csv, months, rows));
  bindCommon();
};
function csvCell(v) { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function download(name, text, type = 'text/csv;charset=utf-8') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([type.startsWith('text/csv') ? '﻿' + text : text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function exportCsv(kind, months, rows) {
  const by = REPORT_YEAR + 543, out = [];
  if (kind === 'months') { out.push(['เดือน', 'จำนวนใบเสร็จ', 'รายได้ก่อน VAT', 'VAT', 'รวม', 'ถูกหัก ณ ที่จ่าย', 'เงินเข้าจริง']); months.forEach(m => out.push([`${m.m} ${by}`, m.n, m.base, m.vat, m.grand, m.wht, m.received])); }
  if (kind === 'receipts') { out.push(['วันที่', 'เลขที่', 'อ้างอิง', 'ลูกค้า', 'เลขผู้เสียภาษีลูกค้า', 'หมวด', 'รายได้ก่อน VAT', 'VAT', 'รวม', 'ถูกหัก ณ ที่จ่าย', 'เงินเข้าจริง']);
    rows.sort((a, b) => a.d.date.localeCompare(b.d.date)).forEach(r => out.push([r.d.date, r.d.no, r.d.ref || '', custName(r.d), (r.d.customer || {}).taxId || '', CATEGORIES[r.category] || '', r.base, r.vat, r.grand, r.wht, r.received])); }
  if (kind === 'wht') { out.push(['วันที่', 'เลขที่ใบเสร็จ', 'ผู้หัก (ลูกค้า)', 'เลขผู้เสียภาษีผู้หัก', 'ยอดก่อน VAT', 'ภาษีที่ถูกหัก', 'หมายเหตุ']);
    rows.filter(r => r.wht).forEach(r => out.push([r.d.date, r.d.no, custName(r.d), (r.d.customer || {}).taxId || '', r.base, r.wht, (r.d.payments || []).map(p => p.note).filter(Boolean).join(' / ')])); }
  if (kind === 'docs') { out.push(['ประเภท', 'เลขที่', 'วันที่', 'ลูกค้า', 'หัวเรื่อง', 'สถานะ', 'ยอดก่อน VAT', 'VAT', 'ยอดสุทธิ', 'รับชำระแล้ว', 'อ้างอิง']);
    Store.list('docs').filter(d => yearOf(d.date) === REPORT_YEAR).sort((a, b) => a.date.localeCompare(b.date)).forEach(d => { const t = totals(d); out.push([DOC_TYPES[d.type].th, d.no, d.date, custName(d), d.title || '', statusLabel(d), t.base, t.vat, t.grand, d.type === 'INV' ? paidOf(d) : '', d.ref || '']); }); }
  download(`softlight-${kind}-${by}.csv`, out.map(r => r.map(csvCell).join(',')).join('\n'));
  track('export', { l: kind });
}

// ===================== ตั้งค่า =====================
VIEWS.settings = () => {
  const s = seller(), st = settings(), u = Drive.user(), cfg = FIN_CONFIG;
  const cat = Store.list('catalog').sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.t.localeCompare(b.t, 'th'));
  $('page').innerHTML = `
  <section class="view-head"><div><h1>ตั้งค่า</h1><p class="sub">softlight Finance v${APP_VERSION}</p></div></section>
  <section class="card"><h2>บัญชี Google</h2>
    ${u ? `<div class="account"><span class="avatar">${u.picture ? `<img src="${esc(u.picture)}" alt="" referrerpolicy="no-referrer">` : esc(u.name.charAt(0))}</span><div><b>${esc(u.name)}</b><small>${esc(u.email)} · ข้อมูลเก็บใน Google Drive (โฟลเดอร์ข้อมูลแอป)</small></div><button class="btn btn-outline" data-act="signout"><svg class="ic"><use href="#i-logout"/></svg>ออกจากระบบ</button></div>`
      : `<p>${Drive.configured() ? 'ยังไม่ได้เชื่อม — ข้อมูลอยู่ในเครื่องนี้เท่านั้น' : 'ยังไม่ได้ตั้งค่า Google Client ID (ดูวิธีใน README ของ repo)'}</p>${Drive.configured() ? '<button class="btn btn-primary" data-act="connect"><svg class="ic"><use href="#i-cloud"/></svg>เชื่อม Google Drive</button>' : ''}`}
    <details class="adv"${Drive.configured() ? '' : ' open'}><summary>ค่าเชื่อมต่อ Google (สำหรับผู้ดูแล)</summary>
      <form id="cfgForm" class="grid2">${field('OAuth Client ID', 'clientId', cfg.clientId, { wide: true, ph: 'xxxx.apps.googleusercontent.com' })}${field('API key (หน้าดูบิลของลูกค้า)', 'apiKey', cfg.apiKey, { wide: true })}
      <div class="wide row-btns"><button type="submit" class="btn btn-tonal">บันทึกในเครื่องนี้</button><small class="muted">ค่าที่บันทึกที่นี่ใช้เฉพาะเครื่องนี้ — ใส่ใน js/config.js เพื่อใช้ทุกเครื่องและหน้าลูกค้า</small></div></form></details></section>
  <form class="card" id="sellerForm"><h2>ข้อมูลผู้ขาย (แสดงในเอกสาร)</h2><div class="grid2">
    ${field('ชื่อธุรกิจ', 'name', s.name)}${field('ชื่อเจ้าของ / ผู้ลงนาม', 'owner', s.owner)}
    ${field('เลขประจำตัวผู้เสียภาษี', 'taxId', s.taxId, { mode: 'numeric' })}${field('สาขา', 'branch', s.branch, { ph: 'สำนักงานใหญ่' })}
    ${field('ที่อยู่', 'addr', s.addr, { area: true, wide: true, rows: 2 })}${field('โทรศัพท์', 'phone', s.phone, { type: 'tel' })}${field('อีเมล', 'email', s.email, { type: 'email' })}
    ${field('ช่องทางชำระเงิน (แสดงในใบแจ้งหนี้)', 'bank', s.bank, { area: true, wide: true, rows: 2, ph: 'ธนาคาร … เลขที่บัญชี … ชื่อบัญชี … / พร้อมเพย์ …' })}</div>
    ${check('จดทะเบียนภาษีมูลค่าเพิ่ม (VAT) แล้ว', 'vatReg', s.vatReg, 'เอกสารใหม่จะคิด VAT 7% และใบเสร็จเป็น "ใบเสร็จรับเงิน/ใบกำกับภาษี"')}
    <div class="row-btns"><button type="submit" class="btn btn-primary">บันทึก</button></div></form>
  <form class="card" id="prefForm"><h2>ค่าเริ่มต้นเอกสาร</h2><div class="grid2">
    ${field('ครบกำหนดชำระ (วันหลังออกใบแจ้งหนี้)', 'dueDays', st.dueDays, { type: 'number', mode: 'numeric' })}${field('ยืนราคา (วัน)', 'validDays', st.validDays, { type: 'number', mode: 'numeric' })}
    ${select('อัตราหัก ณ ที่จ่าย', 'whtRate', { 1: '1%', 2: '2%', 3: '3%', 5: '5%' }, st.whtRate)}</div>
    ${Object.keys(DOC_TYPES).map(t => field(`${DOC_TYPES[t].th}: ${t === 'QT' ? 'เงื่อนไข' : 'หมายเหตุ'}เริ่มต้น`, 'terms_' + t, (st.terms && st.terms[t]) || DEFAULT_TERMS[t], { area: true, rows: 3 })).join('')}
    <div class="row-btns"><button type="submit" class="btn btn-primary">บันทึก</button></div></form>
  <section class="card"><div class="card-head"><h2>รายการสินค้า/บริการ</h2><div class="row-btns"><button class="btn btn-chip" data-act="cat-new"><svg class="ic ic-16"><use href="#i-plus"/></svg>เพิ่ม</button>${cat.length ? '' : '<button class="btn btn-chip" data-act="cat-seed">ใส่รายการตั้งต้น</button>'}</div></div>
    ${cat.length ? `<ul class="rows">${cat.map(i => `<li><button type="button" class="row" data-catedit="${i.id}"><span class="type t-${i.category === 'photo' ? 'RC' : i.category === 'subscription' ? 'SUB' : 'QT'}">${(CATEGORIES[i.category] || 'อื่น').slice(0, 3)}</span><span class="row-main"><b>${esc(i.t)}</b><small>${esc(String(i.d || '').split('\n')[0])}</small></span><span class="row-side"><b class="mono">${money(i.price)}</b><small>${esc(i.unit || '')}</small></span></button></li>`).join('')}</ul>` : empty('ยังไม่มีรายการ')}</section>
  <section class="card"><h2>ข้อมูลและการสำรอง</h2><div class="row-btns">
    <button class="btn btn-outline" data-act="backup"><svg class="ic"><use href="#i-download"/></svg>ดาวน์โหลดข้อมูลทั้งหมด (JSON)</button>
    <label class="btn btn-outline"><svg class="ic"><use href="#i-upload"/></svg>นำเข้าไฟล์ข้อมูล<input type="file" accept="application/json,.json" id="restoreFile" hidden></label>
    ${Store.oldQuotes() ? '<button class="btn btn-outline" data-act="import-old">นำเข้าใบเสนอราคาจากโปรแกรมเดิม</button>' : ''}</div>
    <p class="muted">นำเข้าไฟล์จะรวมกับข้อมูลเดิม (รายการที่ใหม่กว่าชนะ) ไม่ลบข้อมูลที่มีอยู่</p></section>`;
  $('cfgForm').onsubmit = e => { e.preventDefault(); const f = e.target; try { localStorage.setItem('fin-config', JSON.stringify({ clientId: fv(f, 'clientId'), apiKey: fv(f, 'apiKey') })); } catch (err) {} toast('บันทึกแล้ว — โหลดหน้าใหม่'); setTimeout(() => location.reload(), 600); };
  $('sellerForm').onsubmit = e => { e.preventDefault(); const f = e.target, o = {}; ['name', 'owner', 'taxId', 'branch', 'addr', 'phone', 'email', 'bank'].forEach(k => { o[k] = fv(f, k); }); o.vatReg = fv(f, 'vatReg'); Store.setSeller(o); toast('บันทึกข้อมูลผู้ขายแล้ว'); };
  $('prefForm').onsubmit = e => { e.preventDefault(); const f = e.target, terms = {}; Object.keys(DOC_TYPES).forEach(t => { terms[t] = f.elements['terms_' + t].value; }); Store.setSettings({ dueDays: Number(fv(f, 'dueDays')) || 7, validDays: Number(fv(f, 'validDays')) || 30, whtRate: Number(fv(f, 'whtRate')) || 3, terms }); toast('บันทึกค่าเริ่มต้นแล้ว'); };
  $('restoreFile').onchange = async e => { const file = e.target.files[0]; if (!file) return; try { Store.importJson(await file.text()); toast('นำเข้าข้อมูลแล้ว'); route(); } catch (err) { toast(err.message); } };
  document.querySelectorAll('[data-catedit]').forEach(b => b.onclick = () => catalogSheet(Store.get('catalog', b.dataset.catedit)));
  bindCommon();
};
function catalogSheet(i) {
  const isNew = !i; i = i || { id: uid(), category: 'photo', qty: 1 };
  openSheet(isNew ? 'เพิ่มสินค้า/บริการ' : 'แก้ไขสินค้า/บริการ', `<div class="grid2">${field('ชื่อรายการ', 't', i.t || '', { wide: true, req: true })}
    ${select('หมวด', 'category', CATEGORIES, i.category)}${field('หน่วย', 'unit', i.unit || '', { ph: 'งาน / ชุด / เดือน' })}${field('ราคา/หน่วย', 'price', i.price || '', { type: 'number', step: 'any', mode: 'decimal' })}
    ${field('รายละเอียด (บรรทัดละข้อ)', 'd', i.d || '', { area: true, wide: true, rows: 3 })}</div>`, {
    extra: isNew ? '' : '<button type="button" class="btn btn-danger" id="catDel">ลบ</button>',
    onSave: f => { if (!fv(f, 't')) { toast('ใส่ชื่อรายการ'); return false; } i.t = fv(f, 't'); i.category = fv(f, 'category'); i.unit = fv(f, 'unit'); i.price = round2(Number(fv(f, 'price')) || 0); i.d = fv(f, 'd'); Store.put('catalog', i); route(); }
  });
  if (!isNew) $('catDel').onclick = () => { Store.remove('catalog', i.id); $('sheet').close(); route(); };
}

// ===================== ปุ่มที่ใช้ร่วมกัน =====================
function bindCommon(root = document) {
  root.querySelectorAll('[data-new]').forEach(b => b.onclick = () => { const d = newDoc(b.dataset.new); go('doc/' + d.id); });
  root.querySelectorAll('[data-bill-sub]').forEach(b => b.onclick = e => { e.preventDefault(); billSub(Store.get('subs', b.dataset.billSub)); });
  root.querySelectorAll('[data-act]').forEach(b => b.onclick = async e => {
    const a = b.dataset.act; if (b.tagName !== 'LABEL') e.preventDefault();
    if (a === 'import-old') { const n = Store.importOldQuotes(); toast(n ? `นำเข้าใบเสนอราคา ${n} ใบแล้ว` : 'ไม่มีใบใหม่ให้นำเข้า'); route(); }
    if (a === 'connect') connectGoogle().catch(() => {});
    if (a === 'signout' && await ask('ออกจากระบบ Google?', 'ข้อมูลยังอยู่ในเครื่องนี้ และอยู่ใน Google Drive ของคุณ', 'ออกจากระบบ')) { Drive.signOut(); Store.disconnect(); route(); }
    if (a === 'cust-new') customerSheet(null, c => { if (CUR === 'doc' && DOC) { DOC.customerId = c.id; DOC.customer = snapshot(c); Store.put('docs', DOC); VIEWS.doc(DOC.id); } else VIEWS.customers(); });
    if (a === 'cust-edit') customerSheet(Store.get('customers', DOC.customerId), c => { DOC.customer = snapshot(c); Store.put('docs', DOC); renderCust(); renderPaper(); });
    if (a === 'sub-new') { if (!Store.list('customers').length) { toast('เพิ่มลูกค้าก่อน'); return customerSheet(null, () => subSheet()); } subSheet(); }
    if (a === 'item-add') { DOC.items.push({ t: '', d: '', qty: 1, unit: '', price: 0 }); renderItems(); renderPaper(); queueSave(); const last = $('items').querySelector('.item:last-child input'); if (last) last.focus(); }
    if (a === 'item-catalog') catalogPicker();
    if (a === 'pay') paySheet(DOC);
    if (a === 'to-inv') { const inv = toInvoice(DOC); toast('ออก ' + inv.no + ' จาก ' + DOC.no); go('doc/' + inv.id); }
    if (a === 'share') shareSheet(DOC);
    if (a === 'print') { fitPaper(); track('print', { l: DOC && DOC.type }); window.print(); }
    if (a === 'more') moreSheet(DOC);
    if (a === 'backup') download(`softlight-finance-backup-${todayIso()}.json`, Store.exportJson(), 'application/json');
    if (a === 'cat-new') catalogSheet();
    if (a === 'cat-seed') { SEED_CATALOG.forEach(x => Store.put('catalog', Object.assign({ id: uid() }, x))); toast('ใส่รายการตั้งต้นแล้ว — แก้ราคาให้ตรงกับเรตจริงได้'); route(); }
  });
}

// ===================== เริ่มต้น =====================
function showApp() { $('welcome').hidden = true; $('app').hidden = false; renderSync(); route(); }
function init() {
  applyTheme(getTheme());
  $('btnTheme').onclick = () => { const i = THEMES.findIndex(t => t[0] === getTheme()), n = THEMES[(i + 1) % THEMES.length][0]; try { localStorage.setItem('softlight-theme', n); } catch (e) {} applyTheme(n); toast('ธีม: ' + THEMES.find(t => t[0] === n)[2]); };
  document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); go(b.dataset.go); }));
  window.addEventListener('hashchange', route);
  Store.onChange((st, dataChanged) => { renderSync(st); if (dataChanged && CUR !== 'doc') route(); });
  if (!Store.list('catalog').length && !localStorage.getItem('fin-seeded')) { SEED_CATALOG.forEach(x => Store.put('catalog', Object.assign({ id: uid() }, x))); try { localStorage.setItem('fin-seeded', '1'); } catch (e) {} }
  try { if (typeof Analytics !== 'undefined') Analytics.init({ app: 'quote', role: 'finance' }); } catch (e) {}
  // เคยใช้แล้ว (มีข้อมูล/เลือกใช้ในเครื่อง/เคยเข้าสู่ระบบ) → เข้าแอปเลย · ครั้งแรก → หน้าเข้าสู่ระบบ
  let seen = false; try { seen = !!(localStorage.getItem('fin-local') || localStorage.getItem('fin-user')); } catch (e) {}
  $('configNote').hidden = Drive.configured();
  $('btnSignIn').hidden = !Drive.configured();
  $('btnSignIn').onclick = async () => {
    $('signInErr').hidden = true;
    try { await connectGoogle(); showApp(); } catch (e) { $('signInErr').textContent = e.message; $('signInErr').hidden = false; }
  };
  $('btnLocal').onclick = () => { try { localStorage.setItem('fin-local', '1'); } catch (e) {} showApp(); };
  if (seen || Store.list('docs').length) showApp(); else $('welcome').hidden = false;
}
document.addEventListener('DOMContentLoaded', init);
