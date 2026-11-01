// softlight Finance — ส่วนกลาง (ใช้ทั้งแอปและหน้าดูบิลของลูกค้า view.html)
//   รูปแบบข้อมูล · ยอดรวม / VAT / หัก ณ ที่จ่าย · เลขที่เอกสาร · แสดงเอกสาร A4

// ===================== ประเภทเอกสาร =====================
// QT ใบเสนอราคา · INV ใบแจ้งหนี้ · RC ใบเสร็จรับเงิน (จด VAT แล้ว = ใบเสร็จรับเงิน/ใบกำกับภาษี)
const DOC_TYPES = {
  QT:  { th: 'ใบเสนอราคา', en: 'QUOTATION', prefix: 'QT' },
  INV: { th: 'ใบแจ้งหนี้', en: 'INVOICE', prefix: 'INV' },
  RC:  { th: 'ใบเสร็จรับเงิน', en: 'RECEIPT', prefix: 'RC' }
};
const CATEGORIES = { software: 'ซอฟต์แวร์/ระบบ', photo: 'ถ่ายภาพ', subscription: 'Subscription', other: 'อื่นๆ' };
const STATUS = {
  QT:  { draft: 'ร่าง', sent: 'ส่งแล้ว', accepted: 'อนุมัติแล้ว', rejected: 'ไม่อนุมัติ' },
  INV: { draft: 'ร่าง', unpaid: 'รอชำระ', partial: 'ชำระบางส่วน', paid: 'ชำระแล้ว', overdue: 'เกินกำหนด' },
  RC:  { issued: 'ออกแล้ว' }
};
const PAY_METHODS = { transfer: 'โอนเงิน', cash: 'เงินสด', promptpay: 'พร้อมเพย์', card: 'บัตร', cheque: 'เช็ค' };

// ===================== เครื่องมือ =====================
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money0 = n => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 });
const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
const todayIso = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const thYear = iso => Number(String(iso || todayIso()).slice(0, 4)) + 543;
const thDate = iso => iso ? new Date(iso + 'T12:00:00+07:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' }) : '';
const thDateShort = iso => iso ? new Date(iso + 'T12:00:00+07:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Bangkok' }) : '';
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const addDays = (iso, n) => new Date(new Date(iso + 'T12:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);
function addMonths(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1)), last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10);
}

function bahtText(n) {
  const digits = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'], units = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];
  const read = num => {
    if (num === 0) return '';
    if (num >= 1e6) return read(Math.floor(num / 1e6)) + 'ล้าน' + read(num % 1e6);
    const s = String(num); let out = '';
    for (let i = 0; i < s.length; i++) {
      const d = +s[i], pos = s.length - i - 1;
      if (!d) continue;
      if (pos === 1 && d === 1) out += 'สิบ';
      else if (pos === 1 && d === 2) out += 'ยี่สิบ';
      else if (pos === 0 && d === 1 && s.length > 1) out += 'เอ็ด';
      else out += digits[d] + units[pos];
    }
    return out;
  };
  const r = round2(Math.abs(n)), baht = Math.floor(r), satang = Math.round((r - baht) * 100);
  return (read(baht) || 'ศูนย์') + 'บาท' + (satang ? read(satang) + 'สตางค์' : 'ถ้วน');
}

// ===================== ยอดรวม =====================
// vat: ผู้ขายจด VAT · vatIncl: ราคาในรายการรวม VAT แล้ว · wht: ลูกค้า (นิติบุคคล) หักภาษี ณ ที่จ่าย whtRate% ของยอดก่อน VAT
function totals(d) {
  const items = d.items || [];
  const sub = round2(items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0));
  const disc = round2(Math.min(sub, d.discountType === 'percent' ? sub * (Number(d.discount) || 0) / 100 : (Number(d.discount) || 0)));
  const after = round2(sub - disc);
  let base = after, vat = 0;
  if (d.vat) {
    if (d.vatIncl) { base = round2(after * 100 / 107); vat = round2(after - base); }
    else vat = round2(after * 0.07);
  }
  const grand = round2(base + vat);
  const whtRate = Number(d.whtRate) || 3;
  const wht = d.wht ? round2(base * whtRate / 100) : 0;
  return { sub, disc, after, base, vat, grand, wht, whtRate, pay: round2(grand - wht) };
}
// รับชำระแล้วเท่าไร (นับยอดหัก ณ ที่จ่ายเป็นการชำระด้วย)
function paidOf(d) { return round2((d.payments || []).reduce((s, p) => s + (Number(p.amount) || 0) + (Number(p.wht) || 0), 0)); }
function invoiceStatus(d) {
  if (d.void) return 'void';
  if (d.type !== 'INV' || d.status === 'draft') return d.status;
  const t = totals(d), paid = paidOf(d);
  if (paid >= t.grand - 0.005 && t.grand > 0) return 'paid';
  if (paid > 0) return 'partial';
  if (d.dueDate && d.dueDate < todayIso()) return 'overdue';
  return 'unpaid';
}
function statusLabel(d) {
  if (d.void) return 'ยกเลิก';
  const s = d.type === 'INV' ? invoiceStatus(d) : d.status;
  return (STATUS[d.type] || {})[s] || s || '';
}
function docTitle(d, seller) {
  if (d.type === 'RC' && seller && seller.vatReg) return { th: 'ใบเสร็จรับเงิน/ใบกำกับภาษี', en: 'RECEIPT / TAX INVOICE' };
  return DOC_TYPES[d.type] || DOC_TYPES.QT;
}

