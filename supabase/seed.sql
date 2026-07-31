-- Local development portfolio data transcribed from https://fujipp.com/projects.
-- This file runs after migrations during `supabase db reset`.

INSERT INTO portfolio.technologies (
    group_id,
    slug,
    name,
    official_url
)
SELECT technology_group.id,
       technology.slug,
       technology.name,
       technology.official_url
  FROM (
      VALUES
          ('frontend', 'html', 'HTML', 'https://html.spec.whatwg.org'),
          ('frontend', 'css', 'CSS', 'https://www.w3.org/Style/CSS'),
          ('frontend', 'javascript', 'JavaScript', 'https://developer.mozilla.org/docs/Web/JavaScript'),
          ('frontend', 'typescript', 'TypeScript', 'https://www.typescriptlang.org'),
          ('frontend', 'vue-js', 'Vue.js', 'https://vuejs.org'),
          ('frontend', 'vite', 'Vite', 'https://vite.dev'),
          ('mobile', 'dart', 'Dart', 'https://dart.dev'),
          ('mobile', 'flutter', 'Flutter', 'https://flutter.dev'),
          ('backend', 'java', 'Java', 'https://www.java.com'),
          ('backend', 'spring-boot', 'Spring Boot', 'https://spring.io/projects/spring-boot'),
          ('backend', 'jwt', 'JWT', 'https://www.rfc-editor.org/rfc/rfc7519'),
          ('backend', 'socket-io', 'Socket.IO', 'https://socket.io'),
          ('database', 'mysql', 'MySQL', 'https://www.mysql.com'),
          ('database', 'oracle-database', 'Oracle Database', 'https://www.oracle.com/database'),
          ('database', 'postgresql', 'PostgreSQL', 'https://www.postgresql.org'),
          ('cloud', 'firebase', 'Firebase', 'https://firebase.google.com'),
          ('cloud', 'cloudinary', 'Cloudinary', 'https://cloudinary.com'),
          ('data-ai', 'gemini-api', 'Gemini API', 'https://ai.google.dev'),
          ('devops', 'apache-nifi', 'Apache NiFi', 'https://nifi.apache.org'),
          ('devops', 'docker', 'Docker', 'https://www.docker.com'),
          ('devops', 'github-actions', 'GitHub Actions', 'https://github.com/features/actions'),
          ('devops', 'linux', 'Linux', 'https://www.linux.org'),
          ('devops', 'maven', 'Maven', 'https://maven.apache.org'),
          ('devops', 'nginx', 'NGINX', 'https://nginx.org'),
          ('other', 'google-auth', 'Google Auth', 'https://developers.google.com/identity'),
          ('other', 'hsm', 'HSM', 'https://en.wikipedia.org/wiki/Hardware_security_module')
  ) AS technology(group_code, slug, name, official_url)
  JOIN portfolio.technology_groups AS technology_group
    ON technology_group.code = technology.group_code
ON CONFLICT (slug) DO UPDATE
SET group_id = EXCLUDED.group_id,
    name = EXCLUDED.name,
    official_url = EXCLUDED.official_url,
    is_active = true;

INSERT INTO portfolio.projects (
    id,
    slug,
    category_id,
    status,
    publication_status,
    started_on,
    completed_on
)
SELECT project.id,
       project.slug,
       category.id,
       project.status::portfolio.project_status,
       'DRAFT'::portfolio.publication_status,
       project.started_on,
       project.completed_on
  FROM (
      VALUES
          (
              '10000000-0000-0000-0000-000000000001'::uuid,
              'chat2date',
              'senior',
              'COMPLETED',
              DATE '2025-08-01',
              DATE '2026-05-31'
          ),
          (
              '10000000-0000-0000-0000-000000000002'::uuid,
              'etax-automation-service',
              'internship',
              'COMPLETED',
              DATE '2025-03-01',
              DATE '2025-07-31'
          ),
          (
              '10000000-0000-0000-0000-000000000003'::uuid,
              'studymind-ai',
              'client',
              'ACTIVE',
              DATE '2026-04-01',
              NULL::date
          ),
          (
              '10000000-0000-0000-0000-000000000004'::uuid,
              'personal-portfolio-website',
              'personal',
              'ACTIVE',
              DATE '2026-01-01',
              NULL::date
          )
  ) AS project(id, slug, category_code, status, started_on, completed_on)
  JOIN portfolio.project_categories AS category
    ON category.code = project.category_code;

