export default {
  profile: {
    name: 'Anawat Boripakhirun',
    portraitAlt: 'Portrait of Anawat Boripakhirun',
    age: '{years} Years {days} Days',
    location: 'Thai · Bangkok',
    introduction:
      'I turn complex requirements into practical, maintainable software through thoughtful system design and clear collaboration.',
    education: 'Education',
    university: "King Mongkut's University of Technology Thonburi",
    contactLinks: 'Contact links',
    mail: 'Mail',
  },
  skills: {
    title: 'Tools I work with',
    description:
      'Technologies I use across projects, from interfaces to infrastructure.',
    language: 'Language',
    frontend: 'Frontend',
    backend: 'Backend',
    database: 'Database',
    tools: 'Development Tools',
    infra: 'Infrastructure',
  },
  experience: {
    totalLabel: 'Project + internship periods · 960 days total (365 days/year, 30 days/month)',
    clockAccessible:
      '{years} years {months} months {days} days {hours} hours {minutes} minutes {seconds} seconds since my first project',
    clockUnits: {
      years: 'Years',
      months: 'Months',
      days: 'Days',
      hours: 'Hours',
      minutes: 'Minutes',
      seconds: 'Seconds',
    },
    since: 'Since my first project · {date}',
    internshipStack: 'Automation · PDF · Apache NiFi · Spring Boot · Oracle',
    elapsed: '{years} years {months} months',
    elapsedLabel: 'Since my first project, and still building',
    journeyTitle: 'From my first project\nto what’s next.',
    intake: '2022 intake · Recent graduate',
    timeline: {
      projects: {
        period: 'Year 2, Semester 2 – Year 3, Semester 1',
        title: 'Integrated Project',
        description:
          'Built a web application for managing homework (to-do list) as my first project.',
      },
      internship: {
        period: 'Internship',
        title: 'Full Stack Developer Intern',
        description:
          'Developed automated document workflows and generated A3 PDFs for water bills and receipts.',
      },
      capstone: {
        period: 'Year 4 · Semesters 1–2',
        title: 'University capstone project',
        description:
          'Developed a mobile dating app as my university capstone project.',
      },
      present: {
        period: 'Present',
        title: 'Ready for the next step',
        description:
          'Continuing to develop projects and exploring opportunities to begin my software development career after graduation.',
      },
    },
    title: 'Learning through\nreal systems.',
    role: 'Full Stack Developer Intern',
    duration: '6 months',
    company: 'Yip In Tsoi & Co., Ltd.',
    automationTitle: 'Automation workflow',
    automationDescription: 'Automated email-based document intake, protection, and delivery.',
    documentTitle: 'Document generation',
    documentDescription: 'Generated A3 PDFs for water bills and receipts.',
    productionTitle: 'Production stack',
    productionDescription:
      'Built collaborating services with Apache NiFi, Spring Boot, and Oracle.',
    handoffTitle: 'Handoff',
    handoffDescription:
      'Documented operations so the organization could maintain and continue the work.',
  },
  contact: {
    title: 'Let’s talk.',
    copyEmail: 'Copy email address',
    copied: 'Email copied. Talk soon!',
    copyError: 'Couldn’t copy. You can select the email address above.',
    description:
      "I'm open to software development opportunities where I can contribute, learn, and take ownership of work from idea to delivery.",
    rolesLabel: 'Roles of interest',
    frontend: 'Frontend',
    backend: 'Backend',
    fullStack: 'Full Stack',
    automation: 'Automation',
    emailLabel: 'The best way to reach me',
    action: 'Email me',
  },
  sections: {
    navigationLabel: 'About sections',
    profile: 'About me',
    skills: 'Skills',
    experience: 'Experience',
    contact: 'Contact',
    support: 'Support',
    goTo: 'Go to {section}',
  },
} as const
