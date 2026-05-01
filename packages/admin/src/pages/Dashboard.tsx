import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { UpdateBanner } from '@/components/UpdateBanner'

interface DashboardProps {
  collections: string[]
}

export function Dashboard({ collections }: DashboardProps) {
  return (
    <div className="space-y-6">
      <UpdateBanner />

      <div>
        <h2 className="text-lg font-semibold text-gray-900">Welcome back</h2>
        <p className="text-sm text-gray-500">Manage your content below.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {collections.map((name) => (
          <div
            key={name}
            className="rounded-lg border border-gray-200 bg-white p-5"
          >
            <h3 className="text-sm font-semibold text-gray-900">
              {name.charAt(0).toUpperCase() + name.slice(1)}s
            </h3>
            <div className="mt-4">
              <Link to="/admin/$collection/new" params={{ collection: name }}>
                <Button variant="secondary" size="sm">
                  <Plus size={16} className="mr-1.5" />
                  New {name}
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