INSERT INTO portfolio.project_translations (
    project_id,
    locale,
    name,
    short_description,
    overview,
    feasibility,
    target_users
)
VALUES
    (
        '10000000-0000-0000-0000-000000000001',
        'en',
        'Chat2Date',
        'Dating platform designed to move beyond matching and messaging.',
        'Chat2Date is a dating platform designed to move beyond matching and messaging. It helps users progress from online conversation to real-world dates through preference-based matching, real-time chat, relationship scoring, date-place recommendations, scheduling, and safety support during meetups.',
        'Feasibility was validated through mini projects focused on face verification and GPS-based filtering before integrating them into the main system.',
        'Thai singles living in Thailand, aged 18 or above, who want to chat, get to know someone, and potentially meet or go on dates safely.'
    ),
    (
        '10000000-0000-0000-0000-000000000001',
        'th',
        'Chat2Date',
        'แพลตฟอร์มหาคู่ที่พาผู้ใช้ไปไกลกว่าการจับคู่และส่งข้อความ',
        'Chat2Date คือแพลตฟอร์มหาคู่ที่ไม่ได้หยุดแค่การจับคู่และแชต แต่พาผู้ใช้ไปสู่การนัดพบจริงอย่างมีขั้นตอน ระบบใช้ข้อมูลช่วงอายุ เพศที่สนใจ ไลฟ์สไตล์ ความสนใจ สไตล์การท่องเที่ยว และระยะทาง GPS เพื่อค้นหาคู่ที่เหมาะสม พร้อมระบบแชต เกมทายใจ คะแนนความสัมพันธ์ การแนะนำสถานที่เดต และฟังก์ชันความปลอดภัยระหว่างการนัดพบ',
        'การศึกษาความเป็นไปได้ทำในรูปแบบ Mini Project โดยโฟกัส Face Verification และ GPS-based Filtering เพื่อทดสอบแนวทางและประเมินเทคโนโลยีก่อนพัฒนาเป็นระบบหลัก',
        'คนไทยที่อาศัยอยู่ในประเทศไทย สถานะโสด อายุ 18 ปีขึ้นไป และต้องการหาคู่เพื่อพูดคุย ทำความรู้จัก นัดพบ หรือออกเดตร่วมกัน'
    ),
    (
        '10000000-0000-0000-0000-000000000002',
        'en',
        'ETAX Automation Service',
        'Enterprise document processing and digital signature platform.',
        'ETAX Automation Service is an enterprise document processing platform developed during an internship at YIP IN TSOI. It automates the complete e-Tax workflow, from receiving invoice data through Oracle AQ, generating XML and PDF/A-3U documents, applying digital signatures using HSM with XAdES and PAdES standards, and delivering signed documents through Email and SMS.',
        'The platform automates e-Tax document processing from data ingestion to delivery, reducing manual work, improving accuracy, and supporting digital signature and e-Tax compliance requirements.',
        'Enterprise organizations, accounting and finance teams, tax compliance officers, system administrators, and companies issuing electronic tax invoices.'
    ),
    (
        '10000000-0000-0000-0000-000000000002',
        'th',
        'ETAX Automation Service',
        'ระบบประมวลผลเอกสารและลายมือชื่อดิจิทัลระดับองค์กร',
        'ETAX Automation Service เป็นระบบประมวลผลเอกสารระดับองค์กรที่พัฒนาระหว่างการฝึกงานที่บริษัท YIP IN TSOI ระบบทำงานอัตโนมัติตลอดกระบวนการ e-Tax ตั้งแต่รับข้อมูลใบแจ้งหนี้ผ่าน Oracle AQ สร้างเอกสาร XML และ PDF/A-3U ลงลายมือชื่อดิจิทัลด้วย HSM ตามมาตรฐาน XAdES และ PAdES ไปจนถึงจัดส่งเอกสารผ่าน Email และ SMS',
        'ระบบรองรับการทำงานอัตโนมัติและมาตรฐาน e-Tax ช่วยลดเวลา ลดข้อผิดพลาดจากการทำงานด้วยมือ และจัดส่งเอกสารให้ผู้รับได้อย่างปลอดภัย',
        'องค์กรภาคธุรกิจ ฝ่ายบัญชีและการเงิน เจ้าหน้าที่ภาษีอากร ผู้ดูแลระบบ และบริษัทที่ออกใบกำกับภาษีอิเล็กทรอนิกส์'
    ),
    (
        '10000000-0000-0000-0000-000000000003',
        'en',
        'StudyMind AI',
        'AI summaries and practice quizzes generated from PDF documents.',
        'StudyMind AI is an AI-powered learning platform that helps students and self-learners study efficiently from PDF documents. Users upload learning materials and the system analyzes the content to create concise summaries and interactive practice questions, with Timed Mode for exam simulation and Practice Mode for focused review.',
        'The project uses available AI summarization, PDF processing, and automated quiz-generation technologies in a single web application.',
        'Students, university learners, and self-learners preparing for exams, reviewing lessons, or assessing their understanding.'
    ),
    (
        '10000000-0000-0000-0000-000000000003',
        'th',
        'StudyMind AI',
        'สรุปเอกสาร PDF และสร้างแบบทดสอบฝึกฝนด้วย AI',
        'StudyMind AI เป็นแพลตฟอร์มการเรียนรู้ที่ช่วยให้นักเรียน นักศึกษา และผู้เรียนด้วยตนเองเรียนรู้จากเอกสาร PDF ได้อย่างมีประสิทธิภาพ ผู้ใช้สามารถอัปโหลดเอกสารให้ AI วิเคราะห์และสร้างบทสรุปที่กระชับ พร้อมคำถามฝึกฝนแบบอัตโนมัติ ทั้งโหมดจับเวลาสำหรับจำลองการสอบและโหมดฝึกฝนสำหรับทบทวนเนื้อหา',
        'โปรเจกต์ใช้เทคโนโลยี AI สำหรับสรุปเนื้อหา ประมวลผล PDF และสร้างคำถามอัตโนมัติภายในเว็บแอปพลิเคชันเดียว',
        'นักเรียน นักศึกษา และผู้เรียนด้วยตนเองที่ต้องการเตรียมสอบ ทบทวนบทเรียน และวัดความเข้าใจจากเอกสาร PDF'
    ),
    (
        '10000000-0000-0000-0000-000000000004',
        'en',
        'Personal Portfolio Website',
        'Full-stack portfolio with an admin panel and automated CI/CD.',
        'FUJIPP is a personal portfolio platform designed from scratch in Figma and built as a full-stack application. The frontend uses Vue.js and TypeScript, the backend runs on Spring Boot, and Supabase stores project data. The admin panel is protected with OAuth and deployments are automated through GitHub Actions.',
        'Vue.js, Spring Boot, and Supabase provide stable foundations with strong documentation. Affordable hosting and automated CI/CD keep operations maintainable, while the VPS and database can scale without a major architectural change.',
        'Recruiters and HR professionals evaluating experience, developers exploring the projects and stack, and the owner maintaining portfolio content through the admin panel.'
    ),
    (
        '10000000-0000-0000-0000-000000000004',
        'th',
        'Fujipp Website Platform',
        'Portfolio แบบ Full Stack พร้อม Admin Panel และ CI/CD อัตโนมัติ',
        'FUJIPP คือแพลตฟอร์ม Portfolio ส่วนตัวที่ออกแบบตั้งแต่ต้นใน Figma และพัฒนาแบบ Full Stack ฝั่ง Frontend ใช้ Vue.js และ TypeScript ส่วน Backend ใช้ Spring Boot และจัดเก็บข้อมูลโปรเจกต์ใน Supabase การเข้าถึง Admin Panel ป้องกันด้วย OAuth และทุกการ Deploy ทำงานอัตโนมัติผ่าน GitHub Actions',
        'Vue.js, Spring Boot และ Supabase เป็นเทคโนโลยีที่มีความเสถียรและเอกสารครบถ้วน การใช้ Hosting ที่มีต้นทุนเหมาะสมร่วมกับ CI/CD อัตโนมัติช่วยให้ดูแลระบบได้ง่าย และสามารถขยาย VPS กับฐานข้อมูลได้ในอนาคต',
        'Recruiter และฝ่าย HR ที่ต้องการประเมินประสบการณ์ นักพัฒนาที่สนใจโปรเจกต์และ Tech Stack รวมถึงเจ้าของที่ดูแลเนื้อหาผ่าน Admin Panel'
    );

