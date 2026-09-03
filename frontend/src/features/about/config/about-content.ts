import {
  siDocker,
  siFlutter,
  siGithubactions,
  siJavascript,
  siLinux,
  siMongodb,
  siMysql,
  siNginx,
  siNodedotjs,
  siOpenjdk,
  siPostgresql,
  siReact,
  siSpringboot,
  siTypescript,
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
  { id: 'about-experience', labelKey: 'about.sections.experience' },
  { id: 'about-skills', labelKey: 'about.sections.skills' },
  { id: 'about-contact', labelKey: 'about.sections.contact' },
  { id: 'about-support', labelKey: 'about.sections.support' },
] as const

export const skillGroups = [
  {
    titleKey: 'about.skills.language',
    category: 'language',
    skills: [
      { label: 'JavaScript', icon: siJavascript },
      { label: 'TypeScript', icon: siTypescript },
      { label: 'Java', icon: siOpenjdk },
    ],
  },
  {
    titleKey: 'about.skills.frontend',
    category: 'frontend',
    skills: [
      { label: 'Vue.js', icon: siVuedotjs },
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
    ],
  },
  {
    titleKey: 'about.skills.database',
    category: 'database',
    skills: [
      { label: 'MySQL', icon: siMysql },
      { label: 'PostgreSQL', icon: siPostgresql },
      { label: 'MongoDB', icon: siMongodb },
    ],
  },
  {
    titleKey: 'about.skills.infra',
    category: 'infra',
    skills: [
      { label: 'GitHub Actions', icon: siGithubactions },
      { label: 'Docker', icon: siDocker },
      { label: 'Nginx', icon: siNginx },
      { label: 'Linux Server', icon: siLinux },
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
