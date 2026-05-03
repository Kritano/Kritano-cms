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
import { Installer } from '@/pages/Installer'
import { Dashboard } from '@/pages/Dashboard'
import { CollectionList } from '@/pages/collection/CollectionList'
import { DocumentEditor } from '@/pages/collection/DocumentEditor'
import { Media } from '@/pages/Media'
import { BlockLibrary } from '@/pages/BlockLibrary'
import { ExportImport } from '@/pages/ExportImport'
import { SiteSettings } from '@/pages/site/SiteSettings'
import { SiteHealth } from '@/pages/site/SiteHealth'
import { Deployment } from '@/pages/Deployment'
import { UserList } from '@/pages/team/UserList'
import { UserDetail } from '@/pages/team/UserDetail'
import { InviteUser } from '@/pages/team/InviteUser'
import { RoleList } from '@/pages/team/RoleList'
import { RoleEditor } from '@/pages/team/RoleEditor'
import { ActivityLog } from '@/pages/team/ActivityLog'
import { AccountSecurity } from '@/pages/team/AccountSecurity'
import { Calendar } from '@/pages/Calendar'
import { ApiKeys } from '@/pages/ApiKeys'
import { PluginManager } from '@/pages/PluginManager'
import { Redirects } from '@/pages/Redirects'
import { Webhooks } from '@/pages/Webhooks'
import { FormList } from '@/pages/forms/FormList'
import { FormBuilder } from '@/pages/forms/FormBuilder'
import { FormSubmissions } from '@/pages/forms/FormSubmissions'

// Collections are now fetched dynamically from the API by AppLayout and Dashboard

// Root route
const rootRoute = createRootRoute({
  component: Outlet,
})

// Installer route (no auth required — only shows before first setup)
const installerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/install',
  component: Installer,
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
  component: () => <AppLayout title="Dashboard" />,
})

// Dashboard
const dashboardRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/admin',
  component: () => <Dashboard />,
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

// Export / Import (IO plugin)
const ioRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/admin/io',
  component: ExportImport,
})

// Block library
const blockLibraryRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/admin/blocks',
  component: BlockLibrary,
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

// --- Team: Users & Roles ---

const usersRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/admin/users',
  component: UserList,
})

const inviteUserRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/admin/users/invite',
  component: InviteUser,
})

const userDetailRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/admin/users/$id',
  component: function UserDetailPage() {
    const { id } = userDetailRoute.useParams()
    return <UserDetail id={id} />
  },
})

const rolesRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/admin/roles',
  component: RoleList,
})

const newRoleRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/admin/roles/new',
  component: () => <RoleEditor />,
})

const editRoleRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/admin/roles/$id',
  component: function EditRolePage() {
    const { id } = editRoleRoute.useParams()
    return <RoleEditor id={id} />
  },
})

const activityRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/admin/activity',
  component: ActivityLog,
})

// --- Redirects ---

const redirectsRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/admin/redirects',
  component: Redirects,
})

const webhooksRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/admin/webhooks',
  component: Webhooks,
})

// --- Forms ---

const formsRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/admin/forms',
  component: FormList,
})

const newFormRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/admin/forms/new',
  component: () => <FormBuilder />,
})

const editFormRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/admin/forms/$id',
  component: function EditFormPage() {
    const { id } = editFormRoute.useParams()
    return <FormBuilder id={id} />
  },
})

const formSubmissionsRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/admin/forms/$id/submissions',
  component: function FormSubmissionsPage() {
    const { id } = formSubmissionsRoute.useParams()
    return <FormSubmissions formId={id} />
  },
})

const calendarRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/admin/calendar',
  component: Calendar,
})

const apiKeysRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/admin/api-keys',
  component: ApiKeys,
})

const pluginsRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/admin/plugins',
  component: PluginManager,
})

const accountSecurityRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/admin/account/security',
  component: AccountSecurity,
})

const routeTree = rootRoute.addChildren([
  installerRoute,
  loginRoute,
  authLayoutRoute.addChildren([
    dashboardRoute,
    mediaRoute,
    ioRoute,
    blockLibraryRoute,
    siteRoute,
    siteHealthRoute,
    deploymentRoute,
    // Team routes (must be before $collection catch-all)
    usersRoute,
    inviteUserRoute,
    userDetailRoute,
    rolesRoute,
    newRoleRoute,
    editRoleRoute,
    activityRoute,
    redirectsRoute,
    webhooksRoute,
    formsRoute,
    newFormRoute,
    editFormRoute,
    formSubmissionsRoute,
    calendarRoute,
    apiKeysRoute,
    pluginsRoute,
    accountSecurityRoute,
    // Collection routes (catch-all — must be last)
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
