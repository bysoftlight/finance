// softlight Finance — เข้าสู่ระบบด้วย Google + เก็บข้อมูลใน Google Drive ของผู้ใช้เอง
//   ข้อมูลหลัก: ไฟล์ซ่อนใน "appDataFolder" (เห็นเฉพาะแอปนี้ ไม่รกไดรฟ์) — scope drive.appdata
//   บิลที่แชร์ให้ลูกค้า: ไฟล์ JSON ในโฟลเดอร์ "softlight Finance – บิลที่แชร์" ตั้งเป็น "ทุกคนที่มีลิงก์ดูได้" — scope drive.file
//   (ทั้งสอง scope แตะได้เฉพาะไฟล์ที่แอปนี้สร้าง ไม่เห็นไฟล์อื่นในไดรฟ์)

const Drive = (() => {
  const SCOPES = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file openid email profile';
  const DATA_NAME = 'softlight-finance.json';
  const SHARE_FOLDER = 'softlight Finance – บิลที่แชร์';
  const API = 'https://www.googleapis.com/drive/v3', UP = 'https://www.googleapis.com/upload/drive/v3';
  let token = null, tokenExp = 0, client = null, user = null, pending = null;

  const cfg = () => (typeof FIN_CONFIG !== 'undefined' ? FIN_CONFIG : {});
  const configured = () => !!cfg().clientId;
  const loadGis = () => window.google && google.accounts && google.accounts.oauth2 ? Promise.resolve()
    : new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = res; s.onerror = () => rej(new Error('โหลด Google Sign-In ไม่ได้ (ตรวจอินเทอร์เน็ต)')); document.head.appendChild(s); });

  // ขอ access token (popup ครั้งแรก · ครั้งต่อไปขอแบบเงียบด้วย hint อีเมลเดิม)
  async function signIn(silent) {
    if (!configured()) throw new Error('ยังไม่ได้ตั้งค่า Google Client ID');
    await loadGis();
    if (pending) return pending;
    pending = new Promise((resolve, reject) => {
      const hint = (() => { try { return localStorage.getItem('fin-user') || ''; } catch (e) { return ''; } })();
      client = google.accounts.oauth2.initTokenClient({
        client_id: cfg().clientId, scope: SCOPES, hint: hint || undefined,
        callback: r => {
          pending = null;
          if (r.error) return reject(new Error(r.error === 'access_denied' ? 'ไม่ได้อนุญาตให้เข้าถึง Google Drive' : r.error));
          token = r.access_token; tokenExp = Date.now() + (Number(r.expires_in) || 3600) * 1000 - 60e3;
          resolve(token);
        },
        error_callback: e => { pending = null; reject(new Error(e && e.type === 'popup_closed' ? 'ปิดหน้าต่างเข้าสู่ระบบก่อนเสร็จ' : 'เข้าสู่ระบบไม่สำเร็จ')); }
      });
      client.requestAccessToken({ prompt: silent && hint ? '' : 'select_account' });
    });
    await pending;
    if (!user) user = await profile();
    try { localStorage.setItem('fin-user', user.email); } catch (e) {}
    return user;
  }
  async function ensure() {
    if (token && Date.now() < tokenExp) return token;
    await signIn(true);
    return token;
  }
  function signOut() {
    if (token && window.google && google.accounts.oauth2) google.accounts.oauth2.revoke(token, () => {});
    token = null; user = null;
    try { localStorage.removeItem('fin-user'); } catch (e) {}
  }
  async function req(url, opt = {}, retry = true) {
    const t = await ensure();
    const r = await fetch(url, Object.assign({}, opt, { headers: Object.assign({ Authorization: 'Bearer ' + t }, opt.headers || {}) }));
    if (r.status === 401 && retry) { token = null; return req(url, opt, false); }
    if (!r.ok) { const b = await r.text().catch(() => ''); throw new Error(`Google Drive ตอบกลับ ${r.status}${b ? ': ' + b.slice(0, 160) : ''}`); }
    return r;
  }
  async function profile() {
    const r = await req('https://www.googleapis.com/oauth2/v3/userinfo');
    const p = await r.json();
    return { email: p.email, name: p.name || p.email, picture: p.picture || '' };
  }

  // ----- ไฟล์ข้อมูลหลัก (appDataFolder) -----
  let dataId = null;
  async function findData() {
    if (dataId) return dataId;
    const r = await req(`${API}/files?spaces=appDataFolder&q=${encodeURIComponent(`name='${DATA_NAME}' and trashed=false`)}&fields=files(id,modifiedTime)&pageSize=10`);
    const f = (await r.json()).files || [];
    dataId = f.length ? f[0].id : null;
    return dataId;
  }
  // คืน { data, modified } หรือ null ถ้ายังไม่มีไฟล์
  async function loadData() {
    const id = await findData();
    if (!id) return null;
    const meta = await (await req(`${API}/files/${id}?fields=modifiedTime`)).json();
    const r = await req(`${API}/files/${id}?alt=media`);
    return { data: await r.json(), modified: meta.modifiedTime };
  }
  async function remoteModified() {
    const id = await findData();
    if (!id) return null;
    return (await (await req(`${API}/files/${id}?fields=modifiedTime`)).json()).modifiedTime;
  }
  function multipart(meta, body) {
    const b = 'fin' + Math.random().toString(36).slice(2);
    return { headers: { 'Content-Type': 'multipart/related; boundary=' + b },
      body: `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${body}\r\n--${b}--` };
  }
  async function saveData(obj) {
    const id = await findData(), body = JSON.stringify(obj);
    let r;
    if (id) r = await req(`${UP}/files/${id}?uploadType=media&fields=id,modifiedTime`, { method: 'PATCH', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body });
    else { const m = multipart({ name: DATA_NAME, parents: ['appDataFolder'] }, body); r = await req(`${UP}/files?uploadType=multipart&fields=id,modifiedTime`, { method: 'POST', headers: m.headers, body: m.body }); }
    const f = await r.json();
    dataId = f.id;
    return f.modifiedTime;
  }

  // ----- บิลที่แชร์ให้ลูกค้า -----
  let folderId = null;
  async function shareFolder() {
    if (folderId) return folderId;
    const q = `name='${SHARE_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const f = ((await (await req(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id)`)).json()).files || [])[0];
    if (f) return (folderId = f.id);
    const r = await req(`${API}/files?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: SHARE_FOLDER, mimeType: 'application/vnd.google-apps.folder' }) });
    return (folderId = (await r.json()).id);
  }
  // สร้าง/อัปเดตไฟล์บิล แล้วเปิดให้ "ทุกคนที่มีลิงก์" ดูได้ · คืน fileId
  async function publish(fileId, name, obj) {
    const body = JSON.stringify(obj);
    if (fileId) {
      try { await req(`${UP}/files/${fileId}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body }); return fileId; }
      catch (e) { /* ไฟล์ถูกลบไปแล้ว → สร้างใหม่ */ }
    }
    const m = multipart({ name, parents: [await shareFolder()], mimeType: 'application/json' }, body);
    const f = await (await req(`${UP}/files?uploadType=multipart&fields=id`, { method: 'POST', headers: m.headers, body: m.body })).json();
    await req(`${API}/files/${f.id}/permissions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'reader', type: 'anyone' }) });
    return f.id;
  }
  async function unpublish(fileId) {
    try { await req(`${API}/files/${fileId}`, { method: 'DELETE' }); } catch (e) { if (!/404/.test(e.message)) throw e; }
  }
  // หน้าลูกค้า: อ่านไฟล์สาธารณะด้วย API key (ไม่ต้องเข้าสู่ระบบ)
  async function readPublic(fileId) {
    const key = cfg().apiKey;
    if (!key) throw new Error('ยังไม่ได้ตั้งค่า API key');
    const r = await fetch(`${API}/files/${encodeURIComponent(fileId)}?alt=media&key=${encodeURIComponent(key)}`);
    if (r.status === 403 || r.status === 400) {
      const t = await r.text().catch(() => '');
      // key ตั้งค่าผิด (ไม่ได้อนุญาต Drive API / จำกัดเว็บไซต์ไม่ตรง) ≠ ลิงก์ถูกยกเลิก
      if (/referer|API key|api key|blocked|has not been used|disabled/i.test(t) && !/insufficientFilePermissions|notFound/i.test(t)) throw new Error('ระบบยังตั้งค่าการเปิดบิลไม่เรียบร้อย (API key) — กรุณาแจ้งผู้ส่งบิล');
      throw new Error('ไม่พบเอกสารนี้ หรือผู้ออกบิลยกเลิกการแชร์แล้ว');
    }
    if (r.status === 404) throw new Error('ไม่พบเอกสารนี้ หรือผู้ออกบิลยกเลิกการแชร์แล้ว');
    if (!r.ok) throw new Error('เปิดเอกสารไม่ได้ (' + r.status + ')');
    return r.json();
  }

  return { configured, signIn, signOut, loadData, saveData, remoteModified, publish, unpublish, readPublic, user: () => user, signedIn: () => !!token && !!user };
})();
