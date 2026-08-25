export interface SeoMetadata {
  title: string
  description: string
  path?: string
  noIndex?: boolean
}

const siteName = 'Fujipp'

function siteOrigin() {
  const configuredOrigin = import.meta.env.VITE_SITE_URL?.trim().replace(/\/+$/, '')
  return configuredOrigin || window.location.origin
}

function setMeta(selector: string, attributes: Record<string, string>, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    Object.entries(attributes).forEach(([name, value]) => element?.setAttribute(name, value))
    document.head.append(element)
  }
  element.content = content
}

export function applySeoMetadata(metadata: SeoMetadata) {
  const title = metadata.title.includes(siteName) ? metadata.title : `${metadata.title} | ${siteName}`
  const canonicalUrl = new URL(metadata.path ?? window.location.pathname, `${siteOrigin()}/`).href

  document.title = title
  setMeta('meta[name="description"]', { name: 'description' }, metadata.description)
  setMeta('meta[name="robots"]', { name: 'robots' }, metadata.noIndex ? 'noindex, nofollow' : 'index, follow')
  setMeta('meta[property="og:title"]', { property: 'og:title' }, title)
  setMeta('meta[property="og:description"]', { property: 'og:description' }, metadata.description)
  setMeta('meta[property="og:url"]', { property: 'og:url' }, canonicalUrl)
  setMeta('meta[name="twitter:title"]', { name: 'twitter:title' }, title)
  setMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, metadata.description)

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.append(canonical)
  }
  canonical.href = canonicalUrl
}
