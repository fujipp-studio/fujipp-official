export interface HomeFeature {
  titleKey: string
  descriptionKey: string
}

export interface TrustedCommunity {
  name: string
  image: string
  placeholderImage: string
}

export const homeFeatures = [
  {
    titleKey: 'home.services.customTitle',
    descriptionKey: 'home.services.customDescription',
  },
  {
    titleKey: 'home.services.runtimeTitle',
    descriptionKey: 'home.services.runtimeDescription',
  },
] satisfies readonly HomeFeature[]

export const trustedCommunities = [
  {
    name: 'Kanom Topup',
    image: '/images/home/communities/kanom-topup.webp',
    placeholderImage: '/images/home/communities/kanom-topup-lqip.webp',
  },
  {
    name: 'IDAXD Shop',
    image: '/images/home/communities/idaxd-shop.webp',
    placeholderImage: '/images/home/communities/idaxd-shop-lqip.webp',
  },
  {
    name: 'AKS Booster',
    image: '/images/home/communities/aks-booster.webp',
    placeholderImage: '/images/home/communities/aks-booster-lqip.webp',
  },
] satisfies readonly TrustedCommunity[]
