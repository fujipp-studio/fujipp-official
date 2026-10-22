import { describe, expect, it } from 'vitest'
import { totalExperienceDays } from '../features/about/config/experience-timeline'

describe('completed project and internship periods', () => {
  it('sums completed periods without gaps or time since the last project', () => {
    // 486 days of Integrated Project + 182 of internship + 292 of capstone.
    expect(totalExperienceDays).toBe(960)
  })
})
