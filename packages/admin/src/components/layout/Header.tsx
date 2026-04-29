import { Menu, LogOut } from 'lucide-react'
import { logout } from '@/lib/auth'
import { useNavigate } from '@tanstack/react-router'

interface HeaderProps {
  title: string
  onMenuClick: () => void
}

export function Header({ title, onMenuClick }: HeaderProps) {
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate({ to: '/admin/login' })
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="text-gray-500 hover:text-gray-700 lg:hidden"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      </div>

      <button
        onClick={handleLogout}
        className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
      >
        <LogOut size={16} />
        Logout
      </button>
    </header>
  )
}
