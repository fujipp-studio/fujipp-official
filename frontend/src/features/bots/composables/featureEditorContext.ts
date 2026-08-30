import { inject, type InjectionKey } from 'vue'
import type { useFeatureSettings } from './useFeatureSettings'
export const featureEditorKey: InjectionKey<ReturnType<typeof useFeatureSettings>> =
  Symbol('feature-editor')
export function useFeatureEditor() {
  const editor = inject(featureEditorKey)
  if (!editor) throw new Error('Feature editor must be rendered inside FeatureSettingsView.')
  return editor
}
