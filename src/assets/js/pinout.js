import { $, $$ } from "/assets/js/common.js";

// Each pin: [label, gpio|null, functions[], note, level]
// level: "ok" usable, "warn" usable with caveats, "danger" avoid, "power" supply/control
// PWM is added automatically per board rule (pwm(gpio, level) -> bool).

const ESP32_WIFI_ADC2 = "ADC2 ใช้ไม่ได้ขณะเปิด Wi-Fi";

const BOARDS = {
  esp32: {
    name: "ESP32 DevKitC (38 ขา)",
    desc: "ESP32-WROOM-32 / DevKitC V4 เรียงจากบนลงล่าง (ช่อง USB อยู่ด้านล่าง) ฝั่งซ้ายก่อนแล้วฝั่งขวา ใช้ logic 3.3 V",
    pwm: (g, lv) => g !== null && !(g >= 34 && g <= 39) && lv !== "danger",
    pins: [
      ["L1 3V3", null, ["3.3V out"], "ไฟเลี้ยง 3.3 V จาก regulator บนบอร์ด", "power"],
      ["L2 EN", null, ["Reset"], "ดึง LOW เพื่อรีเซ็ต (ปุ่ม EN / RST)", "power"],
      ["L3 VP", 36, ["ADC1_CH0"], "Input อย่างเดียว ไม่มี pull-up / pull-down ภายใน", "warn"],
      ["L4 VN", 39, ["ADC1_CH3"], "Input อย่างเดียว ไม่มี pull-up / pull-down ภายใน", "warn"],
      ["L5 D34", 34, ["ADC1_CH6"], "Input อย่างเดียว ไม่มี pull-up / pull-down ภายใน", "warn"],
      ["L6 D35", 35, ["ADC1_CH7"], "Input อย่างเดียว ไม่มี pull-up / pull-down ภายใน", "warn"],
      ["L7 D32", 32, ["ADC1_CH4", "TOUCH9", "32K_XP"], "", "ok"],
      ["L8 D33", 33, ["ADC1_CH5", "TOUCH8", "32K_XN"], "", "ok"],
      ["L9 D25", 25, ["ADC2_CH8", "DAC1"], ESP32_WIFI_ADC2, "ok"],
      ["L10 D26", 26, ["ADC2_CH9", "DAC2"], ESP32_WIFI_ADC2, "ok"],
      ["L11 D27", 27, ["ADC2_CH7", "TOUCH7"], ESP32_WIFI_ADC2, "ok"],
      ["L12 D14", 14, ["ADC2_CH6", "TOUCH6", "HSPI SCK"], "ส่งสัญญาณ PWM ออกมาช่วงบูต", "warn"],
      ["L13 D12", 12, ["ADC2_CH5", "TOUCH5", "HSPI MISO"], "Strapping pin (MTDI กำหนดแรงดัน flash) ถ้าเป็น HIGH ตอนบูตอาจบูตไม่ขึ้น", "danger"],
      ["L14 GND", null, ["GND"], "", "power"],
      ["L15 D13", 13, ["ADC2_CH4", "TOUCH4", "HSPI MOSI"], ESP32_WIFI_ADC2, "ok"],
      ["L16 SD2", 9, ["Flash D2"], "ต่อกับ SPI flash ภายใน ห้ามใช้", "danger"],
      ["L17 SD3", 10, ["Flash D3"], "ต่อกับ SPI flash ภายใน ห้ามใช้", "danger"],
      ["L18 CMD", 11, ["Flash CMD"], "ต่อกับ SPI flash ภายใน ห้ามใช้", "danger"],
      ["L19 5V", null, ["5V in/out"], "ต่อกับ VBUS ของ USB ใช้จ่ายไฟเข้าบอร์ดได้", "power"],
      ["R1 GND", null, ["GND"], "", "power"],
      ["R2 D23", 23, ["VSPI MOSI"], "SPI MOSI ค่าเริ่มต้นของ Arduino", "ok"],
      ["R3 D22", 22, ["I2C SCL"], "SCL ค่าเริ่มต้นของ Arduino (Wire)", "ok"],
      ["R4 TX0", 1, ["UART0 TX"], "ต่อกับชิป USB-Serial ใช้อัปโหลดและ Serial Monitor มีข้อความ debug ตอนบูต", "warn"],
      ["R5 RX0", 3, ["UART0 RX"], "ต่อกับชิป USB-Serial เป็น HIGH ตอนบูต", "warn"],
      ["R6 D21", 21, ["I2C SDA"], "SDA ค่าเริ่มต้นของ Arduino (Wire)", "ok"],
      ["R7 GND", null, ["GND"], "", "power"],
      ["R8 D19", 19, ["VSPI MISO"], "SPI MISO ค่าเริ่มต้นของ Arduino", "ok"],
      ["R9 D18", 18, ["VSPI SCK"], "SPI SCK ค่าเริ่มต้นของ Arduino", "ok"],
      ["R10 D5", 5, ["VSPI SS"], "Strapping pin ต้องเป็น HIGH ตอนบูต และส่ง PWM ออกมาช่วงบูต", "warn"],
      ["R11 TX2", 17, ["UART2 TX"], "บนโมดูล WROVER ใช้กับ PSRAM ห้ามใช้", "ok"],
      ["R12 RX2", 16, ["UART2 RX"], "บนโมดูล WROVER ใช้กับ PSRAM ห้ามใช้", "ok"],
      ["R13 D4", 4, ["ADC2_CH0", "TOUCH0"], ESP32_WIFI_ADC2, "ok"],
      ["R14 D0", 0, ["ADC2_CH1", "TOUCH1"], "Strapping pin ต่อกับปุ่ม BOOT ถ้าเป็น LOW ตอนบูตจะเข้าโหมดอัปโหลด", "warn"],
      ["R15 D2", 2, ["ADC2_CH2", "TOUCH2"], "Strapping pin ต้องเป็น LOW หรือลอยตอนเข้าโหมดอัปโหลด บางบอร์ดต่อ LED", "warn"],
      ["R16 D15", 15, ["ADC2_CH3", "TOUCH3", "HSPI SS"], "Strapping pin (MTDO) ถ้าเป็น LOW ตอนบูตจะปิดข้อความ boot log และส่ง PWM ช่วงบูต", "warn"],
      ["R17 SD1", 8, ["Flash D1"], "ต่อกับ SPI flash ภายใน ห้ามใช้", "danger"],
      ["R18 SD0", 7, ["Flash D0"], "ต่อกับ SPI flash ภายใน ห้ามใช้", "danger"],
      ["R19 CLK", 6, ["Flash CLK"], "ต่อกับ SPI flash ภายใน ห้ามใช้", "danger"],
    ],
    notes: [
      "ADC2 (GPIO 0, 2, 4, 12-15, 25-27) อ่านค่าไม่ได้ขณะใช้ Wi-Fi ถ้าต้องอ่าน analog พร้อม Wi-Fi ให้ใช้ ADC1 (GPIO 32-39)",
      "GPIO 34-39 เป็น input อย่างเดียว ไม่มี pull-up / pull-down ภายใน",
      "GPIO 6-11 ต่อกับ SPI flash ภายในโมดูล ห้ามนำไปใช้",
      "Strapping pins คือ GPIO 0, 2, 5, 12, 15 อย่าต่ออุปกรณ์ที่ดึงสถานะของขาเหล่านี้ตอนเปิดเครื่อง",
      "ขา output ทุกขาใช้ PWM ได้ผ่าน LEDC และ map I2C / SPI / UART ไปขาอื่นได้ผ่าน GPIO matrix",
      "Logic 3.3 V ไม่รองรับสัญญาณ 5 V โดยตรง",
    ],
  },

  esp8266: {
    name: "ESP8266 NodeMCU",
    desc: "NodeMCU v2 / v3 (ESP-12E / 12F) ชื่อขา D0-D8 ตามที่พิมพ์บนบอร์ด ใช้ logic 3.3 V",
    pwm: (g, lv) => g !== null && g <= 15 && lv !== "danger",
    pins: [
      ["A0", null, ["ADC0"], "ADC 10-bit ชิปรับ 0-1 V แต่ NodeMCU มีตัวแบ่งแรงดันให้รับ 0-3.3 V", "ok"],
      ["D0", 16, ["Wake"], "ไม่รองรับ PWM, interrupt และ I2C เป็น HIGH ตอนบูต ต่อกับ RST เพื่อปลุกจาก deep sleep", "warn"],
      ["D1", 5, ["I2C SCL"], "SCL ค่าเริ่มต้น", "ok"],
      ["D2", 4, ["I2C SDA"], "SDA ค่าเริ่มต้น", "ok"],
      ["D3", 0, ["FLASH"], "ต่อกับปุ่ม FLASH มี pull-up ถ้าเป็น LOW ตอนบูตจะเข้าโหมดอัปโหลด", "warn"],
      ["D4", 2, ["UART1 TX"], "มี pull-up ต่อกับ LED บนโมดูล (active LOW) ถ้าเป็น LOW ตอนบูตจะบูตไม่ขึ้น", "warn"],
      ["D5", 14, ["HSPI SCK"], "", "ok"],
      ["D6", 12, ["HSPI MISO"], "", "ok"],
      ["D7", 13, ["HSPI MOSI", "UART0 RX (swap)"], "", "ok"],
      ["D8", 15, ["HSPI SS", "UART0 TX (swap)"], "มี pull-down ถ้าเป็น HIGH ตอนบูตจะบูตไม่ขึ้น", "warn"],
      ["RX", 3, ["UART0 RX"], "ต่อกับชิป USB-Serial เป็น HIGH ตอนบูต", "warn"],
      ["TX", 1, ["UART0 TX"], "ต่อกับชิป USB-Serial มีข้อความ debug ตอนบูต ถ้าถูกดึง LOW ตอนบูตจะบูตไม่ขึ้น", "warn"],
      ["SD2", 9, ["Flash"], "ต่อกับ SPI flash ภายใน หลีกเลี่ยง", "danger"],
      ["SD3", 10, ["Flash"], "ต่อกับ SPI flash ภายใน หลีกเลี่ยง", "danger"],
      ["CMD / SD0 / SD1 / CLK", null, ["Flash"], "GPIO 6, 7, 8, 11 ต่อกับ SPI flash ห้ามใช้", "danger"],
      ["3V3", null, ["3.3V out"], "", "power"],
      ["Vin", null, ["5V in"], "จ่ายไฟเข้าบอร์ดได้ (ผ่าน regulator)", "power"],
      ["EN / RST", null, ["Enable / Reset"], "ดึง LOW เพื่อปิดหรือรีเซ็ต", "power"],
      ["GND", null, ["GND"], "", "power"],
    ],
    notes: [
      "ขาที่ใช้ได้ไม่มีเงื่อนไขมากที่สุดคือ D1, D2, D5, D6, D7",
      "GPIO 0, 2 ต้องเป็น HIGH และ GPIO 15 ต้องเป็น LOW ตอนบูต ไม่อย่างนั้นบอร์ดจะบูตไม่ขึ้น",
      "PWM เป็นแบบ software ใช้ได้กับ GPIO 0-15 ส่วน GPIO16 ไม่รองรับ PWM และ interrupt",
      "มี ADC เพียงขาเดียวคือ A0",
      "Logic 3.3 V ไม่รองรับสัญญาณ 5 V โดยตรง",
    ],
  },

  esp32c3: {
    name: "ESP32-C3 SuperMini",
    desc: "บอร์ดขนาดเล็ก ESP32-C3 ใช้ USB native (ไม่ต้องลง driver) ชื่อขาเป็นเลข GPIO ใช้ logic 3.3 V ค่าเริ่มต้น I2C / SPI อ้างอิง Arduino core",
    pwm: (g, lv) => g !== null && lv !== "danger",
    pins: [
      ["5V", null, ["5V in/out"], "ต่อกับ VBUS ของ USB", "power"],
      ["GND", null, ["GND"], "", "power"],
      ["3V3", null, ["3.3V out"], "", "power"],
      ["GPIO0", 0, ["ADC1_CH0", "32K_XP"], "", "ok"],
      ["GPIO1", 1, ["ADC1_CH1", "32K_XN"], "", "ok"],
      ["GPIO2", 2, ["ADC1_CH2"], "Strapping pin อย่าดึงสถานะขานี้ตอนบูต", "warn"],
      ["GPIO3", 3, ["ADC1_CH3"], "", "ok"],
      ["GPIO4", 4, ["ADC1_CH4", "SPI SCK"], "SPI SCK ค่าเริ่มต้นของ Arduino", "ok"],
      ["GPIO5", 5, ["ADC2_CH0", "SPI MISO"], "SPI MISO ค่าเริ่มต้นของ Arduino / ADC2 ไม่แนะนำให้ใช้อ่าน analog", "ok"],
      ["GPIO6", 6, ["SPI MOSI"], "SPI MOSI ค่าเริ่มต้นของ Arduino", "ok"],
      ["GPIO7", 7, ["SPI SS"], "SPI SS ค่าเริ่มต้นของ Arduino", "ok"],
      ["GPIO8", 8, ["I2C SDA"], "Strapping pin ต่อกับ LED บนบอร์ด (active LOW) และเป็น SDA ค่าเริ่มต้นของ Arduino", "warn"],
      ["GPIO9", 9, ["I2C SCL"], "Strapping pin ต่อกับปุ่ม BOOT ถ้าเป็น LOW ตอนบูตจะเข้าโหมดอัปโหลด และเป็น SCL ค่าเริ่มต้นของ Arduino", "warn"],
      ["GPIO10", 10, [], "", "ok"],
      ["GPIO20", 20, ["UART0 RX"], "UART0 RX (Serial1 / Serial เมื่อปิด USB CDC)", "warn"],
      ["GPIO21", 21, ["UART0 TX"], "UART0 TX มีข้อความ boot log ตอนบูต", "warn"],
    ],
    notes: [
      "Strapping pins คือ GPIO 2, 8, 9 กด BOOT (GPIO9) ค้างแล้วกด RESET เพื่อเข้าโหมดอัปโหลด",
      "GPIO 18 / 19 ใช้เป็น USB D- / D+ ภายใน ไม่ได้ออกมาที่ขา",
      "ADC1 อยู่ที่ GPIO 0-4 ส่วน GPIO5 เป็น ADC2 ซึ่งไม่แนะนำให้ใช้อ่าน analog",
      "ทุกขา output ใช้ PWM ได้ผ่าน LEDC และ map I2C / SPI / UART ไปขาอื่นได้",
      "เวลาเปิด Serial Monitor ผ่าน USB ต้องเปิดตัวเลือก USB CDC On Boot ใน Arduino IDE",
    ],
  },

  uno: {
    name: "Arduino Uno R3",
    desc: "ATmega328P ใช้ logic 5 V ขา A0-A5 ใช้เป็น digital 14-19 ได้",
    pwm: () => false,
    pins: [
      ["D0 / RX", 0, ["UART RX"], "ต่อกับชิป USB-Serial หลีกเลี่ยงตอนอัปโหลดหรือใช้ Serial", "warn"],
      ["D1 / TX", 1, ["UART TX"], "ต่อกับชิป USB-Serial หลีกเลี่ยงตอนอัปโหลดหรือใช้ Serial", "warn"],
      ["D2", 2, ["INT0"], "External interrupt", "ok"],
      ["D3", 3, ["PWM", "INT1"], "PWM ~490 Hz (Timer2)", "ok"],
      ["D4", 4, [], "", "ok"],
      ["D5", 5, ["PWM"], "PWM ~980 Hz (Timer0)", "ok"],
      ["D6", 6, ["PWM"], "PWM ~980 Hz (Timer0)", "ok"],
      ["D7", 7, [], "", "ok"],
      ["D8", 8, [], "", "ok"],
      ["D9", 9, ["PWM"], "PWM ~490 Hz (Timer1) ใช้ร่วมกับไลบรารี Servo", "ok"],
      ["D10", 10, ["PWM", "SPI SS"], "ต้องตั้งเป็น OUTPUT เมื่อใช้ SPI แบบ master", "ok"],
      ["D11", 11, ["PWM", "SPI MOSI"], "", "ok"],
      ["D12", 12, ["SPI MISO"], "", "ok"],
      ["D13", 13, ["SPI SCK"], "ต่อกับ LED บนบอร์ด (L)", "ok"],
      ["A0", 14, ["ADC0"], "", "ok"],
      ["A1", 15, ["ADC1"], "", "ok"],
      ["A2", 16, ["ADC2"], "", "ok"],
      ["A3", 17, ["ADC3"], "", "ok"],
      ["A4", 18, ["ADC4", "I2C SDA"], "SDA (ซ้ำกับขา SDA ใกล้ AREF)", "ok"],
      ["A5", 19, ["ADC5", "I2C SCL"], "SCL (ซ้ำกับขา SCL ใกล้ AREF)", "ok"],
      ["5V", null, ["5V"], "", "power"],
      ["3.3V", null, ["3.3V out"], "จ่ายกระแสได้น้อย (ประมาณ 50 mA)", "power"],
      ["Vin", null, ["7-12V in"], "ไฟเข้าแนะนำ 7-12 V ผ่าน regulator", "power"],
      ["AREF", null, ["ADC ref"], "แรงดันอ้างอิงภายนอกของ ADC", "power"],
      ["RESET", null, ["Reset"], "ดึง LOW เพื่อรีเซ็ต", "power"],
      ["GND", null, ["GND"], "", "power"],
    ],
    notes: [
      "Logic 5 V ระวังเมื่อต่อกับเซนเซอร์ 3.3 V",
      "กระแสต่อขาไม่ควรเกิน 20 mA ในการใช้งานต่อเนื่อง (สูงสุดตาม datasheet 40 mA)",
      "ADC 10-bit (0-1023) อ้างอิง 5 V โดยค่าเริ่มต้น",
      "PWM มี 6 ขา: D3, D5, D6, D9, D10, D11",
    ],
  },

  nano: {
    name: "Arduino Nano",
    desc: "ATmega328P เหมือน Uno แต่มี A6 / A7 เพิ่ม ใช้ logic 5 V บอร์ด clone มักใช้ชิป CH340 ต้องลง driver",
    pwm: () => false,
    pins: [
      ["D0 / RX", 0, ["UART RX"], "ต่อกับชิป USB-Serial หลีกเลี่ยงตอนอัปโหลด", "warn"],
      ["D1 / TX", 1, ["UART TX"], "ต่อกับชิป USB-Serial หลีกเลี่ยงตอนอัปโหลด", "warn"],
      ["D2", 2, ["INT0"], "", "ok"],
      ["D3", 3, ["PWM", "INT1"], "", "ok"],
      ["D4", 4, [], "", "ok"],
      ["D5", 5, ["PWM"], "", "ok"],
      ["D6", 6, ["PWM"], "", "ok"],
      ["D7", 7, [], "", "ok"],
      ["D8", 8, [], "", "ok"],
      ["D9", 9, ["PWM"], "", "ok"],
      ["D10", 10, ["PWM", "SPI SS"], "", "ok"],
      ["D11", 11, ["PWM", "SPI MOSI"], "", "ok"],
      ["D12", 12, ["SPI MISO"], "", "ok"],
      ["D13", 13, ["SPI SCK"], "ต่อกับ LED บนบอร์ด", "ok"],
      ["A0-A3", null, ["ADC0-3"], "ใช้เป็น digital 14-17 ได้", "ok"],
      ["A4", 18, ["ADC4", "I2C SDA"], "", "ok"],
      ["A5", 19, ["ADC5", "I2C SCL"], "", "ok"],
      ["A6", null, ["ADC6"], "Analog input อย่างเดียว ใช้เป็น digital ไม่ได้", "warn"],
      ["A7", null, ["ADC7"], "Analog input อย่างเดียว ใช้เป็น digital ไม่ได้", "warn"],
      ["5V", null, ["5V"], "", "power"],
      ["3V3", null, ["3.3V out"], "จ่ายกระแสได้น้อยมาก", "power"],
      ["VIN", null, ["7-12V in"], "", "power"],
      ["AREF", null, ["ADC ref"], "", "power"],
      ["RST", null, ["Reset"], "", "power"],
      ["GND", null, ["GND"], "", "power"],
    ],
    notes: [
      "บอร์ด clone ที่ใช้ CH340 ต้องติดตั้ง driver ก่อน และบางรุ่นต้องเลือก Processor: ATmega328P (Old Bootloader) ใน Arduino IDE",
      "A6 / A7 อ่าน analog ได้อย่างเดียว",
      "PWM มี 6 ขา: D3, D5, D6, D9, D10, D11",
    ],
  },

  pico: {
    name: "Raspberry Pi Pico",
    desc: "RP2040 เลขขาจริง 1-40 (ขา 1 อยู่มุมบนซ้ายข้าง USB) ใช้ logic 3.3 V I2C / SPI / UART เลือกได้หลายขา แสดงเฉพาะค่าเริ่มต้นของ Arduino-Pico",
    pwm: (g, lv) => g !== null && lv !== "danger",
    pins: [
      ["1", 0, ["UART0 TX", "I2C0 SDA", "SPI0 RX"], "Serial1 TX ค่าเริ่มต้น", "ok"],
      ["2", 1, ["UART0 RX", "I2C0 SCL", "SPI0 CSn"], "Serial1 RX ค่าเริ่มต้น", "ok"],
      ["3 GND", null, ["GND"], "", "power"],
      ["4", 2, ["I2C1 SDA", "SPI0 SCK"], "", "ok"],
      ["5", 3, ["I2C1 SCL", "SPI0 TX"], "", "ok"],
      ["6", 4, ["UART1 TX", "I2C0 SDA", "SPI0 RX"], "Wire SDA ค่าเริ่มต้น", "ok"],
      ["7", 5, ["UART1 RX", "I2C0 SCL", "SPI0 CSn"], "Wire SCL ค่าเริ่มต้น", "ok"],
      ["8 GND", null, ["GND"], "", "power"],
      ["9", 6, ["I2C1 SDA", "SPI0 SCK"], "", "ok"],
      ["10", 7, ["I2C1 SCL", "SPI0 TX"], "", "ok"],
      ["11", 8, ["UART1 TX", "I2C0 SDA", "SPI1 RX"], "", "ok"],
      ["12", 9, ["UART1 RX", "I2C0 SCL", "SPI1 CSn"], "", "ok"],
      ["13 GND", null, ["GND"], "", "power"],
      ["14", 10, ["I2C1 SDA", "SPI1 SCK"], "", "ok"],
      ["15", 11, ["I2C1 SCL", "SPI1 TX"], "", "ok"],
      ["16", 12, ["UART0 TX", "I2C0 SDA", "SPI1 RX"], "", "ok"],
      ["17", 13, ["UART0 RX", "I2C0 SCL", "SPI1 CSn"], "", "ok"],
      ["18 GND", null, ["GND"], "", "power"],
      ["19", 14, ["I2C1 SDA", "SPI1 SCK"], "", "ok"],
      ["20", 15, ["I2C1 SCL", "SPI1 TX"], "", "ok"],
      ["21", 16, ["UART0 TX", "I2C0 SDA", "SPI0 RX"], "SPI MISO ค่าเริ่มต้น", "ok"],
      ["22", 17, ["UART0 RX", "I2C0 SCL", "SPI0 CSn"], "SPI CS ค่าเริ่มต้น", "ok"],
      ["23 GND", null, ["GND"], "", "power"],
      ["24", 18, ["I2C1 SDA", "SPI0 SCK"], "SPI SCK ค่าเริ่มต้น", "ok"],
      ["25", 19, ["I2C1 SCL", "SPI0 TX"], "SPI MOSI ค่าเริ่มต้น", "ok"],
      ["26", 20, ["UART1 TX", "I2C0 SDA", "SPI0 RX"], "", "ok"],
      ["27", 21, ["UART1 RX", "I2C0 SCL", "SPI0 CSn"], "", "ok"],
      ["28 GND", null, ["GND"], "", "power"],
      ["29", 22, ["I2C1 SDA", "SPI0 SCK"], "", "ok"],
      ["30 RUN", null, ["Reset"], "ดึง LOW เพื่อรีเซ็ต RP2040", "power"],
      ["31", 26, ["ADC0", "I2C1 SDA", "SPI1 SCK"], "", "ok"],
      ["32", 27, ["ADC1", "I2C1 SCL", "SPI1 TX"], "", "ok"],
      ["33 AGND", null, ["GND (analog)"], "", "power"],
      ["34", 28, ["ADC2", "UART0 TX", "I2C0 SDA", "SPI1 RX"], "", "ok"],
      ["35 ADC_VREF", null, ["ADC ref"], "แรงดันอ้างอิงของ ADC", "power"],
      ["36 3V3(OUT)", null, ["3.3V out"], "จ่ายไฟให้วงจรภายนอกได้ไม่มาก (ประมาณ 300 mA รวมทั้งบอร์ด)", "power"],
      ["37 3V3_EN", null, ["Enable"], "ดึง LOW เพื่อปิด regulator 3.3 V", "power"],
      ["38 GND", null, ["GND"], "", "power"],
      ["39 VSYS", null, ["1.8-5.5V in"], "ไฟเข้าหลักของบอร์ด", "power"],
      ["40 VBUS", null, ["5V USB"], "ไฟ 5 V จาก USB", "power"],
    ],
    notes: [
      "LED บนบอร์ดคือ GPIO25 (Pico) ส่วน Pico W ต่อ LED ผ่านชิป Wi-Fi ใช้ชื่อ LED_BUILTIN",
      "ทุก GPIO ใช้ PWM ได้ และ ADC มี 3 ขาที่ GPIO 26-28 (12-bit)",
      "ไม่มีขา strapping ที่กระทบการบูต เข้าโหมดอัปโหลดด้วยการกดปุ่ม BOOTSEL ค้างตอนเสียบ USB",
      "Logic 3.3 V ไม่รองรับสัญญาณ 5 V",
    ],
  },
};

