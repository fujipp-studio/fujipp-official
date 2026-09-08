# ตรวจประสิทธิภาพ Frontend โดยคง UI เดิม

วันที่ตรวจ baseline: 7 กันยายน 2026 · commit `ec9ca6e` · branch `perf/frontend-smoothness-audit`

วันที่ทำเสร็จ: 8 กันยายน 2026 · ผลหลังปรับและการตรวจรับอยู่ท้ายรายงาน

## ข้อสรุป

ควรเริ่มจากลด query ของหน้า Work, ปรับ polling ของ My Bot, เปลี่ยนลิงก์ภายในให้ใช้ Vue Router และลดการโหลดข้อมูลซ้ำ จากนั้นค่อยแยกโค้ดที่ยังไม่จำเป็นตอนเปิดหน้า ทั้งหมดทำได้โดยรักษาสี ฟอนต์ ระยะห่าง โครงหน้า และหน้าตาของปุ่มเดิม

ดำเนินการตามแผนที่ผู้ใช้อนุมัติแล้ว: ลด query/การอ่านซ้ำ, โหลดข้อมูลตามที่แสดง, แยกคำแปลและ editor, ปรับ polling และย้าย artwork ที่ไม่ใช้ในเว็บออกจากไฟล์ deploy โดยเก็บต้นฉบับไว้ หัวข้อ 1–10 ด้านล่างบันทึกหลักฐานก่อนปรับที่ commit baseline; งานฐานข้อมูลที่ต้องใช้สถิติ production ยังคงเป็นข้อเสนอสำหรับตรวจเพิ่ม ไม่มี schema migration ในงานนี้

## หลักฐาน baseline ก่อนปรับ

- `bun run build` ผ่านทั้ง type check และ production build
- `bun run performance:bundle` ผ่าน: initial JS **126.5 KiB gzip**, CSS **17.9 KiB gzip** เทียบกับเกณฑ์ 180/50 KiB
- Build เตือน `INEFFECTIVE_DYNAMIC_IMPORT` สำหรับ `AppAuthDialog.vue` และ `AppAuthLoadingOverlay.vue`; พบข้อความของ Auth dialog ใน entry JS จริง
- ใช้ Chromium กับ production build ในเครื่อง วัด Home/About ทั้ง EN/TH ที่ 1440×900 (DPR 1) และ 390×844 (DPR 3) ด้วย browser context ใหม่ทุกครั้ง
- ตรวจ resource หลังเปิดหน้า 2.4 วินาที โดยบล็อก API ภายนอก และใช้ campaign จำลองเฉพาะส่วน Donate ในหน้า About
- ทดสอบคลิกปุ่ม Work บน Home: browser ส่ง document request ใหม่ไป `/work` ยืนยันการโหลดทั้งหน้าใหม่
- อ่าน headers ของเว็บสาธารณะ `https://fujipp.com/` และ JS/CSS/ภาพที่อ้างอิงจากเว็บจริง

| ชุดไฟล์ที่โหลดจริง | JS gzip* | CSS gzip* |
| --- | ---: | ---: |
| Home EN/TH ทั้งสองขนาดจอ | 129.8 KiB | 20.2 KiB |
| About EN/TH ทั้งสองขนาดจอ | 148.6 KiB | 21.8 KiB |

\* คำนวณ gzip ของไฟล์ build ที่พบใน resource log ไม่ใช่จำนวน byte ที่โฮสต์ส่งจริง ซึ่งปัจจุบันใช้ Brotli ด้วย ตัวเลขนี้รวม lazy chunk ที่หน้าเหล่านี้โหลด แต่ไม่รวมรูป ฟอนต์ หรือ JSON ของ API

Home EN โหลดฟอนต์ 3 ไฟล์; TH โหลด 7 ไฟล์ โดยยังใช้ฟอนต์เดิมตามดีไซน์ ทั้งสองหน้าที่ทดสอบในสถานะ guest **ไม่ได้โหลด Supabase chunk** การแยกโหลด Auth SDK ที่มีอยู่จึงทำงานแล้ว

การตรวจนี้ยังไม่ได้วัด LCP/INP/FPS บนมือถือจริง หรือ latency/query plan ของฐานข้อมูล production จึงไม่ใช้ผลขนาดไฟล์เพื่ออ้างเปอร์เซ็นต์ความเร็วที่เพิ่มขึ้น

