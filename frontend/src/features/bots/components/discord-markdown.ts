function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/** Keep code and escaped delimiters opaque while formatting Discord text. */
export function renderDiscordMarkdown(value: string, spoilerLabel: string) {
  const tokens = new Map<string, string>()
  let prefix = '\u0000discord'
  while (value.includes(prefix)) prefix += 'x'
  const save = (html: string) => {
    const key = `${prefix}${tokens.size}\u0000`
    tokens.set(key, html)
    return key
  }
  const inline = (source: string) =>
    escapeHtml(source)
      .replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_\n]+)__/g, '<u>$1</u>')
      .replace(/~~([^~\n]+)~~/g, '<s>$1</s>')
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
      .replace(/(^|\W)_([^_\n]+)_(?!\w)/g, '$1<em>$2</em>')
      .replace(/\n/g, '<br>')

  const protectedText = value
    .replace(/\r\n?/g, '\n')
    .replace(
      /\\([\\`*_|~>#-])|```([\s\S]*?)```|(`{1,2})([^\n]*?)\3/g,
      (_, escaped: string, fenced: string | undefined, _ticks: string, code: string) => {
        if (escaped !== undefined) return save(escapeHtml(escaped))
        if (fenced !== undefined) {
          // A language identifier belongs to the fence, not the displayed code.
          const content = fenced.replace(/^(?:[\w+-]+)?\n/, '').replace(/\n$/, '')
          return save(`<pre class="discord-code-block"><code>${escapeHtml(content)}</code></pre>`)
        }
        return save(`<code>${escapeHtml(code)}</code>`)
      },
    )
    .replace(/\|\|([\s\S]+?)\|\|/g, (_, content: string) =>
      save(
        `<button type="button" class="discord-text-spoiler" aria-expanded="false" aria-label="${escapeHtml(spoilerLabel)}"><span aria-hidden="true">${inline(content)}</span></button>`,
      ),
    )

  const html = protectedText
    .trimEnd()
    .split('\n')
    .map((line) => {
      // A standalone code block must not acquire a paragraph wrapper.
      if (tokens.get(line)?.startsWith('<pre ')) return line
      const subtext = line.match(/^-#\s+(.+)$/)
      if (subtext) return `<div class="discord-subtext">${inline(subtext[1] ?? '')}</div>`
      const heading = line.match(/^(#{1,3})\s+(.+)$/)
      if (heading) {
        const level = heading[1]?.length ?? 1
        return `<h${level}>${inline(heading[2] ?? '')}</h${level}>`
      }
      const quote = line.match(/^>\s?(.*)$/)
      if (quote) return `<blockquote>${inline(quote[1] ?? '')}</blockquote>`
      const listItem = line.match(/^[-*]\s+(.+)$/)
      if (listItem) return `<div class="discord-list-item">${inline(listItem[1] ?? '')}</div>`
      if (!line.trim()) return '<div class="discord-line-break"></div>'
      return `<div>${inline(line)}</div>`
    })
    .join('')

  // Spoilers may contain earlier code/escape tokens. Restore outer tokens first.
  return Array.from(tokens.entries())
    .reverse()
    .reduce((result, [key, replacement]) => result.split(key).join(replacement), html)
}
