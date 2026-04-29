import {
  createRouter,
  createRoute,
  createRootRoute,
  redirect,
  Outlet,
} from '@tanstack/react-router'
import { isAuthenticated } from '@/lib/auth'
import { AppLayout } from '@/components/layout/AppLayout'
import { Login } from '@/pages/Login'
import { Dashboard } from '@/pages/Dashboard'
import { CollectionList } from '@/pages/collection/CollectionList'
import { DocumentEditor } from '@/pages/collection/DocumentEditor'
import { Media } from '@/pages/Media'
import { SiteSettings } from '@/pages/site/SiteSettings'
import { SiteHealth } from '@/pages/site/SiteHealth'
import { Deployment } from '@/pages/Deployment'

// TODO: In future tasks, these will come from the CMS config API
// For now, hardcode the collections from the blueprint
const COLLECTIONS = ['page', 'article', 'project']

// Root route
const rootRoute = createRootRoute({
  component: Outlet,
})

// Login route (no auth required)
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/login',
  component: Login,
  beforeLoad: () => {
    if (isAuthenticated()) {
      throw redirect({ to: '/admin' })
    }
  },
})

// Auth guard layout — all authenticated routes nest under this
const authLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'auth',
  beforeLoad: () => {
    if (!isAuthenticated()) {
      throw redirect({ to: '/admin/login' })
    }
  },
  component: () => <AppLayout collections={COLLECTIONS} title="Dashboard" />,
})

// Dashboard
const dashboardRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/admin',
  component: () => <Dashboard collections={COLLECTIONS} />,
})

// Collection list
const collectionListRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/admin/$collection',
  component: function CollectionListPage() {
    const { collection } = collectionListRoute.useParams()
    return <CollectionList collection={collection} />
  },
})

// New document
const newDocumentRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/admin/$collection/new',
  component: function NewDocumentPage() {
    const { collection } = newDocumentRoute.useParams()
    return <DocumentEditor collection={collection} />
  },
})

// Edit document
const editDocumentRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/admin/$collection/$id',
  component: function EditDocumentPage() {
    const { collection, id } = editDocumentRoute.useParams()
    return <DocumentEditor collection={collection} id={id} />
  },
})

// Media
const mediaRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/admin/media',
  component: Media,
})

// Site settings
const siteRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/admin/site',
  component: SiteSettings,
})

// Site health
const siteHealthRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/admin/site/health',
  component: SiteHealth,
})

// Deployment
const deploymentRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/admin/deployment',
  component: Deployment,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  authLayoutRoute.addChildren([
    dashboardRoute,
    mediaRoute,
    siteRoute,
    siteHealthRoute,
    deploymentRoute,
    collectionListRoute,
    newDocumentRoute,
    editDocumentRoute,
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