## งานที่ควรทำตามลำดับ

### 1. สูง — ลด query ต่อชิ้นของหน้า Work

หลักฐาน: `backend/src/main/java/com/fujipp/backend/work/WorkRepository.java:82` และ `:111`; `WorkService.java:33`

`findPublishedPage()` เรียก `findPositions()`, `findTechnologies()` และ `findMedia()` ภายใน row mapper ของทุก project แต่ละเมธอดยิง SQL แยก อีกทั้งโหลด gallery ทั้งหมดเพื่อเลือกภาพแรก จึงมี query ประมาณ `1 + 3N` ต่อหน้า โดย N รวมแถวส่วนเกินที่ใช้ตรวจ `hasMore` เช่น 100 แถว = 301 query; ถ้าอ่าน 101 แถว = 304 query ตัวเลขนี้คำนวณจากโค้ด ไม่ใช่ measurement ของ production

แนวทาง: อ่าน project page ก่อน แล้วดึง positions/technologies/cover ของ project IDs ในหน้านั้นแบบกลุ่ม ตั้งเป้าประมาณ 4 query ต่อหน้า โดยรักษาลำดับและ response contract เดิม และเลือก cover ที่ฐานข้อมูลแทนการส่ง gallery ทั้งหมดมาให้ Java เลือก

ตรวจรับ: response เหมือนเดิมทั้ง EN/TH, featured/filter/cursor ถูกต้อง และจำนวน query ไม่เพิ่มตามจำนวน project ในหน้า วัดกับข้อมูลที่มีหลายภาพและหลาย technology ต่อ project

### 2. สูง — แก้ polling ของ My Bot ให้ไม่ซ้อนและหยุดเมื่อออกจากหน้า

หลักฐาน: `frontend/src/features/bots/views/MyBotsView.vue:204` และ `:414`; `frontend/src/features/bots/composables/useBotSettingsData.ts:99`

- หน้า My Bot ใช้ `setInterval(..., 3000)` โดยไม่มี pending guard, การเช็ก `document.hidden`, AbortSignal หรือการกัน response เก่า
- ถ้า request ใช้เวลามากกว่า 3 วินาที จะมีงานซ้อน; เมื่อ response สลับลำดับอาจแสดงสถานะเก่า
- `onMounted` รอโหลดข้อมูลและ sync profile ก่อนสร้าง interval หากผู้ใช้ออกจากหน้าระหว่างรอ interval อาจถูกสร้างหลัง `onBeforeUnmount` ทำงานแล้ว
- หน้า settings ใช้ polling แบบ sequential, เช็ก hidden และกัน stale response อยู่แล้ว แต่ฝั่งผู้ใช้ยังโหลดบอตทั้งหมดแล้ว `.find()` บอตตัวเดียว เพราะ API ปัจจุบันไม่มี GET รายตัว

แนวทาง: ใช้การนัดรอบถัดไปหลัง request จบ พร้อม cancel/dispose/generation guard; หยุดเมื่อซ่อนแท็บและ refresh เมื่อกลับมา; คงจังหวะ 3 วินาทีเมื่อผู้ใช้กำลังดูสถานะ เพิ่ม API สำหรับบอตรายตัวโดยตรวจ owner ฝั่ง backend แล้วใช้ใน settings

ตรวจรับ: ชะลอ response เกิน 3 วินาทีแล้วมี request ค้างสูงสุด 1 ชุดต่อ flow, ออกจากหน้าขณะโหลดแล้วไม่มี poll ตามมา, สถานะหลัง start/stop/restart ไม่ถูก response เก่าทับ และไม่ดึง inventory ทุกหน้าสำหรับบอตตัวเดียว

### 3. สูง — เปลี่ยนลิงก์ภายในที่โหลดทั้งหน้าใหม่

หลักฐาน: `frontend/src/shared/ui/buttons/AppButton.vue:58`; `frontend/src/features/home/views/HomeView.vue:123`; `frontend/src/shared/layout/footer/AppFooter.vue:71`

