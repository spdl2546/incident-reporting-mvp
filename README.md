# Incident Reporting MVP — Leaflet + OpenStreetMap + Officer Dashboard

ระบบ MVP ประกอบด้วยหน้าแจ้งเหตุประชาชน และหน้า Dashboard เจ้าหน้าที่พร้อม Login/สิทธิ์ ADMIN และ OFFICER

## เทคโนโลยี
- Frontend: React + Vite
- Map: Leaflet + OpenStreetMap
- Backend: Node.js + Express
- Database: PostgreSQL
- Auth: token แบบ HMAC สำหรับ MVP (ควรเปลี่ยน secret ก่อน production)

## เริ่มระบบ
1. Backend
```powershell
cd C:\incident-reporting-mvp\backend
npm.cmd install
npm.cmd run dev
```
2. Frontend
```powershell
cd C:\incident-reporting-mvp\frontend
npm.cmd install
npm.cmd run dev
```
3. เปิด `http://localhost:5173`
4. หน้าเจ้าหน้าที่: `http://localhost:5173/#staff`

## บัญชีทดสอบ
- ADMIN: `admin` / `admin123`
- OFFICER: `officer` / `officer123`

## Database
รัน `database/init.sql` เพื่อสร้างตาราง incidents และ users รวมถึงบัญชีทดสอบ

> สำหรับ production ควรเปลี่ยนรหัสผ่านเริ่มต้น, JWT_SECRET, CORS และใช้ระบบ password/token ที่เหมาะกับ production
