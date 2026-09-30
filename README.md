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
- `GET /api/academic-documents/:id/students` lists eligible students for the document owner/admin.
- `GET /api/academic-documents/:id/editable-fields` lists supported PDF form fields for an authorized student.
- `POST /api/academic-documents/:id/manual-edit` accepts `{ "values": { "Field name": "Value" } }` and adds a new PDF version.
- `POST /api/academic-documents/:id/ai-edit` accepts `{ "instruction": "..." }`; Gemini can change supported fillable fields only.
- `POST /api/academic-documents/:id/convert/word` and `/convert/excel` create and store actual DOCX/XLSX versions from extractable PDF text.
- `GET /api/academic-documents/:id/versions/:versionId/file` streams an authorized generated version.

All routes require the existing bearer-token authentication. Upload, update, delete and roster access require teacher/admin roles; student listing, preview, edit and conversion routes require the student role and recheck document eligibility on the server.

### Configuration and local test

Backend environment variables: `MONGODB_URI`, `JWT_SECRET`, `GEMINI_API_KEY` (or existing `AI_API_KEY`), `MAX_ACADEMIC_DOCUMENT_SIZE_MB` (default `25`), and `FRONTEND_URL` (the frontend origin, without `/api`). Set frontend `VITE_API_URL` to the API base including `/api`; locally use `http://localhost:5000/api`.

The backend adds `pdf-lib` and `pdfjs-dist` for PDF form editing/text extraction, `docx` for Word output, and `exceljs` for Excel output. These dependencies are declared in `backend/package.json` and install with the normal backend `npm install`.

1. Start MongoDB and configure `backend/.env` with the values above.
2. Run `npm install` and `npm run dev` from `backend/`.
3. Set `VITE_API_URL=http://localhost:5000/api` in the frontend environment and run `npm install` and `npm run dev` from `frontend/`.
4. Log in as a teacher, open `/teacher/academic-documents`, and upload with a department/year/semester target.
5. Log in as a student with the same department/year/semester and open `/student/academic-documents`.

### Deployment and processing limits

Deploy backend changes to Render with the existing MongoDB connection and `GEMINI_API_KEY`; GridFS stores bytes in the configured MongoDB database. Set Render `FRONTEND_URL` to `https://college-practical-portal.vercel.app` and Vercel `VITE_API_URL` to `https://college-practical-portal-backend.onrender.com/api`, then redeploy both services.

Manual and AI editing support fillable AcroForm PDF fields only. Arbitrary printed text, seals, signatures, logos, and page layout are not rewritten; unsupported files return a clear error and the original remains unchanged. Scanned PDFs require OCR, which is not configured. Word conversion reconstructs extractable PDF text as paragraphs; Excel conversion creates rows from extracted text and splits likely columns where possible. These conversions are real files, but they do not promise pixel-perfect layout or table recognition. DOC, DOCX, XLS, XLSX, PPT, PPTX, and image uploads can be viewed/downloaded as originals; preview and PDF edit/conversion actions are available only where the format supports them.
