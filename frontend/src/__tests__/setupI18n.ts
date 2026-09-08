// Direct component mounts bypass the application/router bootstrap. Populate both
// languages here; loader behavior is covered separately with a fresh module.
import { loadMessages, messageNamespaces } from '@/i18n'
await Promise.all([loadMessages('en', messageNamespaces), loadMessages('th', messageNamespaces)])
