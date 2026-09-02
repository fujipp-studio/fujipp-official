export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export type PresentationMode = 'EMBED' | 'COMPONENTS_V2' | null