INSERT INTO portfolio.project_positions (
    project_id,
    position_id,
    sort_order
)
SELECT selected_position.project_id,
       position.id,
       selected_position.sort_order
  FROM (
      VALUES
          ('10000000-0000-0000-0000-000000000001'::uuid, 'full-stack-engineer', 0),
          ('10000000-0000-0000-0000-000000000001'::uuid, 'ux-ui-designer', 1),
          ('10000000-0000-0000-0000-000000000001'::uuid, 'devops-engineer', 2),
          ('10000000-0000-0000-0000-000000000002'::uuid, 'backend-engineer', 0),
          ('10000000-0000-0000-0000-000000000002'::uuid, 'devops-engineer', 1),
          ('10000000-0000-0000-0000-000000000002'::uuid, 'database-administrator', 2),
          ('10000000-0000-0000-0000-000000000002'::uuid, 'software-architect', 3),
          ('10000000-0000-0000-0000-000000000002'::uuid, 'qa-automated-test-engineer', 4),
          ('10000000-0000-0000-0000-000000000003'::uuid, 'frontend-engineer', 0),
          ('10000000-0000-0000-0000-000000000004'::uuid, 'full-stack-engineer', 0),
          ('10000000-0000-0000-0000-000000000004'::uuid, 'ux-ui-designer', 1),
          ('10000000-0000-0000-0000-000000000004'::uuid, 'devops-engineer', 2)
  ) AS selected_position(project_id, code, sort_order)
  JOIN portfolio.positions AS position
    ON position.code = selected_position.code;

