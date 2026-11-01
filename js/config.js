// softlight Finance — ค่าเชื่อมต่อ Google (ดูวิธีสร้างใน README.md)
//   clientId: OAuth 2.0 Client ID (ประเภท Web application) ที่อนุญาต origin https://bysoftlight.github.io
//   apiKey:   API key ที่จำกัดให้ใช้ Google Drive API จาก https://bysoftlight.github.io/* — ใช้ในหน้าดูบิลของลูกค้า (view.html)
//   ทดลองก่อนแก้ไฟล์นี้ได้: ใส่ค่าในแอป ตั้งค่า → บัญชี Google (เก็บในเครื่องนี้เท่านั้น)
const FIN_CONFIG = (() => {
  const base = { clientId: '867264018441-d4bg6ei2fe0skmvbf7la9m043g9kftie.apps.googleusercontent.com', apiKey: 'AIzaSyAK2rImtyXqbV_IVL4D5YuJ3TRGrosgjgg' };
  try { const o = JSON.parse(localStorage.getItem('fin-config') || '{}') || {}; Object.keys(base).forEach(k => { if (o[k]) base[k] = String(o[k]).trim(); }); } catch (e) { /* ใช้ค่าในไฟล์ */ }
  return base;
})();
