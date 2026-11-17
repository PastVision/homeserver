# Home Server — public configuration website

Static GitHub Pages frontend for the private Home Server Stremio addon.

- Live target: <https://pastvision.github.io/homeserver/>
- Deployed Pages host (account custom domain): <https://pastvision.in/homeserver/>
- Repository: <https://github.com/pastvision/homeserver>
- No backend, analytics, tracking, accounts or secret storage in this repository.

## What it does

1. Collects the owner's backend URL, administrative setup secret and media-server settings.
2. Sends the settings **directly from the browser** to the backend's protected
   `POST /api/provision` endpoint over HTTPS.
3. Receives an opaque installation manifest URL.
4. Generates a `stremio://` installation link and copyable manifest URL.
5. Supports reconfiguration (paste an installation ID) and revocation.

The administrative secret is never written to `localStorage`, `sessionStorage`,
cookies, the URL, GitHub or this repository. It is cleared from the form after a
successful provisioning request.

## Local preview

Because this is a static site with ES modules, serve the directory rather than
opening `file://`:

```powershell
cd D:\AI\StremioAddon\homeserver-web
python -m http.server 8080
# open http://127.0.0.1:8080/
```

If Python is unavailable, any static file server works. For local backend use,
add `http://127.0.0.1:8080` to the backend's `CORS_ALLOWED_ORIGINS`.

## GitHub Pages

The workflow in `.github/workflows/deploy.yml` deploys on every push to `main`
using the official Pages actions.

1. Create/push `pastvision/homeserver` (public).
2. In repository **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main`; wait for the `Deploy Home Server website` workflow.
4. Verify <https://pastvision.github.io/homeserver/> returns the site.

The site uses relative asset paths, so it works under the `/homeserver/` base
path. `404.html` is included.

## Backend CORS

The backend must allow the Pages origin without a wildcard for provisioning:

```text
CORS_ALLOWED_ORIGINS=https://pastvision.github.io,https://pastvision.in
```

The project Pages URL currently redirects to the account custom domain
`https://pastvision.in/homeserver/`, so both origins must be allowed by the
backend provisioning API.

Manifest and playback routes use a separate, Stremio-compatible CORS policy.
The website never proxies media and cannot make GitHub Pages serve the backend.

## Security notes

- This repository is public: never commit `.env`, admin secrets, signing secrets,
  private media URLs, tokens or installation backups.
- The website cannot protect a weak backend. Provisioning, media-host allowlists,
  relay signing and revocation are enforced server-side.
- If an installation link is exposed, revoke it from the backend (or this page's
  revocation control) and create a new installation.
