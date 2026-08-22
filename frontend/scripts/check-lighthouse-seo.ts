import { join } from 'node:path'

const reportDirectories = ['mobile', 'desktop'].map((name) => join('.lighthouseci', name))
let checkedReports = 0

for (const directory of reportDirectories) {
  const manifest = await Bun.file(join(directory, 'manifest.json')).json()
  for (const entry of manifest) {
    const report = await Bun.file(entry.jsonPath).json()
    const path = new URL(report.finalUrl).pathname
    const seoScore = report.categories?.seo?.score
    const robots = report.audits?.['robots-txt']?.score
    const crawlable = report.audits?.['is-crawlable']?.score

    if (robots !== 1) throw new Error(`${report.finalUrl}: invalid robots.txt`)
    if (path === '/not-a-real-page') {
      if (crawlable !== 0) throw new Error(`${report.finalUrl}: 404 must be noindex`)
    } else if (seoScore !== 1) {
      throw new Error(`${report.finalUrl}: expected SEO score 1, received ${seoScore}`)
    }
    checkedReports += 1
  }
}

if (checkedReports === 0) throw new Error('No Lighthouse reports found')
console.log(`SEO gate passed for ${checkedReports} Lighthouse reports`)
