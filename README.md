# DevTools Box

เว็บรวมเครื่องมือนักพัฒนาและงาน embedded หน้าหลักแสดงเครื่องมือทั้งหมดแบ่งตามหมวด กดเข้าไปแต่ละเครื่องมือเป็นหน้าแยกของตัวเอง มีปุ่ม "หน้าหลัก" ด้านบนและ footer เครดิตผู้พัฒนาทุกหน้า ทุกเครื่องมือทำงานในเบราว์เซอร์ ไม่ส่งข้อมูลขึ้นเซิร์ฟเวอร์

| หมวด | URL | เครื่องมือ |
|---|---|---|
| Firmware / Serial | `/serial/` | **Serial Monitor**: ดูและส่งข้อมูลพอร์ต COM ของ Arduino / ESP32 / STM32 ผ่าน USB |
| Firmware / Serial | `/plotter/` | **Serial Plotter**: วาดกราฟเรียลไทม์จากค่าที่บอร์ดส่งผ่าน Serial แบบ Arduino Plotter |
| Firmware / Serial | `/flash/` | **Firmware Flasher**: อัปโหลดไฟล์ .bin ลง ESP32 / ESP8266 ผ่านเบราว์เซอร์ และช่วยเข้า bootloader ของ Pico / UF2 |
| Protocol / Bytes | `/modbus/` | **Modbus RTU**: ประกอบและถอด frame Modbus RTU พร้อมคำนวณ CRC16 อัตโนมัติ |
| Protocol / Bytes | `/float/` | **Float / IEEE 754**: แปลง float / double กับ hex พร้อมเลือก endian และดูบิต |
| Protocol / Bytes | `/struct/` | **Struct Parser**: แยกค่าจาก hex bytes ตามรูปแบบ uint8/16/32, int, float, endian |
| Protocol / Bytes | `/hex/` | **Hex / Text**: แปลงข้อความเป็น hex bytes และดู hex dump |
| Protocol / Bytes | `/hash/` | **Hash / CRC**: MD5, SHA, CRC32, CRC16 Modbus, XOR / SUM checksum |
| Protocol / Bytes | `/base/` | **Number Base**: แปลงเลขฐาน 2 / 8 / 10 / 16 พร้อม bit และ signed |
| Electronics | `/resistor/` | **Resistor / LED**: อ่านแถบสีตัวต้านทาน และคำนวณตัวต้านทานสำหรับ LED / voltage divider |
| Electronics | `/pinout/` | **Board Pinout**: ผังขา ESP32, ESP8266, Arduino Uno / Nano, Raspberry Pi Pico พร้อมข้อควรระวัง |
| Electronics | `/color/` | **Color / RGB565**: แปลงสี HEX, RGB, HSL และ RGB565 / RGB888 สำหรับจอ TFT |
| Encode / Decode | `/base64/` | **Base64**: เข้ารหัส / ถอดรหัส Base64 รองรับภาษาไทย URL-safe และไฟล์ |
| Encode / Decode | `/url/` | **URL Encode**: percent-encoding และแยกส่วนประกอบ URL / query |
| Encode / Decode | `/jwt/` | **JWT Decoder**: ถอด header / payload ของ JSON Web Token |
| Text / Data / Time | `/json/` | **JSON**: จัดรูปแบบ ย่อ ตรวจสอบ เรียงคีย์ และ escape JSON |
| Text / Data / Time | `/regex/` | **Regex Tester**: ทดสอบ regular expression ไฮไลต์ผลลัพธ์และ capture group |
| Text / Data / Time | `/diff/` | **Text Diff**: เปรียบเทียบข้อความหรือ config สองชุด แสดงบรรทัดที่เพิ่ม / ลบ |
| Text / Data / Time | `/cron/` | **Cron Expression**: อธิบาย cron เป็นภาษาไทย และแสดงเวลาที่จะรันครั้งถัดไป |
| Text / Data / Time | `/time/` | **Timestamp**: Unix epoch ↔ วันที่เวลา (local / UTC / ISO) |
| Generators | `/uuid/` | **UUID / Random**: สร้าง UUID v4, random bytes และ password |
| Generators | `/qr/` | **QR Code**: สร้าง QR code จากข้อความ URL หรือ Wi-Fi ดาวน์โหลดเป็น PNG / SVG |

