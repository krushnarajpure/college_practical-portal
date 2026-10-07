# Frontend

React + Vite + Tailwind CSS foundation for the College Practical Portal.

## Scripts

```bash
npm install
npm run dev
```

## Notes

- Protected routes and role-based structure are scaffolded.
- Frontend services are placeholder API adapters for future backend integration.
- Myraa is exposed via a dedicated student route.

## Vercel deployment

The repository-root `vercel.json` builds this app from `frontend/` and publishes `frontend/dist`. In Vercel Project Settings, keep **Root Directory** set to the repository root (`.`); the frontend imports the Myraa app from the sibling `myraa/` folder, so setting the project root to `frontend/` can make those source files unavailable to the build.
Set the Vercel environment variable `VITE_API_URL` to the public backend API base URL, including `/api`.
The backend must be deployed separately using the root [`render.yaml`](../render.yaml) Blueprint; configure its `FRONTEND_URL` to the Vercel site origin. Render Free may sleep after inactivity. Keep the Vercel `VITE_API_URL` set to `https://<backend-service>.onrender.com/api` and redeploy the frontend whenever the URL changes.
Also set `VITE_MYRAA_API_PREFIX` to the public Myraa Render service origin (without a trailing slash), then redeploy. See [`../myraa/README.md`](../myraa/README.md) for the Myraa service setup.
