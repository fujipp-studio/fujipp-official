export type TextFieldVariant = 'text' | 'dropdown' | 'secret'
export type TextFieldState = 'default' | 'focused' | 'error'

export interface TextFieldOption {
  label: string
  value: string
  disabled?: boolean
}
