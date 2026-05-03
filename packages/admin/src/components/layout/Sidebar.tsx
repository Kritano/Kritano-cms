import { Link, useLocation } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useUpdateCount } from '@/components/UpdateBanner'
import {
  FileText,
  Image,
  Settings,
  Server,
  Activity,
  Users,
  Shield,
  ClipboardList,
  Lock,
  CalendarDays,
  FileInput,
  CornerDownRight,
  Webhook,
  Puzzle,
  KeyRound,
  Layers,
  ArrowLeftRight,
  X,
  type LucideIcon,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  badge?: number
}

// Collection icons — simple mapping, extendable later
const COLLECTION_ICONS: Record<string, LucideIcon> = {
  page: FileText,
  article: FileText,
  project: FileText,
}

interface SidebarProps {
  collections: string[]
  open: boolean
  onClose: () => void
}

export function Sidebar({ collections, open, onClose }: SidebarProps) {
  const location = useLocation()

  const collectionItems: NavItem[] = collections.map((name) => ({
    label: name.charAt(0).toUpperCase() + name.slice(1) + 's',
    href: `/admin/${name}`,
    icon: COLLECTION_ICONS[name] || FileText,
  }))

  const contentItems: NavItem[] = [
    { label: 'Forms', href: '/admin/forms', icon: FileInput },
    { label: 'Calendar', href: '/admin/calendar', icon: CalendarDays },
    { label: 'Block Library', href: '/admin/blocks', icon: Layers },
  ]

  const teamItems: NavItem[] = [
    { label: 'Users', href: '/admin/users', icon: Users },
    { label: 'Roles', href: '/admin/roles', icon: Shield },
    { label: 'Activity Log', href: '/admin/activity', icon: ClipboardList },
  ]

  // Fetch plugin-registered sections
  const { data: pluginRegistry } = useQuery({
    queryKey: ['plugin-registry'],
    queryFn: () => api<{ sections: Array<{ pluginName: string; label: string; icon: string; path: string }> }>('/admin/plugins/registry').catch(() => ({ sections: [] })),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const PLUGIN_ICONS: Record<string, LucideIcon> = {
    'arrow-left-right': ArrowLeftRight,
    'puzzle': Puzzle,
  }

  const pluginItems: NavItem[] = (pluginRegistry?.sections ?? []).map((s) => ({
    label: s.label,
    href: s.path,
    icon: PLUGIN_ICONS[s.icon] || Puzzle,
  }))

  const updateCount = useUpdateCount()

  const systemItems: NavItem[] = [
    { label: 'Media', href: '/admin/media', icon: Image },
    { label: 'Redirects', href: '/admin/redirects', icon: CornerDownRight },
    { label: 'Webhooks', href: '/admin/webhooks', icon: Webhook },
    { label: 'API Keys', href: '/admin/api-keys', icon: KeyRound },
    { label: 'Plugins', href: '/admin/plugins', icon: Puzzle },
    { label: 'Site', href: '/admin/site', icon: Settings },
    { label: 'Site Health', href: '/admin/site/health', icon: Activity },
    { label: 'Deployment', href: '/admin/deployment', icon: Server, badge: updateCount || undefined },
  ]

  const accountItems: NavItem[] = [
    { label: 'Security', href: '/admin/account/security', icon: Lock },
  ]

  function isActive(href: string): boolean {
    return location.pathname === href || location.pathname.startsWith(href + '/')
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#0d0d0d] transition-transform lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/admin" className="text-lg font-semibold text-white">
            CMS
          </Link>
          <button onClick={onClose} className="text-gray-400 hover:text-white lg:hidden">
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Collections
          </p>
          {collectionItems.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} onClick={onClose} />
          ))}
          {contentItems.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} onClick={onClose} />
          ))}

          <div className="my-4 border-t border-gray-800" />

          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Team
          </p>
          {teamItems.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} onClick={onClose} />
          ))}

          {pluginItems.length > 0 && (
            <>
              <div className="my-4 border-t border-gray-800" />
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Plugins
              </p>
              {pluginItems.map((item) => (
                <NavLink key={item.href} item={item} active={isActive(item.href)} onClick={onClose} />
              ))}
            </>
          )}

          <div className="my-4 border-t border-gray-800" />

          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            System
          </p>
          {systemItems.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} onClick={onClose} />
          ))}

          <div className="my-4 border-t border-gray-800" />

          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Account
          </p>
          {accountItems.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} onClick={onClose} />
          ))}
        </nav>
      </aside>
    </>
  )
}

function NavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const Icon = item.icon
  return (
    <Link
      to={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-gray-800 text-white'
          : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200',
      )}
    >
      <Icon size={18} />
      <span className="flex-1">{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-semibold text-white">
          {item.badge}
        </span>
      )}
    </Link>
  )
}
