import type { IconSource } from '../../../config'

export interface FooterLink {
  label: string
  href: string
}

export interface FooterSocialLink {
  label: string
  icon: IconSource
  href?: string
}
