export const experienceMilestones = [
  { id: 'projects', start: '2023-08-07', end: '2024-12-05' },
  { id: 'internship', start: '2025-01-05', end: '2025-07-06' },
  { id: 'capstone', start: '2025-08-07', end: '2026-05-26' },
] as const

/** Elapsed days in completed periods, excluding gaps and the end date. */
export const totalExperienceDays = experienceMilestones.reduce((total, milestone) => {
  const start = Date.parse(`${milestone.start}T00:00:00Z`)
  const end = Date.parse(`${milestone.end}T00:00:00Z`)
  return total + (end - start) / 86_400_000
}, 0)
