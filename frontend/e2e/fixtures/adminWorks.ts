import type { AdminWork, AdminWorkCatalog } from '../../src/features/work/api'

export const adminWork: AdminWork = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'support-bot',
  categoryCode: 'bot',
  categoryName: 'Bot',
  status: 'ACTIVE',
  publicationStatus: 'PUBLISHED',
  startedOn: '2026-01-01',
  completedOn: null,
  featured: false,
  featuredOrder: null,
  publishedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  positions: ['developer'],
  technologies: [],
  translations: [
    { locale: 'en', name: 'Support Bot', shortDescription: 'A support bot', overview: '', feasibility: '', targetUsers: '' },
    { locale: 'th', name: 'บอทช่วยเหลือ', shortDescription: 'บอทสำหรับช่วยเหลือ', overview: '', feasibility: '', targetUsers: '' },
  ],
}

export const adminWorkCatalog: AdminWorkCatalog = {
  categories: [{ code: 'bot', name: 'Bot' }],
  positions: [{ code: 'developer', name: 'Developer' }],
  technologyGroups: [],
  technologies: [],
}
