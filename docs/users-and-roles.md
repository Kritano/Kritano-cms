# Users and roles

Kritano CMS has a full role-based access control system. You can invite team members, assign roles, create custom roles with granular permissions, and enforce two-factor authentication.

## Built-in roles

| Role | Description | Key permissions |
|---|---|---|
| `super_admin` | Full access to everything | All permissions (wildcard) |
| `admin` | Full content access, can manage users | Content, media, users, settings |
| `editor` | Can edit and publish all content | Read, create, update, publish content + full media |
| `author` | Can create and edit own content, cannot publish | Read, create, update own + upload media |
| `contributor` | Can create drafts only | Read and create content + read media |
| `viewer` | Read-only access to admin | Read content and media only |

System roles cannot be deleted.

## Creating custom roles

Navigate to **Team → Roles → Create role** in the admin.

Custom roles use the same permission system as built-in roles. You can set permissions per category (content, media, users, settings, forms, redirects, webhooks) and per action (read, create, update, delete, publish).

### Permission structure

```json
{
  "content": {
    "read": true,
    "create": true,
    "update": true,
    "publish": false,
    "delete": false
  },
  "media": {
    "read": true,
    "upload": true,
    "delete": false
  },
  "users": false,
  "settings": false,
  "forms": true
}
```

### Per-collection overrides

Roles can grant or deny specific permissions for individual collections:

```json
{
  "content": { "read": true, "create": true },
  "collections": {
    "article": { "publish": true },
    "page": { "update": false }
  }
}
```

## Inviting users

1. Go to **Team → Users → Invite user**
2. Enter the email address and select a role
3. The system sends an invitation email with a 7-day expiry
4. The recipient clicks the link, sets their name and password, and is assigned the role automatically

In development (no SMTP configured), the invitation URL is logged to the server console.

### SMTP configuration

Add these to your `.env` to enable email sending:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-user
SMTP_PASS=your-password
SMTP_FROM=CMS <noreply@mysite.com>
```

## Two-factor authentication

Any user can enable TOTP-based 2FA from **Account → Security**.

### Setup flow

1. Click **Enable 2FA**
2. Scan the QR code with an authenticator app (Google Authenticator, Authy, 1Password, etc.)
3. Enter the 6-digit code to verify
4. 2FA is now active

### Login with 2FA

When 2FA is enabled, the login flow becomes:

1. Enter email and password
2. If correct, the API returns `{ requires2fa: true, tempToken: "..." }`
3. Enter the 6-digit TOTP code
4. If valid, receive the access and refresh tokens

### Disabling 2FA

Go to **Account → Security** and enter your password to disable 2FA.

## Activity log

Every significant action is recorded in the activity log, accessible at **Team → Activity Log**. Events include:

- `document.created`, `document.updated`, `document.published`, `document.deleted`
- `media.uploaded`, `media.deleted`
- `user.invited`, `user.created`, `user.role_changed`, `user.deleted`
- `user.2fa_enabled`, `user.2fa_disabled`
- `role.created`, `role.updated`, `role.deleted`

The log is paginated and filterable by user, action type, and date range.

## API endpoints

```
GET    /api/admin/roles              List all roles
POST   /api/admin/roles              Create custom role
GET    /api/admin/roles/:id          Get role with permissions
PUT    /api/admin/roles/:id          Update role
DELETE /api/admin/roles/:id          Delete custom role

GET    /api/admin/users              List users with roles
POST   /api/admin/users/:id/roles    Assign role to user
DELETE /api/admin/users/:id/roles/:roleId  Remove role
DELETE /api/admin/users/:id          Deactivate user

POST   /api/admin/invitations        Send invitation
GET    /api/admin/invitations        List pending invitations
DELETE /api/admin/invitations/:id    Revoke invitation
POST   /api/auth/accept-invitation   Accept invitation

POST   /api/auth/2fa/setup           Generate TOTP secret + QR code
POST   /api/auth/2fa/verify          Verify code and enable 2FA
POST   /api/auth/2fa/disable         Disable 2FA (requires password)
POST   /api/auth/change-password     Change password

GET    /api/admin/activity           Activity log (paginated, filterable)
```