INSERT INTO portfolio.project_technologies (
    project_id,
    technology_id,
    sort_order
)
SELECT selected_technology.project_id,
       technology.id,
       selected_technology.sort_order
  FROM (
      VALUES
          ('10000000-0000-0000-0000-000000000001'::uuid, 'dart', 0),
          ('10000000-0000-0000-0000-000000000001'::uuid, 'java', 1),
          ('10000000-0000-0000-0000-000000000001'::uuid, 'flutter', 2),
          ('10000000-0000-0000-0000-000000000001'::uuid, 'spring-boot', 3),
          ('10000000-0000-0000-0000-000000000001'::uuid, 'jwt', 4),
          ('10000000-0000-0000-0000-000000000001'::uuid, 'socket-io', 5),
          ('10000000-0000-0000-0000-000000000001'::uuid, 'mysql', 6),
          ('10000000-0000-0000-0000-000000000001'::uuid, 'firebase', 7),
          ('10000000-0000-0000-0000-000000000001'::uuid, 'google-auth', 8),
          ('10000000-0000-0000-0000-000000000001'::uuid, 'gemini-api', 9),
          ('10000000-0000-0000-0000-000000000001'::uuid, 'cloudinary', 10),
          ('10000000-0000-0000-0000-000000000001'::uuid, 'github-actions', 11),
          ('10000000-0000-0000-0000-000000000001'::uuid, 'docker', 12),
          ('10000000-0000-0000-0000-000000000001'::uuid, 'nginx', 13),
          ('10000000-0000-0000-0000-000000000001'::uuid, 'linux', 14),
          ('10000000-0000-0000-0000-000000000002'::uuid, 'java', 0),
          ('10000000-0000-0000-0000-000000000002'::uuid, 'spring-boot', 1),
          ('10000000-0000-0000-0000-000000000002'::uuid, 'oracle-database', 2),
          ('10000000-0000-0000-0000-000000000002'::uuid, 'hsm', 3),
          ('10000000-0000-0000-0000-000000000002'::uuid, 'apache-nifi', 4),
          ('10000000-0000-0000-0000-000000000002'::uuid, 'docker', 5),
          ('10000000-0000-0000-0000-000000000002'::uuid, 'maven', 6),
          ('10000000-0000-0000-0000-000000000003'::uuid, 'html', 0),
          ('10000000-0000-0000-0000-000000000003'::uuid, 'css', 1),
          ('10000000-0000-0000-0000-000000000003'::uuid, 'javascript', 2),
          ('10000000-0000-0000-0000-000000000003'::uuid, 'vue-js', 3),
          ('10000000-0000-0000-0000-000000000004'::uuid, 'html', 0),
          ('10000000-0000-0000-0000-000000000004'::uuid, 'css', 1),
          ('10000000-0000-0000-0000-000000000004'::uuid, 'javascript', 2),
          ('10000000-0000-0000-0000-000000000004'::uuid, 'typescript', 3),
          ('10000000-0000-0000-0000-000000000004'::uuid, 'java', 4),
          ('10000000-0000-0000-0000-000000000004'::uuid, 'vue-js', 5),
          ('10000000-0000-0000-0000-000000000004'::uuid, 'vite', 6),
          ('10000000-0000-0000-0000-000000000004'::uuid, 'spring-boot', 7),
          ('10000000-0000-0000-0000-000000000004'::uuid, 'postgresql', 8),
          ('10000000-0000-0000-0000-000000000004'::uuid, 'google-auth', 9),
          ('10000000-0000-0000-0000-000000000004'::uuid, 'github-actions', 10),
          ('10000000-0000-0000-0000-000000000004'::uuid, 'docker', 11),
          ('10000000-0000-0000-0000-000000000004'::uuid, 'nginx', 12),
          ('10000000-0000-0000-0000-000000000004'::uuid, 'linux', 13),
          ('10000000-0000-0000-0000-000000000004'::uuid, 'maven', 14)
  ) AS selected_technology(project_id, slug, sort_order)
  JOIN portfolio.technologies AS technology
    ON technology.slug = selected_technology.slug;

