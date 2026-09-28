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

The repository-root `vercel.json` builds this app from `frontend/` and publishes `frontend/dist`.
Set the Vercel environment variable `VITE_API_URL` to the public backend API base URL, including `/api`.
The backend must be deployed separately, with `FRONTEND_URL` set to the Vercel site origin.
