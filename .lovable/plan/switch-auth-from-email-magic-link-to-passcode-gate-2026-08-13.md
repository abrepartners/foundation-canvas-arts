# Switch Auth from Email Magic Link to Passcode Gate

## Goal
Replace the current Supabase Auth email login with a lightweight 4-digit passcode gate using the pin **0801**, so the owner can sign in quickly without email delivery.

## Why
The user prefers a simple pin over email magic links. The existing email flow depends on `app_members` and Supabase OTP delivery; a passcode is simpler and avoids inbox/spam delays.

## Plan

### 1. Frontend auth state
- Update `src/lib/auth.tsx`:
  - Replace Supabase session tracking with a passcode-authenticated flag stored in `sessionStorage` (e.g. `botanical:passcode_auth`).
  - `RequireAuth` checks for that flag; if missing, redirect to `/login`.
  - Provide a `signInWithPasscode(pin)` helper and `signOut()` that clears the flag.

### 2. Login page
- Update `src/pages/Login.tsx`:
  - Replace email input with a 4-digit passcode input.
  - Validate locally against the configured passcode **0801**.
  - On success, mark auth in `sessionStorage` and redirect to the originally requested route.
  - Show a clear error for wrong passcode.

### 3. Edge function auth
- Update `supabase/functions/_shared/auth.ts`:
  - Replace JWT + `app_members` validation with a check for the `x-app-passcode` header.
  - Continue to allow the service-role bearer for internal edge-to-edge calls.
  - Return 401 when the passcode header is missing or incorrect.

### 4. Edge function invocation
- Update `src/lib/invokeFn.ts`:
  - Read the passcode from a shared source (e.g. a constant exported from `src/lib/auth.ts` or a thin config).
  - Inject it as `x-app-passcode` into every edge function call via `supabase.functions.invoke` headers.

### 5. CORS
- Update `supabase/functions/_shared/cors.ts` if needed so `x-app-passcode` is exposed/allowed in CORS preflight responses.

### 6. Cleanup / safety
- Remove `app_members` lookup from edge function auth; leave the table in place (no destructive migration).
- Remove the `shouldCreateUser: false` OTP call from `Login.tsx`.
- Ensure the passcode is not logged or returned in API responses.

### 7. Verification
- Run `tsgo --noEmit`, `eslint`, and a production build.
- Manually verify:
  - Visiting `/` redirects to `/login` when unauthenticated.
  - Entering `0801` on `/login` grants access.
  - Entering a wrong passcode shows an error.
  - Protected edge functions reject requests without `x-app-passcode` and accept requests with it.

## Out of scope
- Deleting the `app_members` table or its migration file.
- Adding multiple passcodes or per-user pins.
- Changing any non-auth business logic (content generation, TikTok, animation, etc.).