INSERT INTO portfolio.project_links (
    project_id,
    link_type,
    label,
    url,
    sort_order
)
VALUES
    (
        '10000000-0000-0000-0000-000000000001',
        'FIGMA',
        'Figma',
        'https://www.figma.com/design/OMrlfkIHg45M5Etm52rYyu/Chat-2-Date-Version-4?node-id=4002-9157&t=1dqSZeMR4J1mUVGE-1',
        0
    ),
    (
        '10000000-0000-0000-0000-000000000001',
        'GITHUB',
        'GitHub',
        'https://github.com/Fujipp/Capstone-Project-Chat-To-Date',
        1
    ),
    (
        '10000000-0000-0000-0000-000000000001',
        'YOUTUBE',
        'YouTube',
        'https://www.youtube.com/watch?v=-ynxqWjgi0k&t=216s',
        2
    ),
    (
        '10000000-0000-0000-0000-000000000002',
        'CERTIFICATE',
        'Internship Certificate',
        'https://zozkagchtjmiidtsajcz.supabase.co/storage/v1/object/public/project-assets/etax-automation-service-1780467099385/certificate/f6e45b41-3d4b-47f1-89dd-8177a0fc8710.pdf',
        0
    ),
    (
        '10000000-0000-0000-0000-000000000003',
        'GITHUB',
        'GitHub',
        'https://github.com/Fujipp/int308-security-summary',
        0
    ),
    (
        '10000000-0000-0000-0000-000000000003',
        'WEBSITE',
        'Live Website',
        'https://int308-security-summary.vercel.app/',
        1
    ),
    (
        '10000000-0000-0000-0000-000000000004',
        'FIGMA',
        'Figma',
        'https://www.figma.com/design/NPe2UZEWcr0Sb3U36SgHft/fujipp-personal-platform?node-id=1-2&t=GWdPhhwaopmEY3wT-1',
        0
    ),
    (
        '10000000-0000-0000-0000-000000000004',
        'WEBSITE',
        'Live Website',
        'https://fujipp.com',
        1
    );

