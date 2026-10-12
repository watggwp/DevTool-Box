# DevTools Box

เว็บแอปรวมเครื่องมือนักพัฒนา แต่ละเครื่องมือแยกเป็นหน้าของตัวเอง ทำงานในเบราว์เซอร์ทั้งหมด (ไม่ส่งข้อมูลขึ้นเซิร์ฟเวอร์)

| URL | เครื่องมือ |
|---|---|
| `/serial` | Serial Monitor (Web Serial API) สำหรับ Arduino / ESP32 / STM32 |
| `/base64` | Base64 encode / decode (UTF-8, URL-safe, ไฟล์) |
| `/url` | URL encode / decode และแยก query parameters |
| `/hex` | Hex <-> Text และ hex dump |
| `/json` | JSON format / minify / validate / sort keys / escape |
| `/jwt` | JWT decoder (header, payload, iat/exp) |
| `/hash` | MD5, SHA-1/256/384/512, CRC32, CRC16 Modbus, XOR / SUM checksum |
| `/time` | Unix timestamp <-> date |
| `/base` | แปลงเลขฐาน 2 / 8 / 10 / 16 |
| `/uuid` | UUID v4, random bytes, password |

## รันในเครื่อง

```bash
npm install
npm run dev      # build หน้าเว็บ + start server แบบ watch
# เปิด http://localhost:3000
```

## โครงสร้าง

```
build.mjs          ประกอบ src/layout.html + src/pages/<tool>.html -> public/<tool>.html
server.js          Express static server (/serial -> public/serial.html)
src/tools.json     รายการเครื่องมือ (ชื่อ, slug, คำอธิบาย) ใช้สร้างเมนูและหน้าแรก
src/pages/         เนื้อหาแต่ละหน้า (HTML fragment)
public/js/         common.js (ใช้ร่วม) + <tool>.js แยกของแต่ละเครื่องมือ
public/style.css   สไตล์ รองรับ light/dark อัตโนมัติ
```

## เพิ่มเครื่องมือใหม่ (ตัวอย่าง: เครื่องมือ "Text Diff" ที่ URL `/diff`)

1. เพิ่มรายการใน `src/tools.json` (ชื่อในเมนู, ไอคอนสั้น, คำอธิบาย, คำค้น)
   ```json
   { "slug": "diff", "name": "Text Diff", "ico": "+-", "desc": "เปรียบเทียบข้อความสองชุด", "keywords": "compare diff" }
   ```
2. สร้าง `src/pages/diff.html` ใส่เฉพาะเนื้อหาส่วนกลางของหน้า (เริ่มด้วย `<section class="tool"><h1>...</h1><p class="hint">...</p>` แล้วตามด้วย `.card` ต่าง ๆ) ไม่ต้องใส่ header/sidebar เพราะ `src/layout.html` ใส่ให้
3. สร้าง `public/js/diff.js` เป็น ES module เขียน logic ของหน้านั้น (import helper จาก `/js/common.js` ได้ เช่น `$`, `toast`, `copyText`)
4. รัน `npm run build` สคริปต์จะประกอบเป็น `public/diff.html` และใส่ลิงก์ในเมนูด้านซ้ายกับการ์ดหน้าแรกให้อัตโนมัติ (บน Render ขั้นตอนนี้รันเองตอน build)

## Deploy บน Render

1. push โค้ดขึ้น GitHub / GitLab
2. ใน Render เลือก **New > Blueprint** แล้วชี้ไปที่ repo (ใช้ `render.yaml` อัตโนมัติ) หรือสร้าง **Web Service** เอง:
   - Runtime: Node
   - Build command: `npm ci && npm run build`
   - Start command: `npm start`
   - Health check path: `/healthz`
3. Render ให้ HTTPS อัตโนมัติ ซึ่งจำเป็นสำหรับ Web Serial API

## หมายเหตุ Web Serial

- รองรับ Chrome, Edge, Opera (desktop และ Android) ไม่รองรับ Firefox / Safari
- ต้องเปิดผ่าน HTTPS หรือ `localhost`
- บน Windows ต้องติดตั้ง driver ของชิป USB-serial (CP210x, CH340, FTDI) ก่อน เบราว์เซอร์ตรวจสอบ/ติดตั้ง driver ให้ไม่ได้ ถ้าไม่มี driver พอร์ตจะไม่ปรากฏในหน้าต่างเลือกพอร์ต หน้า `/serial` มีแผง "ไม่เห็นพอร์ต COM?" พร้อมลิงก์ดาวน์โหลด driver จากผู้ผลิต และจะเปิดแผงนี้ให้อัตโนมัติเมื่อผู้ใช้ปิดหน้าต่างเลือกพอร์ตโดยไม่ได้เลือก
