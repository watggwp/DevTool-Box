# DevTools Box

เว็บรวมเครื่องมือนักพัฒนาและงาน embedded หน้าหลักแสดงเครื่องมือทั้งหมดแบ่งตามหมวด กดเข้าไปแต่ละเครื่องมือเป็นหน้าแยกของตัวเอง มีปุ่ม "หน้าหลัก" ด้านบนและ footer เครดิตผู้พัฒนาทุกหน้า ทุกเครื่องมือทำงานในเบราว์เซอร์ ไม่ส่งข้อมูลขึ้นเซิร์ฟเวอร์

| URL | เครื่องมือ |
|---|---|
| `/serial/` | Serial Monitor (Web Serial API) สำหรับ Arduino / ESP32 / STM32 |
| `/hex/` | Hex <-> Text และ hex dump |
| `/hash/` | MD5, SHA-1/256/384/512, CRC32, CRC16 Modbus, XOR / SUM checksum |
| `/base/` | แปลงเลขฐาน 2 / 8 / 10 / 16 |
| `/base64/` | Base64 encode / decode (UTF-8, URL-safe, ไฟล์) |
| `/url/` | URL encode / decode และแยก query parameters |
| `/jwt/` | JWT decoder |
| `/json/` | JSON format / minify / validate / sort keys / escape |
| `/time/` | Unix timestamp <-> date |
| `/uuid/` | UUID v4, random bytes, password |

## รันในเครื่อง

ไม่มี dependency ต้องติดตั้ง ใช้แค่ Node.js 18 ขึ้นไป

```bash
npm run dev      # build -> dist/ แล้วเปิด server ที่ http://localhost:3000
```

## โครงสร้าง

```
src/site.json      ชื่อเว็บ, เครดิตผู้พัฒนา (footer), หมวดหมู่เครื่องมือ
src/tools.json     รายการเครื่องมือ (1 รายการ = 1 หน้า)
src/layout.html    โครงหน้าที่ใช้ร่วมกัน (แถบบน + เนื้อหา + footer)
src/pages/         เนื้อหาของแต่ละเครื่องมือ
src/assets/        style.css, favicon, js/ (common.js + <tool>.js)
build.mjs          สร้างเว็บนิ่งลง dist/
server.js          static server ขนาดเล็ก ใช้แค่ Node built-in
```

## แก้เครดิตใน footer

แก้ `src/site.json` ส่วน `developer` (ชื่อ + ลิงก์) และ `organization` แล้ว `npm run build`

## เพิ่มเครื่องมือใหม่ (ตัวอย่าง: "Text Diff" ที่ `/diff/`)

1. เพิ่มรายการใน `src/tools.json` โดยระบุ `group` ให้ตรงกับหมวดใน `src/site.json`
   ```json
   { "slug": "diff", "group": "data", "name": "Text Diff", "ico": "+-", "desc": "เปรียบเทียบข้อความสองชุด", "keywords": "compare diff" }
   ```
2. สร้าง `src/pages/diff.html` ใส่เฉพาะเนื้อหา เริ่มด้วย `<section class="tool"><h1>...</h1><p class="hint">...</p>` ตามด้วย `.card`
3. สร้าง `src/assets/js/diff.js` (ES module, import helper จาก `/assets/js/common.js`)
4. `npm run build` หน้าใหม่และการ์ดในหน้าหลักจะถูกสร้างให้อัตโนมัติ

## Deploy บน Render

แนะนำแบบ **Static Site** (ไม่มี server process เลย เสิร์ฟผ่าน CDN ของ Render, ฟรี, มี HTTPS)

1. push โค้ดขึ้น GitHub / GitLab
2. Render > **New > Blueprint** แล้วเลือก repo (อ่าน `render.yaml` อัตโนมัติ) หรือสร้าง **Static Site** เอง:
   - Build command: `node build.mjs`
   - Publish directory: `dist`

ถ้าต้องการรันเป็น Web Service แทน ใช้ build `npm run build` และ start `npm start` (server ใช้ RAM ราว 40-50 MB)

## หมายเหตุ Web Serial

- รองรับ Chrome, Edge, Opera ไม่รองรับ Firefox / Safari และต้องเปิดผ่าน HTTPS หรือ `localhost`
- เบราว์เซอร์ตรวจสอบหรือติดตั้ง driver ให้ไม่ได้ ถ้า Windows ไม่มี driver ของชิป USB-serial (CP210x, CH340, FTDI) พอร์ตจะไม่ปรากฏ หน้า `/serial/` จะเปิดแผงช่วยเหลือพร้อมลิงก์ดาวน์โหลด driver ให้อัตโนมัติเมื่อผู้ใช้ปิดหน้าต่างเลือกพอร์ตโดยไม่เลือก
