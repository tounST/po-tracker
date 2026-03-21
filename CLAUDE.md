# Memory — PO Tracker Project

## เจ้าของโปรเจค (Boss)
| | |
|---|---|
| **ชื่อ** | toun (tounzx2@gmail.com) |
| **บทบาท** | เจ้าของโรงงานพ่นสีชิ้นส่วนยานยนต์ ABS/PP |
| **พื้นฐาน tech** | ศูนย์ — ไม่เคยเขียน code ไม่เคยเป็น developer มาก่อนเลย |
| **สไตล์การสื่อสาร** | ตรงไปตรงมา วิเคราะห์เป็นข้อ สรุปท้าย |

## วิธีคุยกับ toun
- **ใช้ศัพท์เทคนิคได้** แต่ถ้าถามต้องอธิบายละเอียดทีละขั้น ไม่ข้ามขั้นตอน
- อธิบายเหมือน pitch ลูกค้า — เข้าใจง่าย ทำตามได้ทันที
- ไม่สมมติว่ารู้แล้ว เช่น ถ้าบอกให้ "deploy" ต้องอธิบายทุก step
- ถ้าทำได้เองเลย → ทำให้เลย ไม่ต้องรออธิบาย

## โปรเจคปัจจุบัน — PO Tracker
| | |
|---|---|
| **URL** | https://tounst.github.io/po-tracker/po-mobile.html |
| **Repo** | https://github.com/tounST/po-tracker |
| **Stack** | GitHub Pages + Google Apps Script + Google Sheets |
| **Version ปัจจุบัน** | v4.3-ARCHIVE-UI-2026-03-20 |
| **GAS URL (เดิม)** | https://script.google.com/macros/s/AKfycbwTvCm7tOQ8gT3yQDZcL_BCwaX9M_G-AS3eMbPN5FWDLOgoHKdBnRfbEvaDxGZy6DI/exec |

> ⚠️ GAS ยังไม่ได้ Redeploy เป็น v4.3 — ต้องทำก่อนที่ปุ่ม Archive จะใช้งานได้

## ไฟล์สำคัญ (อยู่ใน repo root)
| ไฟล์ | หน้าที่ |
|---|---|
| `po-mobile.html` | แอปหลัก (v4.3) — มี Archive tab แล้ว |
| `sw.js` | Service Worker — cache + offline |
| `manifest.json` | PWA — install เป็นแอปบนมือถือได้ |
| `po-tracker-gas.js` | GAS backend code (v4.3) — ยังไม่ได้ deploy |

## Bugs ที่แก้ไปแล้วทั้งหมด
| Bug | สถานะ |
|---|---|
| BUG1: fetchFromSheet race condition | ✅ Fixed |
| BUG2: deletePO no rollback | ✅ Fixed |
| BUG3: fixDateStr timestamp | ✅ Fixed |
| BUG4: plain text password → SHA-256 | ✅ Fixed |
| BUG5: PWA manifest + SW registration | ✅ Fixed |
| Chrome ERR_TOO_MANY_REDIRECTS (JSONP → fetch + credentials:omit) | ✅ Fixed |
| sw.js chrome-extension scheme error | ✅ Fixed |

## สิ่งที่ทำเสร็จแล้ว
- ✅ ระบบ Archive ปิดรอบรายเดือน (GAS + UI ครบ)
  - แท็บ Archive ใน po-mobile.html
  - ดูรายการเดือน + คลิกเข้าดูรายละเอียด PO แต่ละเดือน
  - ปุ่ม "Archive ทันที" (Admin only)
  - Auto-archive ทุกวันที่ 1 ของเดือน (ต้องรัน installMonthlyTrigger() ก่อน)

## สิ่งที่ยังค้างอยู่ (ทำต่อได้เลย)
| Priority | งาน | หมายเหตุ |
|---|---|---|
| 🔴 ด่วน | Redeploy GAS v4.3 | วาง po-tracker-gas.js → New deployment → copy URL ใหม่ → รัน installMonthlyTrigger() |
| 🟡 สำคัญ | UI ให้ดู professional ขึ้น | หน้าตาดีขึ้น, logo, สีสัน |
| 🟢 ระยะยาว | Migrate ไป Supabase + proper auth | ตอนนี้ใช้ GAS + Sheets ไปก่อน |

## Architecture & Decision Log
- **ทำไมใช้ JSONP → fetch + credentials:omit**: Chrome ส่ง Google session cookie กับ JSONP → GAS redirect loop → ERR_TOO_MANY_REDIRECTS, Edge ไม่มีปัญหาเพราะ session state ต่างกัน
- **ทำไมใช้ GitHub Pages + GAS**: toun ไม่มี server, ไม่มี budget — ใช้ฟรีทั้งหมด
- **Archive logic**: archive ตามเดือนที่ PO Complete, PO ที่คาบเกี่ยวเดือนให้ค้างไว้จนกว่าจะ Complete
- **SHA-256 password**: เดิมเป็น plain text ใน source code — อันตราย, แก้เป็น hash แล้ว

## Context ธุรกิจ
- โรงงานพ่นสี ABS/PP ชิ้นส่วนยานยนต์
- ปริมาณงาน ~2,000-3,000 ชิ้น/เดือน
- ใช้งานภายในออฟฟิศ + ลูกน้อง
- Role: admin (เจ้าของ) / staff (ลูกน้อง)
- 5 สถานะชิ้นงาน: รับของแล้ว, กำลังผลิต, เตรียมส่ง, ส่งแล้ว, กลับมาแก้ไข
- 4 สถานะ PO: Order, In progress, Partial Send, Complete
