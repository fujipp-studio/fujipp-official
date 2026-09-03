import { createRouter, createWebHistory, type RouterHistory } from 'vue-router'

import { useAuthStore } from '../stores'
import { applySeoMetadata, type SeoMetadata } from '../services/seo'

const pageSeo = {
  home: {
    title: 'Fujipp',
    description:
      "Anawat Boripakhirun's software development portfolio, featuring practical applications, automation, and Discord bot services.",
  },
  about: {
    title: 'About',
    description:
      'Learn about Anawat Boripakhirun, the developer behind Fujipp, his experience, skills, and approach to building software.',
  },
  account: {
    title: 'Account settings',
    description: 'Manage your Fujipp profile, password, and account access.',
    noIndex: true,
  },
  work: {
    title: 'Work',
    description:
      'Explore selected software projects, case studies, technical decisions, and outcomes by Fujipp.',
  },
  store: {
    title: 'Store',
    description: 'Browse Fujipp packages and managed runtime services for Discord bots.',
  },
} satisfies Record<string, SeoMetadata>

export function createAppRouter(
  history: RouterHistory = createWebHistory(import.meta.env.BASE_URL),
) {
  const router = createRouter({
    history,
    scrollBehavior(to, from, savedPosition) {
      if (savedPosition) return savedPosition
      if (to.path === from.path) return false

      if (to.hash) return { el: to.hash }

      return { top: 0, left: 0 }
    },
    routes: [
      {
        path: '/',
        name: 'home',
        component: () => import('../features/home/views/HomeView.vue'),
        meta: { seo: pageSeo.home },
      },
      {
        path: '/components',
        name: 'components',
        component: () => import('../views/DesignSystemView.vue'),
        meta: {
          hideGlobalNavbar: true,
          seo: {
            title: 'Component Catalog',
            description: 'Fujipp shared interface component catalog for UI and UX review.',
            noIndex: true,
          },
        },
      },
      {
        path: '/design-system',
        name: 'design-system',
        component: () => import('../views/DesignSystemView.vue'),
        meta: {
          hideGlobalNavbar: true,
          seo: {
            title: 'Design System',
            description: 'Fujipp interface design system.',
            noIndex: true,
          },
        },
      },
      {
        path: '/components/topup',
        alias: '/design-system/topup',
        name: 'topup-design',
        component: () => import('../features/topup/views/WalletTopupDesignView.vue'),
        meta: {
          seo: {
            title: 'Top-up Design Sandbox',
            description: 'Non-functional wallet top-up interface preview.',
            noIndex: true,
          },
        },
      },
      {
        path: '/about',
        name: 'about',
        component: () => import('../features/about/views/AboutView.vue'),
        meta: { seo: pageSeo.about },
      },
      {
        path: '/account',
        name: 'account',
        component: () => import('../features/account/views/AccountView.vue'),
        meta: { requiresAuth: true, seo: pageSeo.account },
      },
      {
        path: '/donate',
        name: 'donate',
        redirect: { path: '/about', hash: '#about-support' },
      },
      {
        path: '/store',
        name: 'store',
        component: () => import('../features/store/views/StoreView.vue'),
        meta: { requiresAuth: true, seo: pageSeo.store },
      },
      {
        path: '/store/packages',
        name: 'store-packages',
        component: () => import('../features/store/views/StoreView.vue'),
        meta: { requiresAuth: true, seo: { ...pageSeo.store, title: 'Bot Packages' } },
      },
      {
        path: '/store/runtime',
        name: 'store-runtime',
        component: () => import('../features/store/views/StoreView.vue'),
        meta: { requiresAuth: true, seo: { ...pageSeo.store, title: 'Managed Runtime' } },
      },
      {
        path: '/add-credit',
        name: 'add-credit',
        component: () => import('../features/topup/views/WalletTopupView.vue'),
        meta: { requiresAuth: true, seo: { ...pageSeo.store, title: 'Top up' } },
      },
      {
        path: '/my-bot',
        name: 'my-bot',
        component: () => import('../features/bots/views/MyBotsView.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: '/my-bot/:botId/settings',
        component: () => import('../features/bots/views/BotSettingsFlowView.vue'),
        meta: { requiresAuth: true },
        children: [
          {
            path: '',
            name: 'bot-settings',
            component: () => import('../features/bots/views/BotSettingsView.vue'),
          },
          {
            path: 'config',
            name: 'bot-config-settings',
            component: () => import('../features/bots/views/BotSettingsView.vue'),
          },
          {
            path: 'runtime',
            name: 'bot-runtime-settings',
            component: () => import('../features/bots/views/BotSettingsView.vue'),
          },
          {
            path: 'packages',
            name: 'bot-package-settings',
            component: () => import('../features/bots/views/BotSettingsView.vue'),
          },
          {
            path: 'packages/:licenseId',
            name: 'bot-feature-settings',
            component: () => import('../features/bots/views/FeatureSettingsView.vue'),
          },
          {
            path: 'packages/:licenseId/embed',
            name: 'bot-feature-embed-settings',
            component: () => import('../features/bots/views/FeatureSettingsView.vue'),
          },
          {
            path: 'packages/:licenseId/components-v2',
            name: 'bot-feature-components-v2-settings',
            component: () => import('../features/bots/views/FeatureSettingsView.vue'),
          },
        ],
      },
      {
        path: '/my-bot/features/:licenseId',
        name: 'feature-settings',
        component: () => import('../features/bots/views/FeatureSettingsView.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: '/my-bot/features/:licenseId/embed',
        name: 'feature-embed-settings',
        component: () => import('../features/bots/views/FeatureSettingsView.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: '/my-bot/features/:licenseId/components-v2',
        name: 'feature-components-v2-settings',
        component: () => import('../features/bots/views/FeatureSettingsView.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: '/work',
        name: 'work',
        component: () => import('../features/work/views/WorkListView.vue'),
        meta: { seo: pageSeo.work },
      },
      {
        path: '/work/add',
        name: 'work-add',
        component: () => import('../features/work/views/WorkEditorView.vue'),
        meta: { requiresAuth: true, roles: ['EDITOR', 'ADMIN'] },
      },
      {
        path: '/work/:id/edit',
        name: 'work-edit',
        component: () => import('../features/work/views/WorkEditorView.vue'),
        meta: { requiresAuth: true, roles: ['EDITOR', 'ADMIN'] },
      },
      {
        path: '/work/:slug',
        name: 'work-detail',
        component: () => import('../features/work/views/WorkDetailView.vue'),
        meta: { seo: { ...pageSeo.work, title: 'Project' } },
      },
      {
        path: '/admin',
        component: () => import('../features/admin/views/AdminView.vue'),
        meta: { requiresAuth: true, roles: ['ADMIN'] },
        children: [
          {
            path: '',
            name: 'admin-dashboard',
            component: () => import('../features/admin/views/AdminDashboardView.vue'),
            meta: { adminSection: 'main' },
          },
          {
            path: 'users',
            name: 'admin-users',
            component: () => import('../features/admin/views/AdminUsersView.vue'),
            meta: { adminSection: 'users' },
          },
          {
            path: 'runtime',
            name: 'admin-runtime',
            component: () => import('../features/admin/views/AdminRuntimeView.vue'),
            meta: { adminSection: 'runtime' },
          },
          {
            path: 'packages',
            name: 'admin-packages',
            component: () => import('../features/admin/views/AdminFeatureView.vue'),
            meta: { adminSection: 'packages' },
          },
          { path: 'feature', redirect: { name: 'admin-packages' } },
          {
            path: 'bots',
            name: 'admin-bots',
            component: () => import('../features/admin/views/AdminBotsView.vue'),
            meta: { adminSection: 'bots' },
          },
          {
            path: 'donations',
            name: 'admin-donations',
            component: () => import('../features/admin/views/AdminDonationsView.vue'),
            meta: { adminSection: 'donations' },
          },
        ],
      },
      {
        path: '/admin/bots/:botId/settings',
        component: () => import('../features/bots/views/BotSettingsFlowView.vue'),
        meta: { requiresAuth: true, roles: ['ADMIN'] },
        children: [
          {
            path: '',
            name: 'admin-bot-settings',
            component: () => import('../features/bots/views/BotSettingsView.vue'),
          },
          {
            path: 'config',
            name: 'admin-bot-config-settings',
            component: () => import('../features/bots/views/BotSettingsView.vue'),
          },
          {
            path: 'runtime',
            name: 'admin-bot-runtime-settings',
            component: () => import('../features/bots/views/BotSettingsView.vue'),
          },
          {
            path: 'packages',
            name: 'admin-bot-package-settings',
            component: () => import('../features/bots/views/BotSettingsView.vue'),
          },
          {
            path: 'packages/:licenseId',
            name: 'admin-bot-feature-settings',
            component: () => import('../features/bots/views/FeatureSettingsView.vue'),
          },
          {
            path: 'packages/:licenseId/embed',
            name: 'admin-bot-feature-embed-settings',
            component: () => import('../features/bots/views/FeatureSettingsView.vue'),
          },
          {
            path: 'packages/:licenseId/components-v2',
            name: 'admin-bot-feature-components-v2-settings',
            component: () => import('../features/bots/views/FeatureSettingsView.vue'),
          },
        ],
      },
      {
        path: '/auth/callback',
        name: 'auth-callback',
        component: () => import('../views/AuthCallbackView.vue'),
        meta: {
          hideGlobalNavbar: true,
          seo: {
            title: 'Authentication',
            description: 'Completing authentication with Fujipp.',
            noIndex: true,
          },
        },
      },
      {
        path: '/:pathMatch(.*)*',
        name: 'not-found',
        component: () => import('../views/NotFoundView.vue'),
        meta: {
          seo: {
            title: 'Page not found',
            description: 'The requested page could not be found.',
            noIndex: true,
          },
        },
      },
    ],
  })

  router.afterEach((to) => {
    const metadata = to.meta.seo ?? {
      title: 'Account',
      description: 'Private Fujipp account area.',
      noIndex: true,
    }
    applySeoMetadata({ ...metadata, path: to.path })
  })

  router.beforeEach(async (to) => {
    const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)
    const roles = to.matched.flatMap((record) => record.meta.roles ?? [])
    const isPerformanceStoreRoute =
      import.meta.env.VITE_PERFORMANCE_AUDIT === 'true' && to.path.startsWith('/store')
    if (isPerformanceStoreRoute) return true
    if (!requiresAuth && roles.length === 0) return true

    const auth = useAuthStore()
    if (!auth.initialized) await auth.initialize()
    if (!auth.session) return { name: 'home', query: localeQuery(to.query.locale) }
    if (roles.length > 0 && (!auth.currentUser || !roles.includes(auth.currentUser.role))) {
      return { name: 'home', query: localeQuery(to.query.locale) }
    }
    return true
  })

  function localeQuery(locale: unknown) {
    return locale === 'th' ? { locale: 'th' } : {}
  }

  return router
}

export default createAppRouter()

declare module 'vue-router' {
  interface RouteMeta {
    adminSection?: 'main' | 'users' | 'packages' | 'runtime' | 'bots' | 'donations'
    hideGlobalNavbar?: boolean
    requiresAuth?: boolean
    roles?: Array<'USER' | 'TESTER' | 'EDITOR' | 'ADMIN'>
    seo?: SeoMetadata
  }
}