const FILTERS = [
  ["all", "ทั้งหมด"],
  ["safe", "ใช้ได้ทั่วไป"],
  ["adc", "ADC"],
  ["pwm", "PWM"],
  ["i2c", "I2C"],
  ["spi", "SPI"],
  ["uart", "UART"],
  ["touch", "Touch / DAC"],
];

const LEVEL_LABEL = { ok: "ใช้ได้", warn: "มีเงื่อนไข", danger: "หลีกเลี่ยง", power: "ไฟ / ควบคุม" };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function tagsOf(fns, hasPwm) {
  const s = fns.join(" ");
  const t = new Set();
  if (/ADC/.test(s)) t.add("adc");
  if (/I2C|SDA|SCL/.test(s)) t.add("i2c");
  if (/SPI|MOSI|MISO|SCK/.test(s) && !/Flash/.test(s)) t.add("spi");
  if (/UART/.test(s)) t.add("uart");
  if (/TOUCH|DAC/.test(s)) t.add("touch");
  if (hasPwm || /\bPWM\b/.test(s)) t.add("pwm");
  return t;
}

const fnClass = (f) => (/^ADC/.test(f) ? "adc" : /I2C|SDA|SCL/.test(f) ? "i2c" : /Flash/.test(f) ? "flash" : /SPI/.test(f) ? "spi" : /UART/.test(f) ? "uart" : f === "PWM" ? "pwm" : /TOUCH|DAC/.test(f) ? "touch" : "other");