## รันในเครื่อง

ไม่มี dependency ต้องติดตั้ง ใช้แค่ Node.js 20 ขึ้นไป

```bash
npm run dev      # build -> dist/ แล้วเปิด server ที่ http://localhost:3000
npm test         # build แล้วรันชุดทดสอบทั้งหมด (node:test ไม่มี dependency)
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

## ใช้งานออฟไลน์ (PWA)

- เปิดเว็บหนึ่งครั้งขณะออนไลน์ เบราว์เซอร์จะเก็บทุกหน้าไว้ในเครื่อง หลังจากนั้นเปิดได้แม้ไม่มีอินเทอร์เน็ต
- ติดตั้งเป็นแอปได้จากไอคอนติดตั้งในแถบที่อยู่ของ Chrome / Edge มีทางลัดไป Serial Monitor, Flasher, Modbus และ Plotter
- `build.mjs` สร้าง `dist/sw.js` ใหม่ทุกครั้ง โดยตั้งชื่อ cache จาก hash ของทุกไฟล์ deploy ใหม่จึงล้าง cache เก่าเอง ผู้ใช้จะเห็นข้อความให้รีเฟรชเมื่อมีเวอร์ชันใหม่

## การทดสอบอัตโนมัติ (CI)

- ชุดทดสอบอยู่ใน `test/` ครอบคลุม codec, hash, Modbus, float, struct, QR (เทียบกับไลบรารีอ้างอิงใน `test/fixtures/`), resistor, diff, cron, ความครบถ้วนของทุกหน้าและลิงก์, PWA และ static server
- GitHub Actions (`.github/workflows/ci.yml`) รันทุกครั้งที่ push ไป `main` และทุก pull request บน Node 20 และ 22
- **ให้ Render deploy เฉพาะเมื่อทดสอบผ่าน**: ใน Render เปิด static site แล้วไปที่ Settings > Build & Deploy > Auto-Deploy เลือก **After CI Checks Pass**

## Modbus ผ่าน Serial / RS485

หน้า `/modbus/` ส่งคำสั่งที่ประกอบไว้ไปยังอุปกรณ์จริงได้ผ่าน USB-RS485 แบบ auto direction รองรับการส่งครั้งเดียวและ polling ตามช่วงเวลา รอคำตอบตามความยาวที่คาดไว้หรือจนเงียบเกิน 3.5 ตัวอักษร ตรวจ CRC และถอดผลตอบกลับให้อัตโนมัติ

## Firmware Flasher

- ใช้ [esptool-js](https://github.com/espressif/esptool-js) 0.6.1 ของ Espressif (Apache-2.0) เก็บไว้ที่ `src/assets/vendor/` และโหลดเฉพาะตอนกดเชื่อมต่อในหน้า `/flash/`
- รองรับ ESP32, ESP32-S2, S3, C2, C3, C5, C6, H2, P4 และ ESP8266 ตรวจสอบ MD5 หลังเขียนทุกไฟล์
- บอร์ด UF2 (Raspberry Pi Pico, Leonardo) ใช้ปุ่ม 1200 baud touch เข้า bootloader แล้วลากไฟล์ .uf2 ลงไดรฟ์
- ยังไม่รองรับ Arduino AVR (Uno/Nano) และ STM32

## หมายเหตุ Web Serial

- รองรับ Chrome, Edge, Opera ไม่รองรับ Firefox / Safari และต้องเปิดผ่าน HTTPS หรือ `localhost`
- เบราว์เซอร์ตรวจสอบหรือติดตั้ง driver ให้ไม่ได้ ถ้า Windows ไม่มี driver ของชิป USB-serial (CP210x, CH340, FTDI) พอร์ตจะไม่ปรากฏ หน้า `/serial/` จะเปิดแผงช่วยเหลือพร้อมลิงก์ดาวน์โหลด driver ให้อัตโนมัติเมื่อผู้ใช้ปิดหน้าต่างเลือกพอร์ตโดยไม่เลือก
