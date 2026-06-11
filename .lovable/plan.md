## Goal

Redeploy `generate-botanical-content` and `regenerate-visual` exactly as they currently exist in the repo (commit "Generate plates as JPEG"). No code changes.

## Notes

- Lovable ↔ GitHub sync is bidirectional and automatic, so the repo and the project workspace are already in sync — there is nothing to "pull". The files currently in the project ARE the latest from GitHub.
- This is a deploy-only action.

## Steps

1. Call `supabase--deploy_edge_functions` with `["generate-botanical-content", "regenerate-visual"]`.
2. Confirm both deployments succeeded and report back.

No file edits, no migrations, no UI changes.
