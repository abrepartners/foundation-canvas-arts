# Set up the studio PIN

## Where things stand

The PIN is never stored in readable form — only a one-way scrambled version — so no one, including me, can look up an existing PIN.

More importantly, the live backend has no PIN set up at all right now: the tables and checks the sign-in screen relies on (settings, attempt log, and the check routine) were written but never applied to the live database. As things stand, entering any PIN on the login screen would fail.

## What I'll do

1. Apply the missing pieces to the live backend: the settings record that holds the scrambled PIN, the attempt log used for lockout, and the PIN-checking routine.
2. Store a PIN of your choosing (scrambled, never in plain text, never in the app's code).
3. Keep the existing safety limits: 5 failed tries per visitor per 15 minutes, and a global cap of 100 failures per hour.
4. Re-check the sign-in screen end to end so a correct PIN unlocks the studio and a wrong one is rejected.

## What I need from you

The six-digit PIN you want. If you don't name one, I'll set `080100` and tell you afterwards so you can change it.

## Technical notes

- Apply the `app_auth_settings`, `pin_login_attempts`, and `authenticate_app_pin` parts of the baseline migration to project `pswlaczoevrclemhjjpw`.
- Hash with `extensions.crypt(pin, gen_salt('bf'))`; RLS on, no anon/authenticated grants, execute granted to `service_role` only.
- Confirm the `pin-login` edge function returns a session for a valid PIN and 401 for an invalid one.
