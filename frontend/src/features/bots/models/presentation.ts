export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export type PresentationMode = 'EMBED' | 'COMPONENTS_V2' | null

/** Return the first invalid row in the active Discord message layout. */
export function invalidActionRowPath(definition: Record<string, unknown>): string | null {
  if (String(definition.mode ?? 'EMBED').toUpperCase() !== 'COMPONENTS_V2') return null
  const nested = definition.components_v2
  const source = isRecord(nested) ? nested : definition
  function visit(components: unknown, path: string): string | null {
    if (!Array.isArray(components)) return null
    for (const [index, component] of components.entries()) {
      if (!isRecord(component)) continue
      const childPath = `${path}[${index}].components`
      if (
        component.type === 1 &&
        (!Array.isArray(component.components) ||
          component.components.length < 1 ||
          component.components.length > 5)
      )
        return childPath
      const invalid = visit(component.components, childPath)
      if (invalid) return invalid
    }
    return null
  }
  return visit(source.components, 'components')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
