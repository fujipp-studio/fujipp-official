# Roblox Payout Test

Feature `roblox-payout-test` เป็นตัวทดลองแยกจาก `roblox-robux-payout` เดิม ใช้คำสั่ง `/robux-payout-test` เฉพาะผู้ดูแลเซิร์ฟเวอร์เพื่อส่งคำขอโอนจริง **1 Robux** และแสดงผล challenge ที่ Roblox ส่งกลับ โดยไม่ใช้ยอดเงินในกระเป๋าของร้าน

## เปิดใช้สำหรับทดสอบ

1. หลัง deploy migration และ bot runner ให้ตรวจใน **Admin → Packages** ว่ามี `Roblox Payout Test` (product ID `e0710000-0000-0000-0000-000000000001`) หากไม่มีในหน้า Admin แสดงว่า migration ยังไม่ถูก apply สำเร็จ Feature นี้อยู่ในสถานะ `DRAFT` จึงไม่แสดงในหน้าร้านทั่วไป แต่เวอร์ชัน `1.0.0` อยู่ในสถานะ `PUBLISHED` แล้ว
2. ไปที่ **Admin → Users** เลือกบัญชีเจ้าของบอท แล้ว grant `Roblox Payout Test` ในหน้าต่าง **Features** โดยตั้ง installation limit อย่างน้อย 1
3. ไปที่ **My Bots** เลือกติดตั้ง Feature จากรายการ Package Inventory ลงบนบอท แล้วเปิดการตั้งค่า Feature นั้น ตั้ง `ROBLOX_TEST_GROUP_ID` และ `ROBLOX_TEST_RECIPIENT_ID` เป็นเลข ID ของกลุ่มต้นทางและบัญชีผู้รับ
4. ใส่ `.ROBLOSECURITY` ของบัญชีที่มีสิทธิ์จ่ายจากกลุ่มในช่องลับ `ROBLOX_TEST_COOKIE` โดยใส่เฉพาะค่าคุกกี้ หากบัญชีเปิด authenticator 2FA ให้ใส่ TOTP secret ใน `ROBLOX_TEST_TOTP_SECRET` ด้วย
5. ผู้ดูแลเซิร์ฟเวอร์ใช้ `/robux-payout-test` ตรวจสอบ Group ID และ Recipient ID แล้วกดปุ่มยืนยันภายใน 5 นาที คำสั่งนี้ส่งคำขอโอน **จริง** ครั้งละ 1 Robux

ผลลัพธ์จะแสดงรหัสข้อผิดพลาด เช่น `ROBLOX_CHALLENGE_CAPTCHA`, `ROBLOX_SESSION_BLOCKED`, `ROBLOX_2FA_REQUIRED` หรือ `ROBLOX_CHALLENGE_CHEF` โดยไม่แสดงคุกกี้หรือ TOTP secret ถ้าผลการโอนไม่แน่ชัด ให้ตรวจประวัติการจ่ายใน Roblox ก่อนกดทดสอบซ้ำ

ตัวทดลองสามารถดำเนิน challenge แบบ `chef` และ authenticator 2FA ที่ Roblox ยอมรับได้ แต่จะหยุดเมื่อ Roblox ขอ CAPTCHA หรือบล็อก session; การแก้ CAPTCHA ต้องทำผ่าน Roblox โดยเจ้าของบัญชี

`ROBLOX_SESSION_BLOCKED` ไม่ใช่ CAPTCHA ผลทดสอบจะแสดงว่าถูกปฏิเสธตอนส่งคำขอโอน, ยืนยัน `chef` หรือยืนยัน 2FA พร้อม HTTP status, รหัสเหตุผลที่ปลอดภัยต่อการแสดง และเวลา `Retry-After` เฉพาะเมื่อ Roblox ส่งมา หากไม่มี `Retry-After` จะไม่สามารถระบุเวลาปลดบล็อกได้ ให้หยุดคำขอโอนจากบอท ตรวจการแจ้งเตือนความปลอดภัยของบัญชี Roblox และใช้ช่องทาง Roblox เพื่อจัดการการยืนยันตัวตนก่อนทดสอบอีกครั้ง
