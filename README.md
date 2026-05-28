# Biofarm Frontend

React 19 + TypeScript + Vite frontend for the Oasis Biofarm e-commerce platform.

## Quick Start

```bash
npm install
npm run dev   # http://localhost:5174
```

Copy `.env.example` to `.env` and fill in the values before running.

## Environment Variables

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
VITE_COGNITO_USER_POOL_ID=
VITE_COGNITO_USER_POOL_CLIENT_ID=
VITE_COGNITO_DOMAIN=
VITE_COGNITO_REDIRECT_SIGN_IN=http://localhost:5174/auth/callback
VITE_COGNITO_REDIRECT_SIGN_OUT=http://localhost:5174/auth/callback
```

---

## AWS Cognito Setup

The app uses AWS Amplify with Cognito's Hosted UI (OAuth 2.0 Authorization Code + PKCE). Every time you create a new Cognito user pool, you need to configure the following.

### 1. Create a User Pool

In the AWS Console go to **Cognito → User Pools → Create user pool**.

Recommended settings:
- Sign-in option: **Email**
- Password policy: your preference
- MFA: optional
- Required attributes: **email**
- Email verification: **Send email with verification code** (so new users can confirm their account)

### 2. Configure the App Client

In your user pool go to **App Integration → App Clients → Create app client**.

| Setting | Value |
|---|---|
| App type | Public client |
| Client secret | **OFF** (Amplify browser SDK cannot use a secret) |
| Authentication flows | Leave defaults |

After creating, go to the client and **Edit Hosted UI**:

| Setting | Value |
|---|---|
| Allowed callback URLs | `http://localhost:5174/auth/callback` |
| Allowed sign-out URLs | `http://localhost:5174/auth/callback` |
| Identity providers | ✅ Cognito User Pool |
| OAuth 2.0 grant types | ✅ Authorization code grant |
| OpenID Connect scopes | ✅ `openid` ✅ `email` ✅ `profile` |

### 3. Set a Cognito Domain

Go to **App Integration → Domain → Create Cognito domain**.

Pick a prefix (e.g. `my-biofarm-app`). The resulting domain will look like:
```
my-biofarm-app.auth.us-east-2.amazoncognito.com
```

Copy this into `VITE_COGNITO_DOMAIN` in your `.env`.

### 4. Enable Self-Registration (Sign Up)

Go to **Sign-up experience → Self-registration → Edit** and toggle **Enable self-registration** ON.

Without this, only users you manually create in the console can sign in.

### 5. Create the Admin Group

Go to **Groups → Create group** and create a group named exactly:

```
Admin
```

Any user added to this group will have access to admin routes (`/admin/*`). The frontend checks `user.roles.includes("Admin")` — the name is case-sensitive.

To grant admin access to a user: **Users → select user → Add to group → Admin**.

### 6. Fill in .env

After completing the above, update your `.env`:

```env
VITE_COGNITO_USER_POOL_ID=us-east-2_xxxxxxxxx
VITE_COGNITO_USER_POOL_CLIENT_ID=<app client id>
VITE_COGNITO_DOMAIN=<your-prefix>.auth.us-east-2.amazoncognito.com
```

### Verify it works

Open this URL in a browser — if Cognito's login page loads, the domain and client are configured correctly:

```
https://<VITE_COGNITO_DOMAIN>/login?client_id=<VITE_COGNITO_USER_POOL_CLIENT_ID>&response_type=code&scope=openid+email+profile&redirect_uri=http://localhost:5174/auth/callback
```

---

## Common Gotchas

- **Callback URL mismatch** — the URL in Cognito must be character-for-character identical to `VITE_COGNITO_REDIRECT_SIGN_IN` (watch for trailing slashes, http vs https).
- **Client secret enabled** — if the app client has a secret, Amplify's PKCE flow will fail silently. Delete the client and recreate it with secret OFF.
- **User not confirmed** — after signing up, users must verify their email before they can sign in. Check "Attribute verification" is enabled on the user pool.
- **Admin access not working** — the Cognito group must be named `Admin` exactly (capital A). Check the user is in that group under Users → the user → Groups tab.
