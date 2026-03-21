# Memory — PO Tracker Project

## เจ้าของโปรเจค (Boss)
| | |
|---|---|
| **ชื่อ** | toun (tounzx2@gmail.com) |
| **บทบาท** | เจ้าของโรงงานพ่นสีชิ้นส่วนยานยนต์ ABS/PP |
| **พื้นฐาน tech** | ศูนย์ — ไม่เคยเขียน code ไม่เคยเป็น developer |
| **สไตล์การสื่อสาร** | ตรงไปตรงมา วิเคราะห์เป็นข้อ สรุปท้าย |

## การอธิบาย
- **ใช้ศัพท์เทคนิคได้** แต่ถ้าถามต้องอธิบายละเอียดทีละขั้น
- เปรียบเหมือน pitch ลูกค้า — เข้าใจง่าย ทำตามได้ทันที
- ไม่ข้ามขั้นตอน ไม่สมมติว่ารู้แล้ว

## โปรเจคปัจจุบัน — PO Tracker
| | |
|---|---|
| **URL** | https://tounst.github.io/po-tracker/po-mobile.html |
| **Repo** | https://github.com/tounST/po-tracker |
| **Stack** | GitHub Pages + Google Apps Script + Google Sheets |
| **Version** | v3.6-BUGFIX-2026-03-20 |
| **GAS URL** | https://script.google.com/macros/s/AKfycbwTvCm7tOQ8gT3yQDZcL_BCwaX9M_G-AS3eMbPN5FWDLOgoHKdBnRfbEvaDxGZy6DI/exec |

## ไฟล์สำคัญ (workspace)
| ไฟล์ | อยู่ที่ |
|---|---|
| po-mobile-fixed.html | po-tracker-fix/ ← ไฟล์ที่แก้แล้ว |
| sw.js | po-tracker-fix/ ← Service Worker |
| manifest.json | po-tracker-fix/ ← PWA manifest |
| po-tracker-gas.js | root ← GAS backend code |

## Bugs ที่แก้ไปแล้ว
| Bug | สถานะ |
|---|---|
| BUG1: fetchFromSheet race condition | ✅ Fixed |
| BUG2: deletePO no rollback | ✅ Fixed |
| BUG3: fixDateStr timestamp | ✅ Fixed |
| BUG4: plain text password → SHA-256 | ✅ Fixed |
| BUG5: PWA manifest + SW registration | ✅ Fixed |
| Chrome ERR_TOO_MANY_REDIRECTS (JSONP → fetch + credentials:omit) | ✅ Fixed |
| sw.js chrome-extension scheme error | ✅ Fixed |

## Roadmap ที่คุยกัน
| Priority | Feature | สถานะ |
|---|---|---|
| 🔴 ด่วน | ระบบ Archive ปิดรอบรายเดือน | ยังไม่ทำ |
| 🟡 สำคัญ | UI ให้ดู professional ขึ้น | ยังไม่ทำ |
| 🟢 ระยะยาว | Migrate ไป Supabase + proper auth | ยังไม่ทำ |

## Context ธุรกิจ
- โรงงานพ่นสี ABS/PP ชิ้นส่วนยานยนต์
- ปริมาณงาน ~2,000-3,000 ชิ้น/เดือน
- ใช้งานภายในออฟฟิศ + ลูกน้อง
- Role: admin (เจ้าของ) / staff (ลูกน้อง)
- 5 สถานะชิ้นงาน: รับของแล้ว, กำลังผลิต, เตรียมส่ง, ส่งแล้ว, กลับมาแก้ไข
→ รายละเอียดเพิ่ม: memory/context/
