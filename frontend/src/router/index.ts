import { createRouter, createWebHistory } from 'vue-router'

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
      path: '/work',
      name: 'work',
      component: () => import('../features/work/views/WorkListView.vue'),
    },
    {
      path: '/work/add',
      name: 'work-add',
      component: () => import('../features/work/views/WorkEditorView.vue'),
    },
    {
      path: '/work/:id/edit',
      name: 'work-edit',
      component: () => import('../features/work/views/WorkEditorView.vue'),
    },
    {
      path: '/work/:slug',
      name: 'work-detail',
      component: () => import('../features/work/views/WorkDetailView.vue'),
    },
    {
      path: '/auth/callback',
      name: 'auth-callback',
      component: () => import('../views/AuthCallbackView.vue'),
      meta: { hideGlobalNavbar: true },
    },
  ],
})

export default router