// ===================== แสดงเอกสาร A4 =====================
const txt = v => v ? esc(String(v).trim()).replace(/\n/g, '<br>') : '';
const join = parts => parts.filter(Boolean).join(' · ');
const lines = arr => arr.filter(Boolean).join('<br>');
const bullets = t => { const l = String(t || '').split('\n').map(s => s.trim()).filter(Boolean); return l.length ? `<ul>${l.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''; };
function partyBox(title, p) {
  if (!p) return '';
  return `<div class="p-box"><h3>${title}</h3>${lines([p.name && `<b>${esc(p.name)}</b>${p.branch ? ` <small>(${esc(p.branch)})</small>` : ''}`, txt(p.addr),
    p.taxId && 'เลขประจำตัวผู้เสียภาษี ' + esc(p.taxId), join([p.attn && 'เรียน ' + esc(p.attn), p.phone && 'โทร ' + esc(p.phone), esc(p.email)])])}</div>`;
}
// d = เอกสาร · seller = ข้อมูลผู้ขาย (จากเอกสาร ถ้าไม่มีใช้ค่าตั้งค่า) · opts.logo = ที่อยู่โลโก้
function renderPaperHtml(d, seller, opts = {}) {
  const s = d.seller || seller || {}, c = d.customer || {}, t = totals(d), T = docTitle(d, s);
  const meta = [['เลขที่', `<span class="mono">${esc(d.no)}</span>`], ['วันที่', thDate(d.date)]];
  if (d.type === 'QT' && d.validDays) meta.push(['ยืนราคาถึง', thDate(addDays(d.date, Number(d.validDays) || 0))]);
  if (d.type === 'INV' && d.dueDate) meta.push(['ครบกำหนดชำระ', thDate(d.dueDate)]);
  if (d.ref) meta.push(['อ้างอิง', `<span class="mono">${esc(d.ref)}</span>`]);
  const toLabel = d.type === 'QT' ? 'เสนอต่อ (ลูกค้า)' : 'ลูกค้า', fromLabel = d.type === 'QT' ? 'ผู้เสนอราคา' : 'ผู้ขาย/ผู้ให้บริการ';
  let h = `
  <header class="p-top">
    <div class="p-brand"><img src="${esc(opts.logo || 'img/softlight-logo.png')}" alt=""><div>${s.name ? `<b>${esc(s.name)}</b>` : ''}${s.owner ? `<small>โดย ${esc(s.owner)}</small>` : ''}</div></div>
    <div class="p-title"><span class="en">${T.en}</span><h1>${T.th}</h1>${d.void ? '<span class="ex void">ยกเลิก</span>' : d.badge ? `<span class="ex">${esc(d.badge)}</span>` : ''}
      <dl class="p-meta">${meta.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></div>
  </header>
  <section class="p-parties">${partyBox(toLabel, c)}${partyBox(fromLabel, s)}</section>
  ${d.title ? `<h2>${esc(d.title)}</h2>` : ''}
  ${d.intro ? `<p class="lead">${txt(d.intro)}</p>` : ''}
  <table class="p-items"><thead><tr><th>#</th><th>รายการ</th><th class="num">จำนวน</th><th class="num">ราคา/หน่วย</th><th class="num">จำนวนเงิน (บาท)</th></tr></thead><tbody>
  ${(d.items || []).map((it, i) => `<tr><td class="no">${i + 1}</td><td><span class="t">${esc(it.t)}</span>${bullets(it.d)}</td><td class="num">${esc(it.qty)} ${esc(it.unit || '')}</td><td class="num">${money(it.price)}</td><td class="num">${money((Number(it.qty) || 0) * (Number(it.price) || 0))}</td></tr>`).join('') || '<tr><td colspan="5" class="empty-row">ยังไม่มีรายการ</td></tr>'}
  </tbody></table>
  <div class="p-keep">
  <table class="p-totals"><tbody>
    <tr><td>รวมเป็นเงิน</td><td class="num">${money(t.sub)}</td></tr>
    ${t.disc ? `<tr><td>${esc(d.discountLabel || 'ส่วนลด')}${d.discountType === 'percent' ? ` (${esc(d.discount)}%)` : ''}</td><td class="num">-${money(t.disc)}</td></tr>` : ''}
    ${d.vat ? `<tr><td>มูลค่าก่อนภาษี</td><td class="num">${money(t.base)}</td></tr><tr><td>ภาษีมูลค่าเพิ่ม 7%</td><td class="num">${money(t.vat)}</td></tr>` : (t.disc ? `<tr><td>ยอดหลังหักส่วนลด</td><td class="num">${money(t.after)}</td></tr>` : '')}
    <tr class="grand"><td>ยอดสุทธิ</td><td class="num">${money(t.grand)}</td></tr>
    ${d.wht && t.grand > 0 ? `<tr class="info"><td>หักภาษี ณ ที่จ่าย ${t.whtRate}%${d.type === 'QT' ? ' (ถ้าลูกค้าเป็นนิติบุคคล)' : ''}</td><td class="num">-${money(t.wht)}</td></tr><tr class="info"><td>ยอดชำระหลังหัก ณ ที่จ่าย</td><td class="num">${money(t.pay)}</td></tr>` : ''}
  </tbody></table>
  <div class="p-baht">(${bahtText(t.grand)})</div>
  </div>`;
  if (d.type === 'RC' && (d.payments || []).length) {
    h += `<h2>การชำระเงิน</h2><table><thead><tr><th>วันที่</th><th>ช่องทาง</th><th class="num">รับชำระ</th><th class="num">หัก ณ ที่จ่าย</th></tr></thead><tbody>${d.payments.map(p => `<tr><td>${thDate(p.date)}</td><td>${esc(PAY_METHODS[p.method] || p.method || '')}${p.note ? ' · ' + esc(p.note) : ''}</td><td class="num">${money(p.amount)}</td><td class="num">${money(p.wht || 0)}</td></tr>`).join('')}</tbody></table>`;
  }
  if (d.type === 'INV' && s.bank) h += `<section class="p-keep p-pay"><h2>ช่องทางชำระเงิน</h2><p>${txt(s.bank)}</p></section>`;
  const terms = String(d.terms || '').split('\n').map(x => x.trim()).filter(Boolean);
  const signs = d.type === 'QT' ? [['ผู้เสนอราคา', s.owner], ['ผู้อนุมัติสั่งซื้อ (ลูกค้า)', '']]
    : d.type === 'INV' ? [['ผู้วางบิล', s.owner], ['ผู้รับวางบิล', '']] : [['ผู้รับเงิน', s.owner], ['ผู้จ่ายเงิน', '']];
  h += `<section class="p-keep">${terms.length ? `<h2>${d.type === 'QT' ? 'เงื่อนไข' : 'หมายเหตุ'}</h2><ol>${terms.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
    <div class="p-sign">${signs.map(([role, name]) => `<div><div class="line"></div>${role}<br>(${name ? esc(name) : '......................................................'})<br><span class="date">วันที่ ......../......../........</span></div>`).join('')}</div></section>`;
  return h;
}

// สำเนาเอกสารสำหรับส่งให้ลูกค้า (ตัดข้อมูลภายใน)
function publicCopy(d, seller) {
  const keep = ['type', 'no', 'date', 'dueDate', 'validDays', 'ref', 'badge', 'title', 'intro', 'items', 'discount', 'discountType', 'discountLabel', 'vat', 'vatIncl', 'wht', 'whtRate', 'terms', 'void', 'customer', 'payments'];
  const o = { v: 1, sharedAt: Date.now(), seller: Object.assign({}, seller, d.seller || {}) };
  keep.forEach(k => { if (d[k] !== undefined) o[k] = d[k]; });
  if (o.payments) o.payments = o.payments.map(p => ({ date: p.date, method: p.method, amount: p.amount, wht: p.wht }));
  o.status = d.type === 'INV' ? invoiceStatus(d) : d.status;
  return o;
}
