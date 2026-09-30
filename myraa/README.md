# Myraa Integration Space

The portal embeds the Myraa UI from `Myraa-Voice-Assistant-main`. Its live API and
WebSocket server must run as a separate, persistent Node web service; the portal
Express API does not provide Myraa's `/api/config` or `/live` endpoints.

## Render

Create a Render Web Service from this repository with:

- Root Directory: `myraa/Myraa-Voice-Assistant-main`
- Build Command: `npm ci && npm run build`
- Start Command: `npm start`
- Health Check Path: `/api/config`
- `MYRAA_ALLOWED_ORIGINS`: the exact deployed Vercel origin, for example `https://your-portal.vercel.app`
- `GEMINI_API_KEY`: optional server-side key; never add it to Vercel or frontend code

If Myraa memories or a user-entered key must survive restarts, attach a Render
persistent disk, set `MYRAA_DATA_DIR` to its mount path, and use a plan that
supports disks. Without a disk, filesystem-stored memories and entered keys are
ephemeral; a Render `GEMINI_API_KEY` environment variable remains available.

## Vercel

Set `VITE_MYRAA_API_PREFIX` to the Myraa Render service origin, with no trailing
slash, for example `https://your-myraa-service.onrender.com`, then redeploy. The
WebSocket URL is derived as `wss://<same-host>/live`. Set `VITE_MYRAA_WS_URL`
only if the service uses a different WebSocket host/path. The Vite development
proxy continues to use local port 3001.

Use the Vercel production origin in `MYRAA_ALLOWED_ORIGINS`. Add preview origins
only when preview deployments need to connect. Render's assigned `PORT` is used
automatically.

Myraa's desktop-control tools require an agent on the user's own computer. A
cloud Render process cannot control the user's local applications or files; the
voice/API features remain available independently.
