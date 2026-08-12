import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '../stores'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.path === from.path) return false

    return { top: 0, left: 0 }
  },
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../features/home/views/HomeView.vue'),
    },
    {
      path: '/design-system',
      name: 'design-system',
      component: () => import('../views/DesignSystemView.vue'),
      meta: { hideGlobalNavbar: true },
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../features/about/views/AboutView.vue'),
    },
    {
      path: '/store',
      name: 'store',
      component: () => import('../features/store/views/StoreView.vue'),
    },
    {
      path: '/store/packages',
      name: 'store-packages',
      component: () => import('../features/store/views/StoreView.vue'),
    },
    {
      path: '/store/runtime',
      name: 'store-runtime',
      component: () => import('../features/store/views/StoreView.vue'),
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
    },
    {
      path: '/admin',
      name: 'admin-dashboard',
      component: () => import('../features/admin/views/AdminView.vue'),
      meta: { requiresAuth: true, roles: ['ADMIN'] },
    },
    {
      path: '/admin/users',
      name: 'admin-users',
      component: () => import('../features/admin/views/AdminView.vue'),
      meta: { requiresAuth: true, roles: ['ADMIN'] },
    },
    {
      path: '/admin/runtime',
      name: 'admin-runtime',
      component: () => import('../features/admin/views/AdminView.vue'),
      meta: { requiresAuth: true, roles: ['ADMIN'] },
    },
    {
      path: '/admin/packages',
      name: 'admin-packages',
      component: () => import('../features/admin/views/AdminView.vue'),
      meta: { requiresAuth: true, roles: ['ADMIN'] },
    },
    {
      path: '/admin/feature',
      redirect: '/admin/packages',
    },
    {
      path: '/admin/bots',
      name: 'admin-bots',
      component: () => import('../features/admin/views/AdminView.vue'),
      meta: { requiresAuth: true, roles: ['ADMIN'] },
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
      meta: { hideGlobalNavbar: true },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/NotFoundView.vue'),
    },
  ],
})

router.beforeEach(async (to) => {
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)
  const roles = to.matched.flatMap((record) => record.meta.roles ?? [])
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

export default router

declare module 'vue-router' {
  interface RouteMeta {
    hideGlobalNavbar?: boolean
    requiresAuth?: boolean
    roles?: Array<'USER' | 'TESTER' | 'EDITOR' | 'ADMIN'>
  }
}
