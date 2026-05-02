import { useState } from 'react'
import { Outlet } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { GlobalSearch } from '../search/GlobalSearch'
import { api } from '@/lib/api'

interface AppLayoutProps {
  collections?: string[]
  title?: string
}

export function AppLayout({ collections: propCollections, title = 'Dashboard' }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Fetch collections from API — dynamic, matches consumer's cms.config.ts
  const { data: schemaData } = useQuery({
    queryKey: ['cms-schema'],
    queryFn: () => api<{ collections: Array<{ name: string }> }>('/admin/schema'),
    staleTime: 5 * 60 * 1000,
  })

  const collections = schemaData?.collections?.map((c) => c.name) ?? propCollections ?? []

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        collections={collections}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={title} onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      <GlobalSearch />
    </div>
  )
}
