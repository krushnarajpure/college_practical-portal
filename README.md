# College Practical Portal

This repository contains the full-stack foundation for a college practical portal with separate frontend, backend, and Myraa integration spaces.

## Structure

- frontend/ - React + Vite + Tailwind application
- backend/ - Node.js + Express.js + MongoDB API
- myraa/ - isolated integration area for existing Myraa project

## Quick start

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
npm install
npm run dev
```

## Academic Documents

Academic Documents is integrated into the existing authenticated student and teacher workspaces. Documents are stored in the `academicDocuments` MongoDB GridFS bucket; metadata and immutable original/version references are stored in the `AcademicDocument` collection.

### API routes

- `GET /api/academic-documents/student` lists documents matching the authenticated student's department, year, and semester.
- `GET /api/academic-documents/teacher` lists the authenticated teacher's uploads.
- `GET /api/academic-documents` dispatches to the authenticated role's scoped list.
- `POST /api/academic-documents` uploads a multipart `file` and department/year/semester targeting metadata.
- `GET /api/academic-documents/:id` returns authorized metadata; students are rechecked against their academic profile.
- `PUT /api/academic-documents/:id` updates teacher-owned metadata and targeting.
- `DELETE /api/academic-documents/:id` deactivates a teacher-owned document without deleting its original bytes.
- `GET /api/academic-documents/:id/preview` streams an authorized original inline; `/download` streams it as an attachment.
- `GET /api/academic-documents/:id/pages` returns page metadata; `/pages/:pageNumber` streams the generated high-resolution page PNG.
- `GET /api/academic-documents/:id/students` lists eligible students for the document owner/admin.
- `GET /api/academic-documents/:id/editable-fields` lists supported PDF form fields for an authorized student.
- `POST /api/academic-documents/:id/manual-edit` accepts `{ "values": { "Field name": "Value" } }` and adds a new PDF version.
- `POST /api/academic-documents/:id/ai-edit` accepts `{ "instruction": "..." }`; Gemini can change supported fillable fields only.
- `POST /api/academic-documents/:id/convert/word` and `/convert/excel` create and store actual DOCX/XLSX versions from extractable PDF text.
- `GET /api/academic-documents/:id/versions/:versionId/file` streams an authorized generated version.

All routes require the existing bearer-token authentication. Upload, update, delete and roster access require teacher/admin roles; student listing, preview, edit and conversion routes require the student role and recheck document eligibility on the server.

### Configuration and local test

Backend environment variables: `MONGODB_URI`, `JWT_SECRET`, `GEMINI_API_KEY` (or existing `AI_API_KEY`), `MAX_ACADEMIC_DOCUMENT_SIZE_MB` (default `25`), `PDF_PAGE_RENDER_DPI` (150-600, default `300`), and `FRONTEND_URL` (the frontend origin, without `/api`). Set frontend `VITE_API_URL` to the API base including `/api`; locally use `http://localhost:5000/api`.

The backend adds `pdf-lib` and `pdfjs-dist` for PDF form editing/text extraction, `docx` for Word output, and `exceljs` for Excel output. These dependencies are declared in `backend/package.json` and install with the normal backend `npm install`.

1. Start MongoDB and configure `backend/.env` with the values above.
2. Run `npm install` and `npm run dev` from `backend/`.
3. Set `VITE_API_URL=http://localhost:5000/api` in the frontend environment and run `npm install` and `npm run dev` from `frontend/`.
4. Log in as a teacher, open `/teacher/academic-documents`, and upload with a department/year/semester target.
5. Log in as a student with the same department/year/semester and open `/student/academic-documents`.

### Deployment and processing limits

Deploy the backend as a separate Render Web Service with the existing MongoDB connection and `GEMINI_API_KEY`; GridFS stores bytes in the configured MongoDB database. Set Render `FRONTEND_URL` to the exact Vercel origin and Vercel `VITE_API_URL` to the backend origin including `/api`, then redeploy both services.

Myraa is also a separate persistent Render Web Service because Vercel's static frontend deployment cannot run Myraa's Express server or WebSocket endpoint. Use `myraa/Myraa-Voice-Assistant-main` as the Render root directory, `npm ci && npm run build` as the build command, `npm start` as the start command, and `/api/config` as the health check. Set `MYRAA_ALLOWED_ORIGINS` to the Vercel origin and set Vercel `VITE_MYRAA_API_PREFIX` to the Myraa Render origin without a trailing slash. Redeploy Vercel after adding that variable. The frontend uses `/live` on the same Myraa origin for WebSocket connections.

If a Vercel build succeeds but portal requests fail in the browser, check that `VITE_API_URL` is set to the backend's public URL ending in `/api`; production no longer falls back to `localhost`. For Myraa, open the Render service's `/api/config` endpoint and confirm it returns JSON, then check that `MYRAA_ALLOWED_ORIGINS` exactly matches the deployed Vercel origin (including any custom domain). Free Render services can sleep and cause a slow first connection; use a continuously running service if that startup delay is unacceptable. Redeploy Vercel after changing either `VITE_` variable.

Every uploaded PDF is retained in GridFS and rendered into a PNG for every page at the configured DPI (300 by default). Page references are stored in `AcademicDocument.pageImages`; the student viewer loads the first page immediately and lazy-loads other pages through the authorized page endpoint. Manual and AI editing support fillable AcroForm PDF fields and detected static text replacements; arbitrary seals, signatures, logos, and page layout are not rewritten. Scanned PDFs require OCR for text editing, but their rendered page images can still be viewed. Word conversion reconstructs extractable PDF text as paragraphs; Excel conversion creates rows from extracted text and splits likely columns where possible. These conversions are real files, but they do not promise pixel-perfect layout or table recognition. DOC, DOCX, XLS, XLSX, PPT, PPTX, and image uploads can be viewed/downloaded as originals; page-image preview and PDF edit/conversion actions are available only where the format supports them.
