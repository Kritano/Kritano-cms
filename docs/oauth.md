# OAuth login

Kritano CMS supports Google and GitHub OAuth as additional login methods alongside email/password. OAuth buttons only appear when the corresponding environment variables are configured.

## Configuration

### Google OAuth

1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create an OAuth 2.0 Client ID (Web application)
3. Add `https://yourdomain.com/api/auth/oauth/google/callback` as an authorised redirect URI
4. Set the environment variables:

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

### GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set the callback URL to `https://yourdomain.com/api/auth/oauth/github/callback`
4. Set the environment variables:

```
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
```

## How it works

1. User clicks "Continue with Google" or "Continue with GitHub" on the login page
2. Browser redirects to the provider's OAuth consent screen
3. After approval, the provider redirects back to the CMS callback URL
4. The CMS exchanges the code for an access token, fetches the user's profile
5. Three possible outcomes:
   - **Existing OAuth link:** User is logged in
   - **Email matches existing user:** OAuth account is linked automatically, user is logged in
   - **New email:** A new user account is created, OAuth account is linked, user is logged in
6. Browser redirects to `/admin` with JWT tokens

## Login page

When providers are configured, the login page shows OAuth buttons above the email/password form:

```
[Continue with Google]
[Continue with GitHub]

        ── or ──

Email: [                    ]
Password: [                 ]
[Sign in]
```

If no providers are configured, only the email/password form appears.

## Managing connected accounts

Go to **Account → Security** in the admin sidebar. The "Connected Accounts" section shows:

- Which providers are connected and the email used
- Connect/disconnect buttons for each provider

**Unlinking rules:** You cannot disconnect your last login method. If you only have OAuth (no password), you must set a password before disconnecting. This prevents locking yourself out.

## API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/auth/oauth/providers` | No | List configured providers |
| GET | `/api/auth/oauth/:provider` | No | Start OAuth flow (redirects to provider) |
| GET | `/api/auth/oauth/:provider/callback` | No | Handle OAuth callback |
| POST | `/api/auth/oauth/link` | Yes | Get OAuth URL for account linking |
| DELETE | `/api/auth/oauth/:provider/unlink` | Yes | Unlink provider from account |
| GET | `/api/auth/oauth/accounts` | Yes | List linked OAuth accounts |

## Security

- OAuth state parameter prevents CSRF attacks
- Tokens are signed JWTs, same as email/password login
- OAuth accounts are linked by email — if a user already exists with the same email, the OAuth account is linked to that user rather than creating a duplicate
- For GitHub, if the email is not public, the CMS fetches it from the GitHub emails API