let board = "esp32", filter = "all";

function render() {
  const b = BOARDS[board];
  $("#boardDesc").textContent = b.desc;
  const q = $("#pinSearch").value.trim().toLowerCase();
  let shown = 0;
  const rows = b.pins.map(([label, gpio, fns, note, lv]) => {
    const pwm = b.pwm(gpio, lv) && lv !== "power";
    const tags = tagsOf(fns, pwm);
    const allFns = pwm && !fns.includes("PWM") ? [...fns, "PWM"] : fns;
    const pass =
      (filter === "all" || (filter === "safe" ? lv === "ok" : tags.has(filter))) &&
      (!q || `${label} gpio${gpio ?? ""} ${allFns.join(" ")} ${note}`.toLowerCase().includes(q));
    if (!pass) return "";
    shown++;
    return `<tr class="pin-row pin-${lv}">
      <td><span class="pin-label"><i class="lv lv-${lv}" title="${LEVEL_LABEL[lv]}"></i>${esc(label)}</span></td>
      <td class="mono">${gpio === null ? "-" : "GPIO" + gpio}</td>
      <td>${allFns.map((f) => `<span class="fn fn-${fnClass(f)}">${esc(f)}</span>`).join("")}</td>
      <td class="pin-note">${esc(note)}</td>
    </tr>`;
  });
  $("#pinBody").innerHTML = shown ? rows.join("") : `<tr><td colspan="4" class="muted">ไม่พบขาที่ตรงกับเงื่อนไข</td></tr>`;
  $("#pinCount").textContent = `${shown} / ${b.pins.length} ขา`;
  $("#boardNotes").innerHTML = `<h2>ข้อควรระวังของ ${esc(b.name)}</h2><ul class="pin-notes">${b.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`;
}

