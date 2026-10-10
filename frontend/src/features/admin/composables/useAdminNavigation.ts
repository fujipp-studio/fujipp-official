import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Bot, Cpu, HeartHandshake, LayoutDashboard, PackageOpen, Users } from 'lucide-vue-next'

export function useAdminNavigation() {
  const { t, locale } = useI18n()
  const destination = (path: string) => ({
    path,
    query: locale.value === 'th' ? { locale: 'th' } : {},
  })
  const modules = computed(() => [
    {
      id: 'users',
      title: t('admin.dashboard.usersMenu'),
      description: t('admin.page.usersDescription'),
      icon: Users,
      path: '/admin/users',
    },
    {
      id: 'packages',
      title: t('admin.dashboard.packagesMenu'),
      description: t('admin.page.featureDescription'),
      icon: PackageOpen,
      path: '/admin/packages',
    },
    {
      id: 'runtime',
      title: t('admin.dashboard.runtimeMenu'),
      description: t('admin.page.runtimeDescription'),
      icon: Cpu,
      path: '/admin/runtime',
    },
    {
      id: 'bots',
      title: t('admin.dashboard.botsMenu'),
      description: t('admin.page.botsDescription'),
      icon: Bot,
      path: '/admin/bots',
    },
    {
      id: 'donations',
      title: t('admin.dashboard.donationsMenu'),
      description: t('admin.donations.description'),
      icon: HeartHandshake,
      path: '/admin/donations',
    },
  ])
  const items = computed(() => [
    {
      id: 'main',
      title: t('admin.sections.overview'),
      description: t('admin.navigation.overviewDescription'),
      icon: LayoutDashboard,
      path: '/admin',
    },
    ...modules.value,
  ])

  return { modules, items, destination }
}