CREATE TEMPORARY TABLE seed_project_content (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,
    content_type portfolio.project_content_type NOT NULL,
    sort_order INTEGER NOT NULL,
    th_title TEXT NOT NULL,
    th_description TEXT NOT NULL,
    en_title TEXT NOT NULL,
    en_description TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO seed_project_content (
    id,
    project_id,
    content_type,
    sort_order,
    th_title,
    th_description,
    en_title,
    en_description
)
VALUES
    (
        '20000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        'FEATURE',
        0,
        'Face verification',
        'สแกนใบหน้าแบบเรียลไทม์พร้อม Liveness และเทียบกับบัตรประชาชนเพื่อลดโปรไฟล์ปลอม',
        'Face verification',
        'Real-time face verification with liveness checks and ID-card comparison to reduce fake profiles.'
    ),
    (
        '20000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000001',
        'FEATURE',
        1,
        'Preference-based matching',
        'ค้นหาคู่จากความสนใจ ไลฟ์สไตล์ สไตล์การท่องเที่ยว และระยะทาง GPS ที่ปรับได้',
        'Preference-based matching',
        'Matching based on interests, lifestyle, travel style, and adjustable GPS distance.'
    ),
    (
        '20000000-0000-0000-0000-000000000003',
        '10000000-0000-0000-0000-000000000001',
        'FEATURE',
        2,
        'Safe real-world dates',
        'แนะนำสถานที่ จัดการนัดหมาย นำทางแบบเรียลไทม์ พร้อม SOS และระบบรายงานเพื่อความปลอดภัย',
        'Safe real-world dates',
        'Date-place recommendations, scheduling, real-time navigation, SOS, and reporting support safer meetups.'
    ),
    (
        '20000000-0000-0000-0000-000000000004',
        '10000000-0000-0000-0000-000000000001',
        'CHALLENGE',
        0,
        'Real-time reliability',
        'ดูแลความเสถียรของ WebSocket และการสื่อสารแบบเรียลไทม์เมื่อมีผู้ใช้งานพร้อมกัน',
        'Real-time reliability',
        'Maintaining stable WebSocket communication under concurrent user activity.'
    ),
    (
        '20000000-0000-0000-0000-000000000005',
        '10000000-0000-0000-0000-000000000001',
        'CHALLENGE',
        1,
        'AI context and privacy',
        'ออกแบบการใช้ AI เพื่อช่วยการสนทนาโดยคำนึงถึงบริบท ความเป็นส่วนตัว และข้อมูลของผู้ใช้',
        'AI context and privacy',
        'Balancing AI-assisted conversation guidance with user context, privacy, and data protection.'
    ),
    (
        '20000000-0000-0000-0000-000000000006',
        '10000000-0000-0000-0000-000000000001',
        'LEARNING',
        0,
        'Full-stack real-time architecture',
        'ได้เรียนรู้สถาปัตยกรรม Full Stack, WebSocket, AI Service, Location-based Service และการทำงานร่วมกันเป็นทีม',
        'Full-stack real-time architecture',
        'Learned full-stack architecture, WebSocket communication, AI integration, location services, and team planning.'
    ),
    (
        '20000000-0000-0000-0000-000000000007',
        '10000000-0000-0000-0000-000000000002',
        'FEATURE',
        0,
        'Automated document pipeline',
        'ประมวลผลข้อมูลจาก Queue สร้าง XML และ PDF/A-3U แล้วจัดส่งผ่าน Email และ SMS แบบอัตโนมัติ',
        'Automated document pipeline',
        'Processes queue data, generates XML and PDF/A-3U documents, and delivers them through Email and SMS.'
    ),
    (
        '20000000-0000-0000-0000-000000000008',
        '10000000-0000-0000-0000-000000000002',
        'FEATURE',
        1,
        'Standards-based digital signatures',
        'ลงลายมือชื่อดิจิทัลบน XML และ PDF ด้วย HSM ตามมาตรฐาน XAdES และ PAdES',
        'Standards-based digital signatures',
        'Applies HSM-backed digital signatures to XML and PDF using XAdES and PAdES standards.'
    ),
    (
        '20000000-0000-0000-0000-000000000009',
        '10000000-0000-0000-0000-000000000002',
        'CHALLENGE',
        0,
        'Enterprise workflow integration',
        'ทำความเข้าใจและเชื่อมต่อหลายบริการในกระบวนการ e-Tax ตั้งแต่รับข้อมูลจนถึงส่งเอกสาร',
        'Enterprise workflow integration',
        'Understanding and integrating multiple services across the complete enterprise e-Tax workflow.'
    ),
    (
        '20000000-0000-0000-0000-000000000010',
        '10000000-0000-0000-0000-000000000002',
        'CHALLENGE',
        1,
        'HSM and Oracle AQ',
        'เรียนรู้ Oracle AQ, PKCS#11 และ HSM เพื่อประมวลผลข้อความและลงลายมือชื่ออย่างปลอดภัย',
        'HSM and Oracle AQ',
        'Working with Oracle AQ, PKCS#11, and HSM devices for reliable queue processing and secure signing.'
    ),
    (
        '20000000-0000-0000-0000-000000000011',
        '10000000-0000-0000-0000-000000000002',
        'LEARNING',
        0,
        'Enterprise backend development',
        'ได้เรียนรู้ Spring Boot, REST API, Digital Signature, Document Management และการแก้ปัญหาในระบบองค์กรจริง',
        'Enterprise backend development',
        'Gained practical experience with Spring Boot, REST APIs, digital signatures, document management, and production debugging.'
    ),
    (
        '20000000-0000-0000-0000-000000000012',
        '10000000-0000-0000-0000-000000000003',
        'FEATURE',
        0,
        'AI-powered summaries',
        'วิเคราะห์เอกสาร PDF และสร้างบทสรุปที่กระชับ ครอบคลุมประเด็นสำคัญ และเข้าใจง่าย',
        'AI-powered summaries',
        'Analyzes PDF documents and generates concise summaries of important concepts.'
    ),
    (
        '20000000-0000-0000-0000-000000000013',
        '10000000-0000-0000-0000-000000000003',
        'FEATURE',
        1,
        'Interactive quiz modes',
        'สร้างข้อสอบอัตโนมัติพร้อมโหมดจับเวลา โหมดฝึกฝน และการแสดงผลคะแนน',
        'Interactive quiz modes',
        'Generates quizzes with Timed Mode, Practice Mode, and score tracking.'
    ),
    (
        '20000000-0000-0000-0000-000000000014',
        '10000000-0000-0000-0000-000000000003',
        'CHALLENGE',
        0,
        'Summary accuracy',
        'ทำให้ AI สรุปเนื้อหาจากเอกสารที่ยาวหรือซับซ้อนได้ถูกต้องและครอบคลุมประเด็นสำคัญ',
        'Summary accuracy',
        'Keeping AI-generated summaries accurate across lengthy or complex PDF documents.'
    ),
    (
        '20000000-0000-0000-0000-000000000015',
        '10000000-0000-0000-0000-000000000003',
        'CHALLENGE',
        1,
        'Meaningful quiz generation',
        'สร้างคำถามที่สอดคล้องกับเอกสารและสามารถใช้วัดความเข้าใจของผู้เรียนได้จริง',
        'Meaningful quiz generation',
        'Generating questions that reflect the source material and meaningfully assess understanding.'
    ),
    (
        '20000000-0000-0000-0000-000000000016',
        '10000000-0000-0000-0000-000000000003',
        'LEARNING',
        0,
        'Document processing',
        'ได้เรียนรู้การจัดการ PDF ดึงเนื้อหา และเตรียมข้อมูลสำหรับการวิเคราะห์และประมวลผลด้วย AI',
        'Document processing',
        'Learned to process PDFs, extract content, and prepare document data for AI analysis.'
    ),
    (
        '20000000-0000-0000-0000-000000000017',
        '10000000-0000-0000-0000-000000000004',
        'FEATURE',
        0,
        'Full-stack project publishing',
        'จัดการและเผยแพร่ข้อมูลโปรเจกต์สองภาษาผ่าน Vue.js, Spring Boot และ PostgreSQL',
        'Full-stack project publishing',
        'Manages and publishes bilingual project content through Vue.js, Spring Boot, and PostgreSQL.'
    ),
    (
        '20000000-0000-0000-0000-000000000018',
        '10000000-0000-0000-0000-000000000004',
        'FEATURE',
        1,
        'Protected admin workflow',
        'ป้องกัน Admin Panel ด้วย OAuth เพื่อให้เจ้าของเพิ่ม แก้ไข และลบเนื้อหาได้อย่างปลอดภัย',
        'Protected admin workflow',
        'Uses OAuth to protect the admin workflow for adding, editing, and removing portfolio content.'
    ),
    (
        '20000000-0000-0000-0000-000000000019',
        '10000000-0000-0000-0000-000000000004',
        'FEATURE',
        2,
        'Automated deployment',
        'ใช้ GitHub Actions ทำ CI/CD และ Deploy อัตโนมัติเมื่อมีการ Push ขึ้น Production',
        'Automated deployment',
        'Uses GitHub Actions for CI/CD and automatic production deployment.'
    ),
    (
        '20000000-0000-0000-0000-000000000020',
        '10000000-0000-0000-0000-000000000004',
        'CHALLENGE',
        0,
        'Maintainable architecture',
        'ออกแบบ Frontend, Backend, Database และระบบ Deploy ให้แยกหน้าที่และดูแลต่อได้ในระยะยาว',
        'Maintainable architecture',
        'Separating frontend, backend, database, and deployment responsibilities for long-term maintenance.'
    ),
    (
        '20000000-0000-0000-0000-000000000021',
        '10000000-0000-0000-0000-000000000004',
        'LEARNING',
        0,
        'Operating a complete product',
        'ได้เรียนรู้การออกแบบ พัฒนา รักษาความปลอดภัย Deploy และดูแล Full Stack Product ที่ใช้งานจริง',
        'Operating a complete product',
        'Learned to design, build, secure, deploy, and operate a complete full-stack product.'
    );

INSERT INTO portfolio.project_content_items (
    id,
    project_id,
    content_type,
    sort_order
)
SELECT id,
       project_id,
       content_type,
       sort_order
  FROM seed_project_content;

INSERT INTO portfolio.project_content_translations (
    content_item_id,
    locale,
    title,
    description
)
SELECT id,
       'th',
       th_title,
       th_description
  FROM seed_project_content
UNION ALL
SELECT id,
       'en',
       en_title,
       en_description
  FROM seed_project_content;

UPDATE portfolio.projects
   SET publication_status = 'PUBLISHED',
       is_featured = CASE
           WHEN slug IN (
               'chat2date',
               'etax-automation-service',
               'personal-portfolio-website'
           ) THEN true
           ELSE false
       END,
       featured_order = CASE slug
           WHEN 'chat2date' THEN 0
           WHEN 'etax-automation-service' THEN 1
           WHEN 'personal-portfolio-website' THEN 2
           ELSE NULL
       END;
