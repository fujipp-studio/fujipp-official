export interface HomeFeature {
  title: string
  description: string
}

export interface TrustedCommunity {
  name: string
  image: string
}

export const homeFeatures = [
  {
    title: 'Custom Bot Features',
    description:
      'Upgrade your server with our pre-built or custom-made features. Choose exactly what your community needs.',
  },
  {
    title: 'Flexible Runtime Plans',
    description:
      'Keep your bot online 24/7. We offer flexible runtime subscriptions tailored to your needs available in 1, 2, or 3 month plans.',
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
