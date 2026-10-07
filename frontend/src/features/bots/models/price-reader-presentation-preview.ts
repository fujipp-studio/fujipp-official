type Definition = Record<string, unknown>
const isRecord = (value: unknown): value is Definition =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/** Mirrors the Price Reader renderer without changing the saved presentation. */
export function priceReaderPresentationPreview(
  raw: Definition,
  samples: Record<string, string>,
): Definition {
  const mode = String(raw.mode ?? 'EMBED').toUpperCase()
  const nested = mode === 'EMBED' ? raw.embed : raw.components_v2
  const definition = { ...raw, ...(isRecord(nested) ? nested : {}) }
  const render = (value: unknown) =>
    String(value ?? '').replace(
      /\{\{([a-z0-9_]+)}}/gi,
      (match, key: string) => samples[key] ?? match,
    )
  const links = Array.isArray(definition.links)
    ? definition.links
        .filter(isRecord)
        .flatMap((item) => {
          const url = render(item.url)
          return /^https?:\/\//i.test(url)
            ? [
                {
                  url,
                  label: render(item.label ?? 'เปิดลิงก์').slice(0, 80),
                  emoji: render(item.emoji ?? '🔗'),
                },
              ]
            : []
        })
        .slice(0, 5)
    : []
  if (mode === 'EMBED')
    return { mode, embed: { ...definition, color: definition.color ?? 0x5865f2 }, links }
  if (Array.isArray(definition.components))
    return { mode, components: definition.components, links }
  const parts: Definition[] = [
    { type: 10, content: `# ${String(definition.title ?? '')}\n` },
    { type: 14, divider: true, spacing: 2 },
    { type: 10, content: String(definition.description ?? '') },
  ]
  const media = definition.image_url ?? definition.image
  const image = render(isRecord(media) ? media.url : media)
  if (/^https?:\/\//i.test(image)) parts.push({ type: 12, items: [{ media: { url: image } }] })
  if (links.length)
    parts.push({ type: 1, components: links.map((link) => ({ type: 2, style: 5, ...link })) })
  return { mode, components: [{ type: 17, components: parts }] }
}
