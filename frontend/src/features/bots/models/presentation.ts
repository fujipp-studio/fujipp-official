export function clone(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

export type PresentationMode = 'EMBED' | 'COMPONENTS_V2' | null
