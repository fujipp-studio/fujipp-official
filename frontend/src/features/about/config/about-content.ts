import {
  siApachemaven,
  siApachenifi,
  siCss,
  siDart,
  siDocker,
  siFirebase,
  siFlutter,
  siGithubactions,
  siHtml5,
  siJavascript,
  siJsonwebtokens,
  siLinux,
  siLua,
  siMongodb,
  siMysql,
  siNginx,
  siNodedotjs,
  siOpenjdk,
  siPm2,
  siPostgresql,
  siReact,
  siSocketdotio,
  siSpringboot,
  siTypescript,
  siVite,
  siVuedotjs,
  type SimpleIcon,
} from 'simple-icons'

export interface SkillItem {
  label: string
  icon: SimpleIcon
}

export interface SkillGroup {
  title: string
  category: 'language' | 'frontend' | 'backend' | 'database' | 'infra'
  skills: readonly SkillItem[]
}

export const aboutSections = [
  { id: 'about-profile', label: 'About me' },
  { id: 'about-skills', label: 'Skills' },
  { id: 'about-experience', label: 'Experience' },
  { id: 'about-contact', label: 'Contact' },
] as const

export const skillGroups = [
  {
    title: 'Language',
    category: 'language',
    skills: [
      { label: 'HTML', icon: siHtml5 },
      { label: 'CSS', icon: siCss },
      { label: 'JavaScript', icon: siJavascript },
      { label: 'TypeScript', icon: siTypescript },
      { label: 'Java', icon: siOpenjdk },
      { label: 'Dart', icon: siDart },
      { label: 'Lua', icon: siLua },
    ],
  },
  {
    title: 'Frontend',
    category: 'frontend',
    skills: [
      { label: 'Vue.js', icon: siVuedotjs },
      { label: 'Vite.js', icon: siVite },
      { label: 'Flutter', icon: siFlutter },
      { label: 'React', icon: siReact },
    ],
  },
  {
    title: 'Backend',
    category: 'backend',
    skills: [
      { label: 'Node.js', icon: siNodedotjs },
      { label: 'Spring Boot', icon: siSpringboot },
      { label: 'JWT', icon: siJsonwebtokens },
      { label: 'Socket.IO', icon: siSocketdotio },
    ],
  },
  {
    title: 'Database',
    category: 'database',
    skills: [
      { label: 'MySQL', icon: siMysql },
      { label: 'PostgreSQL', icon: siPostgresql },
      { label: 'MongoDB', icon: siMongodb },
      { label: 'Firebase', icon: siFirebase },
    ],
  },
  {
    title: 'Infra',
    category: 'infra',
    skills: [
      { label: 'GitHub Actions', icon: siGithubactions },
      { label: 'Docker', icon: siDocker },
      { label: 'PM2', icon: siPm2 },
      { label: 'Nginx', icon: siNginx },
      { label: 'Linux Server', icon: siLinux },
      { label: 'NiFi', icon: siApachenifi },
      { label: 'Maven', icon: siApachemaven },
    ],
  },
] satisfies readonly SkillGroup[]

export const experienceHighlights = [
  {
    title: 'Automation workflow',
    description: 'Automated email-based document intake, protection, and delivery.',
  },
  {
    title: 'Document generation',
    description: 'Generated A3 PDFs for water bills and receipts.',
  },
  {
    title: 'Production stack',
    description: 'Built collaborating services with Apache NiFi, Spring Boot, and Oracle.',
  },
  {
    title: 'Handoff',
    description:
      'Documented operations so the organization could maintain and continue the work.',
  },
] as const
