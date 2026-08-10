const svgCache = new Map<string, Promise<string>>()

export function loadLocalIcon(source: string) {
  const cached = svgCache.get(source)
  if (cached) return cached

  const request = fetch(source, { headers: { Accept: 'image/svg+xml' } })
    .then((response) => {
      if (!response.ok) throw new Error(`Unable to load icon: ${source}`)
      return response.text()
    })
    .then((svg) =>
      svg
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/\s(?:on\w+|href|xlink:href)=("[^"]*"|'[^']*')/gi, '')
        .replace(
          /<(?!\/?(?:svg|g|defs|mask|linearGradient|stop|path|circle|rect|line|polyline|polygon|ellipse)\b)[^>]+>/gi,
          '',
        )
        .replace(/(?:fill|stroke)="black"/gi, (attribute) =>
          attribute.replace(/black/i, 'currentColor'),
        )
        .replace('<svg', '<svg aria-hidden="true" focusable="false"'),
    )

  svgCache.set(source, request)
  return request
}