`AppButton href="/work"` สร้าง `<a>` ปกติ Browser จึงโหลด document และเริ่ม Vue/Auth/i18n ใหม่เมื่อคลิก ทั้งที่มี Vue Router อยู่แล้ว Footer brand ใช้รูปแบบเดียวกัน

แนวทาง: เพิ่มการรองรับ `to` สำหรับ internal navigation ด้วย RouterLink โดยรักษา markup ของ anchor/classes/slot เดิม รวมถึง disabled state, เปิดแท็บใหม่ และ modifier-click; ปรับเฉพาะลิงก์ภายในที่มี route จริง

ตรวจรับ: การคลิกปกติไม่มี document request เพิ่ม, URL/ย้อนกลับ/scroll ถูกต้อง และหน้าตาปุ่มเหมือนเดิม

### 4. สูงเมื่อข้อมูลโต — ใช้ cursor pagination ให้ตรงกับสิ่งที่แสดง

หลักฐาน: `frontend/src/shared/api/http.ts:9`; `frontend/src/features/work/api.ts:183`; `frontend/src/features/work/views/WorkListView.vue:139`; `frontend/src/features/admin/api/users.ts:41`

`fetchAllCursorPages()` อ่านครั้งละ 100 รายการวนจนครบก่อนคืนผล หน้า Work แสดงเพียง 6 รายการเริ่มต้นแต่รอข้อมูลทั้งหมด และยังโหลดทั้งชุดของอีกภาษาหลังโหลดแรกเสร็จ หน้า Admin Users ก็รอทุกหน้าแล้ว render ทุกแถว เช่น 10,000 users ต้องเรียกประมาณ 100 HTTP requests ต่อการโหลดหนึ่งครั้ง ก่อนแสดงผลทั้งหมด

แนวทาง: ให้ Work โหลดข้อมูลตามปุ่ม Load more ที่มีอยู่แล้ว เก็บ featured/filter/count ผ่าน contract ที่รองรับ UI เดิม โหลดภาษาถัดไปเมื่อใช้หรือเมื่อมีเหตุผลรองรับ และเก็บ request/cache ที่ยังใช้ได้เมื่อกลับเข้าหน้า ส่วน Admin ใช้การโหลดเพิ่มในพื้นที่เลื่อนเดิม หรือ virtualization หลังวัด DOM cost จริง

ต้องรักษาผลรวม จำนวนที่แสดง การค้นหา ลำดับ featured และการเลือกข้ามหน้า ไม่เปลี่ยนทุก caller ของ `fetchAllCursorPages()` เป็นหน้าแรกอย่างเดียว เพราะ inventory และตัวเลือกติดตั้งต้องเห็นรายการครบ

### 5. กลาง — เลิกอ่านประวัติกระเป๋าผ่าน v1 แล้วอ่าน v2 ซ้ำ

หลักฐาน: `frontend/src/features/admin/api/users.ts:151`; `backend/src/main/java/com/fujipp/backend/auth/AdminUserRepository.java:217`; `AdminUserService.java:76`

`fetchUserWalletHistory()` อ่าน v1 ซึ่งมี metadata และประวัติ 50 รายการ แล้วเรียก v2 วนทุกหน้ามาแทน `metadata.entries` ทันที ประวัติชุดแรกจึงถูก query/ส่งซ้ำ และกล่องประวัติยังต้องรอโหลดจนจบ

แนวทาง: ให้ contract เดียวคืน wallet metadata/balance และ cursor page แรก จากนั้นอ่านหน้าถัดไปตามที่ต้องแสดง ใช้ balance จากแหล่งข้อมูลที่เป็นปัจจุบัน และคงความหมายของข้อมูล/การเลื่อนเดิม

ตรวจรับ: เปิดประวัติครั้งแรกใช้ request เดียว ไม่มีการโหลดข้อมูลชุดเดียวกันผ่านทั้งสอง version และประวัติที่เหลือยังเข้าถึงได้

### 6. กลาง — ทำให้ Auth dialog และ editor โหลดเมื่อจำเป็นจริง

หลักฐาน: `frontend/src/shared/ui/dialogs/index.ts:1`; `frontend/src/shared/layout/navbar/AppNavbar.vue:314`; `frontend/src/features/donation/components/DonationSupportSection.vue:14`; `frontend/src/features/bots/views/FeatureSettingsView.vue:11`