// board tabs
const tabs = $("#boardTabs");
for (const [key, b] of Object.entries(BOARDS)) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn sm";
  btn.setAttribute("role", "tab");
  btn.dataset.board = key;
  btn.textContent = b.name;
  btn.addEventListener("click", () => {
    board = key;
    $$("#boardTabs .btn").forEach((x) => { const on = x === btn; x.classList.toggle("primary", on); x.setAttribute("aria-selected", String(on)); });
    try { history.replaceState(null, "", "#" + key); } catch {}
    render();
  });
  tabs.appendChild(btn);
}
// function filters
const fl = $("#pinFilters");
for (const [key, label] of FILTERS) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn sm" + (key === "all" ? " primary" : "");
  btn.textContent = label;
  btn.setAttribute("aria-pressed", String(key === "all"));
  btn.addEventListener("click", () => {
    filter = key;
    $$("#pinFilters .btn").forEach((x) => { const on = x === btn; x.classList.toggle("primary", on); x.setAttribute("aria-pressed", String(on)); });
    render();
  });
  fl.appendChild(btn);
}
$("#pinSearch").addEventListener("input", render);

const fromHash = location.hash.slice(1);
const start = BOARDS[fromHash] ? fromHash : "esp32";
$(`#boardTabs [data-board="${start}"]`).click();
