export interface HomeFeature {
  titleKey: string
  descriptionKey: string
}

export interface TrustedCommunity {
  name: string
  image: string
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
    image: '/images/home/communities/kanom-topup.png',
  },
  {
    name: 'IDAXD Shop',
    image: '/images/home/communities/idaxd-shop.png',
  },
  {
    name: 'AKS Booster',
    image: '/images/home/communities/aks-booster.png',
  },
] satisfies readonly TrustedCommunity[]