Auth dialog มีทั้ง static และ dynamic import ทำให้ Vite แยก chunk ตามที่ตั้งใจไม่ได้ ต้องแก้ static callers เช่น Donate และ Design System ด้วย ไม่ใช่เปลี่ยนเฉพาะ import ใน Navbar

FeatureSettingsView นำเข้า config fields, Embed editor, Components V2 editor และ preview แบบ static แม้เปิดแค่ตั้งค่าทั่วไป Chunk ของหน้านี้อยู่ที่ 136.71 kB raw / 35.32 kB gzip ตาม build output

แนวทาง: ใช้ async component ที่ boundary ของ dialog และชนิด editor พร้อมเตรียมโหลดเมื่อผู้ใช้มีแนวโน้มจะเปิด เพื่อรักษาความรู้สึกตอบสนองของ UI ตรวจว่าหน้า config ไม่โหลด designer ก่อนใช้ และทดสอบการรักษาค่าที่ยังไม่ได้บันทึกเมื่อสลับส่วน แนวทางนี้สอดคล้องกับ [Vue: Code Splitting](https://vuejs.org/guide/best-practices/performance.html#code-splitting)

### 7. กลาง — แยกคำแปลตามภาษาและ feature

หลักฐาน: `frontend/src/i18n/messages.ts:1`; `frontend/src/i18n/locales/en/index.ts:1` และฝั่ง TH

คำแปล EN/TH ทุก namespace รวม Admin, Bot Settings และ Account ถูก import ตั้งแต่เปิดหน้าแรก ข้อมูลเมื่อ serialize เป็น JSON มี 107,358 bytes และ gzip รวม 27,743 bytes (27.1 KiB) ตัวเลขนี้เป็นขนาดข้อมูลอ้างอิง ไม่ใช่ขนาดที่จะประหยัดได้ทั้งหมดใน bundle

แนวทาง: โหลดส่วนกลางและภาษาที่กำลังใช้ก่อน แล้วเพิ่ม namespace ตาม route พร้อม preload ก่อน render โดยรักษา fallback EN, การสลับภาษา และไม่ให้เห็น translation key ชั่วคราว คงทั้งสองภาษาครบ

### 8. ต่ำสำหรับความลื่น แต่ช่วยลดไฟล์ deploy — เก็บไฟล์ที่ไม่ใช้

พบ `frontend/src/stores/counter.ts` เป็น template counter และไม่พบการ import ใช้งาน จึงเป็น candidate สำหรับลบ แต่ไฟล์ที่ไม่เข้า dependency graph ไม่ได้ทำให้หน้าเว็บช้าลงอยู่แล้ว

พบภาพ 18 ไฟล์ที่ชื่อไฟล์ไม่ปรากฏใน `frontend/src/` หรือ `frontend/index.html` รวม **23,187,735 bytes ≈ 22.1 MiB** ตัวอย่าง:

| ไฟล์ใน `frontend/public/images/` | ขนาดโดยประมาณ |
| --- | ---: |
| `home/hero-background-4k.png` | 10.92 MiB |
| `home/developer-portal-display.png` | 2.74 MiB |
| `about/anawat-grudtoop-profile-croppeddd.png` | 1.84 MiB |
| `about/anawat-grudtoop-profile-light-cropped.png` | 1.71 MiB |
| `about/anawat-grudtoop-profile-515.png` | 1.40 MiB |
| `about/anawat-grudtoop-profile-cropped.png` | 1.29 MiB |

ตรวจ dynamic URL, URL ในฐานข้อมูล, external links และการใช้งานเป็นต้นฉบับก่อนลบหรือย้ายออกจาก `public/` รายการนี้พิสูจน์ได้เพียงว่าไม่พบ filename reference ใน source ที่ตรวจ การย้ายออกช่วยลด artifact/FTPS deploy เป็นหลัก ไม่ได้ลด byte ของหน้า Home ที่ browser ไม่ได้ร้องขอภาพเหล่านี้

`simple-icons` ยังใช้จริงทั้ง About และการสร้าง icon catalog; Supabase ยังใช้ Auth; Kanit/Inter/Caveat/Bruno Ace/Roboto Mono เป็นส่วนหนึ่งของ UI จึงยังไม่มีเหตุผลให้ลบ dependency เหล่านี้เพียงเพราะขนาดติดตั้งใหญ่

### 9. ตรวจเพิ่มก่อนทำ migration — index และข้อมูลฐานข้อมูล

มี migration สำหรับ cursor indexes อยู่แล้วใน `supabase/migrations/20260822000001_optimize_backend_queries.sql` จึงควรแก้รูปแบบ query/จำนวน request ก่อนเพิ่ม index โดยไม่มี measurement

Candidate สำหรับตรวจความซ้ำซ้อน:

- `wallet_entries_wallet_created_idx (wallet_id, created_at DESC)` กับ `wallet_entries_wallet_created_id_idx (wallet_id, created_at DESC, id DESC)`
- `project_translations_project_id_idx (project_id)` กับ unique constraint `(project_id, locale)`

ตรวจ schema จริง, `pg_stat_user_indexes`, ขนาด index, dependency ของ constraint และ `EXPLAIN (ANALYZE, BUFFERS)` กับ workload ตัวแทนก่อนตัดสินใจ ตาม [PostgreSQL: Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html) การอ่านโค้ดอย่างเดียวไม่ยืนยันว่า index ใดลบได้หรือ migration ใด deploy แล้ว

ส่วน Donate เรียก aggregate ยอดรวมและ leaderboard ทุกครั้งที่อ่าน campaign (`DonationRepository.java:21`, `:52`) ให้เก็บ latency/query plan เมื่อข้อมูลโต ก่อนเลือก cache ระยะสั้นพร้อม invalidation หลังธุรกรรมสำเร็จ ยังไม่มีหลักฐานว่าเป็นคอขวดใน production

ยังไม่มีหลักฐานพอให้ลบ table/column, เวอร์ชัน feature เก่าหรือข้อมูลธุรกรรม ต้องรักษา financial ledger, migration history และ feature version ที่ license/runtime ยังอ้างอิง

### 10. กลาง — ทำให้การวัดครอบคลุมหน้าที่ผู้ใช้เข้า

`frontend/scripts/check-bundle-budget.ts` นับเฉพาะ entry และ static imports ไม่รวม route chunks, รูป, ฟอนต์ และ API; `.github/workflows/frontend-cd.yml` ยังไม่ได้เรียก `performance:bundle` ใน CI

แนวทาง: เพิ่ม bundle budget ใน CI และเกณฑ์ราย route เช่น Home, Work, My Bot และ Feature Settings; วัด LCP/INP/long tasks จากสถานการณ์ใช้งานจริงบนอุปกรณ์และ network profile เดียวกันก่อน/หลัง ใช้ request/query count เป็นเกณฑ์คู่กัน ไม่ใช้คะแนน bundle อย่างเดียว

## สิ่งที่ทำดีอยู่แล้วและควรรักษา

- Router แยกหน้าแบบ lazy; Supabase client แยกโหลดและ guest ไม่ต้องโหลด SDK
- Settings flow มี shared data, in-flight deduplication และการกัน stale response อยู่แล้ว
- ภาพ Hero ใช้ WebP/srcset/dimensions; progressive image ใช้ IntersectionObserver; หลาย animation รองรับ reduced motion
- Runtime bootstrap มี cache และ metrics อยู่แล้ว
- โฮสต์จริงส่ง Brotli และ cache JS/CSS/ภาพที่สุ่มตรวจ 30 วันพร้อม `immutable` จึงไม่ควรสรุปจาก `.htaccess` ว่าโฮสต์ยังไม่มี cache/compression
- HTML response ที่ตรวจไม่มี explicit `Cache-Control`; ภาพใน `/images/` ไม่มี content hash แต่ได้ `immutable` ด้วย ควรทำ HTML revalidation และเปลี่ยน URL เมื่อเปลี่ยนเนื้อหาภาพ เพื่อให้ cache ทำงานถูกต้อง ตาม [MDN: HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching)

## เกณฑ์คง UI เดิมเมื่อเริ่มแก้

1. เก็บ baseline และเทียบ Home, Work, My Bot, Settings, Admin Users ทั้ง Desktop/Mobile, Light/Dark, EN/TH
2. รักษา typography, spacing, colors, skeleton, button labels, keyboard focus และรูปแบบการค้นหา/เลื่อน/Load more
3. ทดสอบ request ช้า, สลับ route ระหว่างโหลด, ซ่อนแท็บ, กลับเข้าหน้า, สลับภาษา และ start/stop/restart
4. ก่อน commit frontend ให้รัน build, unit tests และ lint ตามกติกาโปรเจกต์; ตรวจ diff จาก lint และทำ visual QA เมื่อเกี่ยวกับ UI

ลำดับเริ่มงานที่แนะนำ: **query หน้า Work → polling My Bot → internal navigation → wallet history/pagination → lazy loading/i18n → asset cleanup และ measurement ใน CI**

## ผลหลังดำเนินการ

### ขนาดไฟล์

วัด production build ด้วย Chromium ที่ viewport, DPR, ภาษา และเวลารอแบบเดียวกับ baseline ขนาด JS/CSS ในตารางเป็น KiB gzip ของไฟล์ที่ browser โหลดจริง ยกเว้นแถว Initial shell ซึ่งนับ entry และ static imports จาก manifest

| ชุดไฟล์ | JS ก่อน | JS หลัง | CSS ก่อน | CSS หลัง |
| --- | ---: | ---: | ---: | ---: |
| Initial shell | 126.5 | 96.7 | 17.9 | 16.9 |
| Home EN | 129.8 | 101.4 | 20.2 | 19.1 |
| Home TH | 129.8 | 103.6 | 20.2 | 19.1 |
| About EN | 148.6 | 122.2 | 21.8 | 20.7 |
| About TH | 148.6 | 126.7 | 21.8 | 20.7 |

ผล Home/About ตรงกันทั้ง Desktop/Mobile ในการวัดนี้ Initial JS ลดประมาณ 24%; ยังคงใช้ฟอนต์และภาพ responsive เดิม และ guest ไม่โหลด Supabase SDK คำเตือน ineffective dynamic import ของ Auth หายไป

FeatureSettingsView ลดจาก 136.71 เป็น 54.33 kB raw (gzip 35.32 → 15.88 kB) โดย config fields และ presentation editor แยก chunk และเริ่มโหลดเฉพาะ editor ที่เลือกไปพร้อมกับ API จึงต้องรวม chunk ลูกเมื่อตีความต้นทุนทั้งหน้า ไม่ใช่อ้างว่า editor ทั้งหมดเหลือ 54.33 kB

ย้าย artwork 18 ไฟล์รวม 22.1 MiB จาก `frontend/public/images/` ไป `frontend/artwork/archive/` หลังตรวจ source และ published Work summaries/galleries ทั้งสองภาษา ต้นฉบับยังอยู่ใน repository แต่ไม่อยู่ใน `dist/` ลบ template counter และ public-list helper/DTO ที่ไม่มีผู้เรียกแล้ว โดยเก็บ dependency และ inventory helpers ที่ยังใช้งานจริง

### ข้อมูลและการทำงาน

- Work repository ใช้ 4 query สำหรับหน้าที่มีข้อมูล: project, positions, technologies และ cover แทน `1 + 3N` ทดสอบ 100 project แล้วได้ 4 query พร้อมตรวจลำดับและการจับคู่ relation (เป็นจำนวนการเรียก JDBC ใน test ไม่ใช่ latency benchmark ของ production)
- หน้า Work อ่าน overview สำหรับจำนวนทั้งหมด/หมวดหมู่/featured และอ่านหน้าแรกเพียง 4 รายการบน Mobile หรือ 6 บน Desktop จากนั้นโหลดตามปุ่มเดิม รักษา count/filter/featured/Show less และยกเลิก response เก่าตอนเปลี่ยนภาษา/หมวดหมู่ Cache แบบจำกัด 32 URL มีอายุ 60 วินาที ล้างเมื่อ retry หรือออกจาก editor
- Overview เป็นอีก request ซึ่งใช้สูงสุด 5 query รวม featured ดังนั้นการเปิดหน้า Work ครั้งแรกใช้สูงสุด 9 query เมื่อทุกชุดมีข้อมูล ข้อดีคือจำนวน query ไม่โตตามจำนวนรายการ; เว็บไซต์ที่มีเพียง 2 project อาจไม่ได้ลดจำนวน query รวมจากการเปิดครั้งแรก
- My Bot และ settings ใช้ polling แบบ sequential หลังรอบก่อนจบ 3 วินาที ยกเลิกเมื่อซ่อนแท็บ/ออกจากหน้า และกัน response เก่าทับผลคำสั่งควบคุม หน้า settings อ่านบอตรายตัวโดยตรวจ owner ฝั่ง Backend แทนการอ่าน inventory ทั้งหมด และจำกัดการ sync profile พร้อมกันไม่เกิน 3 ตัว
- Admin Users/ประวัติกระเป๋าโหลดครั้งละ 50 แถวในพื้นที่เลื่อนเดิม Search ใหม่ยกเลิก cursor เก่า ประวัติใช้ v2 ครั้งเดียวพร้อม wallet metadata/current balance ไม่อ่าน v1 ซ้ำ และการเปิดประวัติของบัญชีที่ยังไม่มีกระเป๋าไม่สร้าง financial records
- ปุ่ม Home → Work และ footer brand ใช้ RouterLink รักษา anchor, keyboard, modifier-click, target และ disabled behavior การคลิก Home → Work ปกติส่ง document request เพียงครั้งเดียวตลอด flow
- Auth dialog โหลดเมื่อเปิดครั้งแรกและยังคง transition เดิมใน Donate/Design System คำแปลโหลดเฉพาะภาษา/namespace ที่ต้องใช้ พร้อม EN fallback ก่อน render/สลับภาษา มีการกันการเลือกภาษาหลายครั้งขณะ chunk ยังโหลด
- CI ตรวจ initial bundle และ route budgets สำหรับ Home, Work, My Bot, config และ presentation editor รวม async component ที่จำเป็นและภาษา TH/EN; route ที่ต้อง login รวม Supabase SDK ด้วย

### การตรวจรับ

- `bun run build`, `bun run lint`, `bun run check:tokens`, `bun run performance:bundle` ผ่าน และตรวจ diff จาก lint แล้ว
- Unit tests ฝั่ง Frontend: **84 ผ่าน / 26 files**
- Browser smoke: ชุดเต็มเดิม 24 เคสผ่าน และทดสอบเพิ่มเติม/ซ้ำเฉพาะส่วนที่แก้จนผ่าน รวมครอบคลุม **28 เคสที่ไม่ซ้ำ** บน Desktop/Mobile ได้แก่ pagination/search, navigation, wallet history, language race, editor save, checkout, roles และ Light/Dark
- Backend `./mvnw -q test`: **125 ผ่าน, 4 integration tests ข้ามตามเงื่อนไข environment**, ไม่มี failure/error
- เทียบ screenshot **56 คู่**: Home, About, Work, My Bot, config, Embed editor และ Admin Users × Desktop/Mobile × Light/Dark × EN/TH ขนาดภาพตรงกันทั้งหมด, 42 คู่เหมือนทุก pixel, อีก 14 คู่ต่างสูงสุด 2/255 ต่อช่องสี ไม่มี pixel ต่างเกิน threshold 8/255 และไม่พบ page error/หน้าล้น ภาพใช้ fixture และบล็อกบริการภายนอก จึงไม่ใช้ยืนยันข้อมูลสดของ production
- ผลวัดแบบย่ออยู่ใน [frontend-performance-results.json](frontend-performance-results.json)

### การนำขึ้นใช้งานและข้อจำกัด

ต้อง deploy Backend ที่รองรับ `/api/v2/works/overview`, `/api/v2/bots/{botId}` และ wallet-history v2 metadata ก่อน Frontend ชุดนี้ เนื่องจาก pipeline ของสองส่วนแยกกัน งานนี้จัดเตรียมใน branch โดยยังไม่ได้ push/PR/merge/deploy

ยังไม่ได้วัด LCP/INP/FPS บนอุปกรณ์จริงหรือ `EXPLAIN (ANALYZE, BUFFERS)`/สถิติ index ใน production จึงไม่อ้างเปอร์เซ็นต์ความลื่นจากขนาด bundle และยังไม่ลบ table/column/index หรือเพิ่ม cache ของ Donate โดยไม่มี measurement รองรับ การปรับ hosting headers ในหัวข้อเดิมยังเป็นข้อเสนอ
