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
  titleKey: string
  category: 'language' | 'frontend' | 'backend' | 'database' | 'infra'
  skills: readonly SkillItem[]
}

export const aboutSections = [
  { id: 'about-profile', labelKey: 'about.sections.profile' },
  { id: 'about-skills', labelKey: 'about.sections.skills' },
  { id: 'about-experience', labelKey: 'about.sections.experience' },
  { id: 'about-contact', labelKey: 'about.sections.contact' },
] as const

export const skillGroups = [
  {
    titleKey: 'about.skills.language',
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
    titleKey: 'about.skills.frontend',
    category: 'frontend',
    skills: [
      { label: 'Vue.js', icon: siVuedotjs },
      { label: 'Vite.js', icon: siVite },
      { label: 'Flutter', icon: siFlutter },
      { label: 'React', icon: siReact },
    ],
  },
  {
    titleKey: 'about.skills.backend',
    category: 'backend',
    skills: [
      { label: 'Node.js', icon: siNodedotjs },
      { label: 'Spring Boot', icon: siSpringboot },
      { label: 'JWT', icon: siJsonwebtokens },
      { label: 'Socket.IO', icon: siSocketdotio },
    ],
  },
  {
    titleKey: 'about.skills.database',
    category: 'database',
    skills: [
      { label: 'MySQL', icon: siMysql },
      { label: 'PostgreSQL', icon: siPostgresql },
      { label: 'MongoDB', icon: siMongodb },
      { label: 'Firebase', icon: siFirebase },
    ],
  },
  {
    titleKey: 'about.skills.infra',
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
    titleKey: 'about.experience.automationTitle',
    descriptionKey: 'about.experience.automationDescription',
  },
  {
    titleKey: 'about.experience.documentTitle',
    descriptionKey: 'about.experience.documentDescription',
  },
  {
    titleKey: 'about.experience.productionTitle',
    descriptionKey: 'about.experience.productionDescription',
  },
  {
    titleKey: 'about.experience.handoffTitle',
    descriptionKey: 'about.experience.handoffDescription',
  },
] as const
