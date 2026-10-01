import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, Check, Download, Eye, FileText,
  Filter, Link2, LoaderCircle, Pencil, Plus, Search, Sparkles, Trash2, Upload, Users, X
} from 'lucide-react';
import api from '../../services/api';
import academicDocumentService from '../../services/academicDocumentService';

const categories = [
  ['Assignments', ['assignment']],
  ['Certificates', ['certificate']],
  ['Index', ['index']],
  ['Practical Documents', ['practical', 'manual', 'lab manual']],
  ['Notes', ['notes', 'note']],
  ['Question Papers', ['question paper', 'question papers']],
  ['Other Documents', ['other']]
];
const documentTypes = ['Assignment', 'Certificate', 'Index', 'Practical', 'Notes', 'Other Document'];
const quickPrompts = ['Change my name', 'Add roll number', 'Update department', 'Change date', 'Change semester', 'Keep everything else unchanged'];
const uploadSizeLimit = Number(import.meta.env.VITE_MAX_ACADEMIC_DOCUMENT_SIZE_MB) || 25;
const allowedUploadExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx'];
const yearLevels = [
  { level: 1, name: '1st Year', semesters: [1, 2] },
  { level: 2, name: '2nd Year', semesters: [3, 4] },
  { level: 3, name: '3rd Year', semesters: [5, 6] },
  { level: 4, name: '4th Year', semesters: [7, 8] }
];
const ref = (value) => value?.name || '';
const refId = (value) => value?._id || value || '';
const semesterLabel = (value) => value?.number ? `Semester ${value.number}` : ref(value);
const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '—';
const formatSize = (value) => value ? `${(value / 1024 / 1024).toFixed(2)} MB` : '—';
const isPdf = (document) => (document?.fileType || document?.originalFile?.mimeType || '').includes('pdf') || document?.fileName?.toLowerCase().endsWith('.pdf');
const isImage = (document) => (document?.fileType || document?.originalFile?.mimeType || '').startsWith('image/');
const pageTitle = (eyebrow, title, subtitle, action) => <header className="page-heading academic-doc-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{subtitle}</p></div>{action}</header>;

function AcademicDocumentsPage({ role, notify }) {
  const location = useLocation();
  const navigate = useNavigate();
  const parts = location.pathname.split('/').filter(Boolean);
  const base = `/${role}/academic-documents`;
  const documentId = parts[2] || '';
  const action = parts[3] || '';
  const isTeacher = role === 'teacher';
  const isUpload = isTeacher && (parts[2] === 'upload' || action === 'upload');
  const isTeacherEdit = isTeacher && action === 'edit';
  const isEdit = action === 'edit';
  const isAiEdit = action === 'ai-edit';
  const isDetail = Boolean(documentId) && !isUpload;
  const [documents, setDocuments] = useState([]);
  const [document, setDocument] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentsDocumentId, setStudentsDocumentId] = useState('');
  const [fields, setFields] = useState({ name: '', description: '', type: '', departmentId: '', yearId: '', semesterId: '' });
  const [catalog, setCatalog] = useState({ departments: [], years: [], semesters: [] });
  const [editableFields, setEditableFields] = useState([]);
  const [staticTextItems, setStaticTextItems] = useState([]);
  const [totalTextItems, setTotalTextItems] = useState(0);
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [editValues, setEditValues] = useState({});
  const [originalEditValues, setOriginalEditValues] = useState({});
  const [previewChanges, setPreviewChanges] = useState(false);
  const [editedPreviewUrl, setEditedPreviewUrl] = useState('');
  const [manualPlacements, setManualPlacements] = useState([]);
  const [manualPlacement, setManualPlacement] = useState({ pageNumber: '1', x: '72', y: '72', newText: '' });
  const [pendingAiEdit, setPendingAiEdit] = useState(null);
  const [metadataEditing, setMetadataEditing] = useState(false);
  const [metadata, setMetadata] = useState({ name: '', description: '', type: '', departmentId: '', yearId: '', semesterId: '' });
  const [instruction, setInstruction] = useState('');
  const [query, setQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [tab, setTab] = useState('All');
  const [category, setCategory] = useState('');
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [uploadedDocument, setUploadedDocument] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showStudents, setShowStudents] = useState(false);

  const reloadDocuments = async () => {
    const response = isTeacher
      ? await academicDocumentService.getTeacherDocuments()
      : await academicDocumentService.getStudentDocuments();
    setDocuments(response?.data?.documents || []);
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        if (isUpload || (isTeacher && isDetail)) {
          const [departments, years, semesters] = await Promise.all([
            api.get('/departments'), api.get('/years'), api.get('/semesters')
          ]);
          if (!active) return;
          setCatalog({
            departments: departments?.data?.departments || [],
            years: years?.data?.years || [],
            semesters: semesters?.data?.semesters || []
          });
        }
        if (isDetail) {
          const response = await academicDocumentService.getById(documentId);
          if (!active) return;
          const item = response?.data?.document || null;
          setDocument(item);
          setMetadata({ name: item?.name || '', description: item?.description || '', type: item?.type || '', departmentId: refId(item?.departmentId), yearId: refId(item?.yearId), semesterId: refId(item?.semesterId) });
          if (isTeacherEdit) setMetadataEditing(true);
          const fileBlob = await academicDocumentService.getFile(documentId);
          if (!active) return;
          setPreviewUrl(URL.createObjectURL(fileBlob));
        } else if (!isUpload) {
          await reloadDocuments();
        }
      } catch (loadError) {
        if (active) setError(loadError.message || 'Unable to load academic documents.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [role, documentId, action]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  useEffect(() => {
    if (!(isEdit || isAiEdit) || !documentId) return;
    let active = true;
    academicDocumentService.getEditableFields(documentId).then((response) => {
      if (!active) return;
      const items = response?.data?.fields || [];
      const textItems = response?.data?.textItems || [];
      setEditableFields(items);
      setStaticTextItems(textItems);
      setTotalTextItems(response?.data?.totalTextItems || textItems.length);
      setPdfPageCount(response?.data?.pageCount || 0);
      const values = Object.fromEntries(items.map((item) => [item.name, item.value]));
      setOriginalEditValues(values);
      setEditValues(values);
    }).catch((editError) => { if (active) setError(editError.message || 'Manual editing is unavailable for this file.'); });
    return () => { active = false; };
  }, [isEdit, isAiEdit, documentId]);

  useEffect(() => () => { if (editedPreviewUrl) URL.revokeObjectURL(editedPreviewUrl); }, [editedPreviewUrl]);

  const yearOptions = yearLevels.map((level) => ({
    ...level,
    record: catalog.years.find((year) => Number(year.academicLevel) === level.level)
      || documents.map((item) => item.yearId).find((year) => Number(year?.academicLevel) === level.level)
  }));
  const selectedYear = yearOptions.find((year) => String(year.record?._id) === String(fields.yearId));
  const semesters = catalog.semesters.filter((semester) => String(refId(semester.yearId)) === String(fields.yearId)
    && selectedYear?.semesters.includes(Number(semester.number)));
  const metadataSemesters = catalog.semesters.filter((semester) => String(refId(semester.yearId)) === String(metadata.yearId)
    && yearOptions.find((year) => String(year.record?._id) === String(metadata.yearId))?.semesters.includes(Number(semester.number)));
  const filteredDocuments = useMemo(() => documents.filter((item) => {
    const categoryTypes = categories.find(([name]) => name === category)?.[1];
    const text = [item.name, item.type, ref(item.departmentId), item.uploadedBy?.name].join(' ').toLowerCase();
    const isRecent = Date.now() - new Date(item.createdAt).getTime() <= 30 * 24 * 60 * 60 * 1000;
    const isCompleted = (item.versions || []).length > 0;
    return (!query || text.includes(query.toLowerCase()))
      && (!categoryTypes || categoryTypes.some((type) => String(item.type).toLowerCase().includes(type)))
      && (!typeFilter || item.type === typeFilter)
      && (!semesterFilter || refId(item.semesterId) === semesterFilter)
      && (!departmentFilter || refId(item.departmentId) === departmentFilter)
      && (!yearFilter || refId(item.yearId) === yearFilter)
      && (tab !== 'Recent' || isRecent)
      && (tab !== 'Completed' || isCompleted)
      && (tab !== 'Available' || !isCompleted);
  }), [documents, query, category, departmentFilter, typeFilter, semesterFilter, yearFilter, tab]);

  const categoryCounts = categories.map(([name, types]) => [name, documents.filter((item) => types.some((type) => String(item.type).toLowerCase().includes(type))).length]);
  const departmentOptions = documents.map((item) => item.departmentId).filter((item, index, values) => item?._id && values.findIndex((value) => String(value?._id) === String(item._id)) === index);
  const semesterOptions = documents.map((item) => item.semesterId).filter((item, index, values) => item?._id && values.findIndex((value) => String(value?._id) === String(item._id)) === index);

  const updateUploadTarget = (field, value) => {
    setSuccess('');
    setFields((current) => {
      const next = { ...current, [field]: value };
      const nextYear = yearOptions.find((year) => String(year.record?._id) === String(next.yearId));
      if (field === 'yearId' && !nextYear?.semesters.some((number) => catalog.semesters.some((semester) => String(semester._id) === String(current.semesterId) && Number(semester.number) === number && String(refId(semester.yearId)) === String(value)))) next.semesterId = '';
      return next;
    });
  };

  const updateMetadataTarget = (field, value) => {
    setMetadata((current) => {
      const next = { ...current, [field]: value };
      const nextYear = yearOptions.find((year) => String(year.record?._id) === String(next.yearId));
      if (field === 'yearId' && !nextYear?.semesters.some((number) => catalog.semesters.some((semester) => String(semester._id) === String(current.semesterId) && Number(semester.number) === number && String(refId(semester.yearId)) === String(value)))) next.semesterId = '';
      return next;
    });
  };

  const chooseFile = (selectedFile) => {
    if (!selectedFile) return;
    const extension = `.${selectedFile.name.split('.').pop()}`.toLowerCase();
    if (!allowedUploadExtensions.includes(extension)) {
      setFile(null);
      setError('Choose a PDF, DOC, DOCX, XLS or XLSX file.');
      return;
    }
    if (selectedFile.size > uploadSizeLimit * 1024 * 1024) {
      setFile(null);
      setError(`Files must be ${uploadSizeLimit} MB or smaller.`);
      return;
    }
    setFile(selectedFile);
    setError('');
  };

  const uploadDocument = async (event) => {
    event.preventDefault();
    setBusy(true); setError(''); setSuccess('');
    try {
      if (!fields.name.trim()) throw new Error('Enter a document name.');
      if (!fields.type) throw new Error('Select a document type.');
      if (!fields.departmentId) throw new Error('Select a department.');
      if (!fields.yearId) throw new Error('Select a year.');
      if (!fields.semesterId) throw new Error('Select a semester.');
      if (!file) throw new Error('Choose a document to upload.');
      const payload = new FormData();
      Object.entries(fields).forEach(([key, value]) => payload.append(key, value));
      payload.append('file', file);
      const response = await academicDocumentService.upload(payload);
      const savedDocument = response?.data?.document;
      if (!savedDocument?._id) throw new Error('The upload response did not include a saved document. Please check the document list before retrying.');
      setUploadedDocument(savedDocument);
      setSuccess('Document Uploaded Successfully');
      notify?.('Document Uploaded Successfully');
    } catch (uploadError) {
      setError(uploadError.message || 'Unable to upload this document. Please try again.');
    } finally { setBusy(false); }
  };

  const downloadFile = async (versionId = '', targetDocumentId = documentId, targetDocument = document) => {
    try {
      const blob = await academicDocumentService.getFile(targetDocumentId, versionId, true);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = versionId
        ? targetDocument?.versions?.find((item) => item._id === versionId)?.fileName || targetDocument?.name || 'document'
        : targetDocument?.fileName || targetDocument?.originalFile?.fileName || targetDocument?.name || 'document';
      anchor.click();
      URL.revokeObjectURL(url);
      setSuccess('Download started.');
    } catch (downloadError) { setError(downloadError.message || 'Unable to download this document.'); }
  };

  const createEdit = async () => {
    setBusy(true); setError('');
    try {
      let edits = collectPdfEdits();
      if (isAiEdit) {
        if (!pendingAiEdit) {
          const proposal = await academicDocumentService.getAiEditChanges(documentId, instruction);
          edits = proposal?.data || {};
        } else edits = pendingAiEdit;
      }
      const response = isAiEdit
        ? await academicDocumentService.aiEdit(documentId, instruction, edits)
        : await academicDocumentService.manualEdit(documentId, edits);
      setSuccess(response?.message || 'Document edited successfully.');
      notify?.(response?.message || 'Document edited successfully.');
      navigate(`${base}/${documentId}`);
    } catch (editError) { setError(editError.message || 'Unable to edit this document.'); }
    finally { setBusy(false); }
  };

  const collectPdfEdits = () => ({
    formValues: Object.fromEntries(editableFields
      .filter((item) => editValues[item.name] !== originalEditValues[item.name])
      .map((item) => [item.name, editValues[item.name]])),
    changes: [
      ...staticTextItems.filter((item) => editValues[item.id] !== undefined && editValues[item.id] !== item.text)
        .map((item) => ({ itemId: item.id, field: item.text.slice(0, 160), oldText: item.text, newText: editValues[item.id] })),
      ...manualPlacements
    ]
  });

  const previewPdfEdits = async () => {
    setBusy(true); setError(''); setSuccess('');
    try {
      let edits = collectPdfEdits();
      if (isAiEdit) {
        if (!instruction.trim()) throw new Error('Describe the changes for Gemini first.');
        const proposal = await academicDocumentService.getAiEditChanges(documentId, instruction);
        edits = proposal?.data || {};
        setPendingAiEdit(edits);
      }
      if (!edits.changes?.length && !Object.keys(edits.formValues || {}).length) {
        throw new Error('Choose at least one text change before previewing.');
      }
      const blob = await academicDocumentService.previewManualEdit(documentId, edits);
      const nextUrl = URL.createObjectURL(blob);
      setEditedPreviewUrl((current) => { if (current) URL.revokeObjectURL(current); return nextUrl; });
      setPreviewChanges(true);
      setSuccess(isAiEdit ? 'Gemini changes are ready to review.' : 'Edited PDF preview ready.');
    } catch (previewError) {
      setError(previewError.message || 'Unable to create the edited PDF preview.');
    } finally { setBusy(false); }
  };

  const addManualPlacement = () => {
    const pageNumber = Number(manualPlacement.pageNumber);
    const x = Number(manualPlacement.x);
    const y = Number(manualPlacement.y);
    const newText = manualPlacement.newText.trim();
    if (!newText || !Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pdfPageCount || !Number.isFinite(x) || !Number.isFinite(y)) {
      setError('Enter text, a valid page number, and numeric X/Y coordinates.');
      return;
    }
    setManualPlacements((current) => [...current, { pageNumber, x, y, newText, field: 'Added text' }]);
    setManualPlacement((current) => ({ ...current, newText: '' }));
    setEditedPreviewUrl((current) => { if (current) URL.revokeObjectURL(current); return ''; });
    setPreviewChanges(false);
    setError('');
  };

  const clearEditedPreview = () => {
    setPreviewChanges(false);
    setPendingAiEdit(null);
    setEditedPreviewUrl((current) => { if (current) URL.revokeObjectURL(current); return ''; });
  };

  const updateEditValue = (field, value) => {
    setEditValues((current) => ({ ...current, [field]: value }));
    clearEditedPreview();
  };

  const resetPdfEdits = () => {
    setEditValues(originalEditValues);
    setManualPlacements([]);
    setInstruction('');
    setManualPlacement({ pageNumber: '1', x: '72', y: '72', newText: '' });
    setError('');
    setSuccess('');
    clearEditedPreview();
  };

  const saveMetadata = async () => {
    setBusy(true); setError('');
    try {
      const response = await academicDocumentService.update(documentId, metadata);
      setDocument(response?.data?.document || { ...document, ...metadata });
      setMetadataEditing(false);
      setSuccess('Document details updated.');
    } catch (updateError) { setError(updateError.message || 'Unable to update document details.'); }
    finally { setBusy(false); }
  };

  const previewVersion = async (versionId) => {
    try {
      const blob = await academicDocumentService.getFile(documentId, versionId);
      setPreviewUrl(URL.createObjectURL(blob));
      setSuccess('Version preview opened.');
    } catch (previewError) { setError(previewError.message || 'Unable to preview this version.'); }
  };

  const convert = async (format) => {
    setBusy(true); setError(''); setSuccess('');
    try {
      const response = await academicDocumentService.convert(documentId, format);
      const versionId = response?.data?.version?._id;
      setSuccess(response?.data?.note || 'Document converted successfully.');
      const blob = await academicDocumentService.getFile(documentId, versionId, true);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = response?.data?.version?.fileName || `${document.name}.${format === 'word' ? 'docx' : 'xlsx'}`;
      anchor.click();
      URL.revokeObjectURL(url);
      const refreshed = await academicDocumentService.getById(documentId);
      setDocument(refreshed?.data?.document || document);
    } catch (convertError) { setError(convertError.message || 'Unable to convert this document.'); }
    finally { setBusy(false); }
  };

  const removeDocument = async (id) => {
    if (!window.confirm('Remove this academic document for students?')) return;
    try {
      await academicDocumentService.remove(id);
      await reloadDocuments();
      notify?.('Academic document removed.');
    } catch (removeError) { setError(removeError.message || 'Unable to remove this document.'); }
  };

  const loadEligibleStudents = async (id = studentsDocumentId) => {
    try {
      const response = await academicDocumentService.getEligibleStudents(id);
      setStudents(response?.data?.students || []);
      setShowStudents(true);
    } catch (studentsError) { setError(studentsError.message || 'Unable to load eligible students.'); }
  };

  const currentPdfEdits = collectPdfEdits();
  const hasPdfEdits = currentPdfEdits.changes.length > 0 || Object.keys(currentPdfEdits.formValues).length > 0;

  if (loading) return <section className="surface academic-doc-loading" aria-label="Loading academic documents"><LoaderCircle className="spinner" size={20} /><span>Loading academic documents...</span></section>;
  if (isUpload) return <>

    {pageTitle('CONTENT MANAGEMENT', 'Upload Document', 'Choose the academic group that should receive this document.', <Link to={base} className="button button-secondary"><ArrowLeft size={15} />All documents</Link>)}
    {uploadedDocument ? <section className="surface academic-doc-upload-success">
      <Check size={25} />
      <h2>Document Uploaded Successfully</h2>
      <p>{uploadedDocument.name} is saved and available to students in the selected department, year, and semester.</p>
      <div className="academic-doc-submit"><Link className="button button-primary" to={`${base}/${uploadedDocument._id}`}><Eye size={15} />View Document</Link><Link className="button button-secondary" to={base}><ArrowLeft size={15} />Back to Academic Documents</Link></div>
    </section> : <form className="surface academic-doc-form" onSubmit={uploadDocument}>
      <label className="form-field"><span>Document Name</span><input required maxLength="160" value={fields.name} onChange={(event) => setFields((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. College Certificate" /></label>
      <label className="form-field"><span>Document Type</span><select required value={fields.type} onChange={(event) => setFields((current) => ({ ...current, type: event.target.value }))}><option value="">Select document type</option>{documentTypes.map((type) => <option key={type} value={type}>{type === 'Other Document' ? 'Other' : type}</option>)}</select></label>
      <label className="form-field"><span>Department</span><select required value={fields.departmentId} onChange={(event) => updateUploadTarget('departmentId', event.target.value)}><option value="">Select department</option>{catalog.departments.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
      <label className="form-field"><span>Year</span><select required value={fields.yearId} onChange={(event) => updateUploadTarget('yearId', event.target.value)}><option value="">Select year</option>{yearOptions.map((item) => <option key={item.level} value={item.record?._id || ''} disabled={!item.record}>{item.name}</option>)}</select></label>
      <label className="form-field"><span>Semester</span><select required value={fields.semesterId} disabled={!fields.yearId} onChange={(event) => updateUploadTarget('semesterId', event.target.value)}><option value="">Select semester</option>{semesters.map((item) => <option key={item._id} value={item._id}>{semesterLabel(item)}</option>)}</select></label>
      <label className="form-field academic-doc-wide"><span>Description</span><textarea rows="3" maxLength="2000" value={fields.description} onChange={(event) => setFields((current) => ({ ...current, description: event.target.value }))} placeholder="Optional details for students" /></label>
      <div className={`academic-doc-dropzone academic-doc-wide ${dragActive ? 'is-dragging' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragActive(false)} onDrop={(event) => { event.preventDefault(); setDragActive(false); chooseFile(event.dataTransfer.files?.[0]); }}>
        <Upload size={22} />
        <strong>Drag &amp; drop a document here</strong>
        <span>PDF, DOC, DOCX, XLS or XLSX · up to {uploadSizeLimit} MB</span>
        <button className="button button-secondary" type="button" disabled={busy} onClick={() => fileInputRef.current?.click()}>{file ? 'Replace file' : 'Choose file'}</button>
        <input ref={fileInputRef} className="academic-doc-upload-input" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={(event) => { chooseFile(event.target.files?.[0]); event.target.value = ''; }} />
        {file && <div className="academic-doc-selected-file"><FileText size={19} /><div><strong>{file.name}</strong><span>{file.type || file.name.split('.').pop().toUpperCase()} · {formatSize(file.size)}</span></div><button className="button button-secondary" type="button" disabled={busy} onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>Remove file</button></div>}
      </div>
      {error && <p className="form-error academic-doc-wide" role="alert">{error}</p>}
      {success && <p className="form-success academic-doc-wide" role="status">{success}</p>}
      {busy && <progress className="academic-doc-upload-progress academic-doc-wide" aria-label="Upload in progress" />}
      <div className="academic-doc-wide academic-doc-submit"><button className="button button-primary" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spinner" size={16} />Uploading...</> : <><Upload size={16} />Upload Document</>}</button></div>
    </form>}
  </>;
  if (!isDetail) {
    const actionButton = isTeacher
      ? <Link to={`${base}/upload`} className="button button-primary"><Plus size={16} />Upload Document</Link>
      : null;
    return <>
      {pageTitle(isTeacher ? 'CONTENT MANAGEMENT' : 'STUDENT WORKSPACE', 'Academic Documents', isTeacher ? 'Upload and manage resources for your assigned academic groups.' : 'Access your assignments, certificates, index and other important academic documents.', actionButton)}
      {error && <p className="form-error" role="alert">{error}</p>}
      {!isTeacher && <div className="academic-doc-categories">{categoryCounts.map(([name, count]) => <button className={`academic-doc-category ${category === name ? 'selected' : ''}`} key={name} onClick={() => setCategory(category === name ? '' : name)}><span><FileText size={17} /></span><strong>{name}</strong><b>{count}</b></button>)}</div>}
      <div className="table-toolbar academic-doc-toolbar">
        <label className="field-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documents, department, teacher" /></label>
        <label className="academic-doc-filter"><Filter size={15} /><select aria-label="Filter by document type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">All types</option>{documentTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
        {isTeacher && <label className="academic-doc-filter"><select aria-label="Filter by department" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}><option value="">All departments</option>{departmentOptions.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>}
        <label className="academic-doc-filter"><select aria-label="Filter by year" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}><option value="">All years</option>{yearOptions.filter((year) => year.record && documents.some((item) => refId(item.yearId) === String(year.record._id))).map((item) => <option key={item.level} value={item.record._id}>{item.name}</option>)}</select></label>
        <label className="academic-doc-filter"><select aria-label="Filter by semester" value={semesterFilter} onChange={(event) => setSemesterFilter(event.target.value)}><option value="">All semesters</option>{semesterOptions.map((item) => <option key={item._id} value={item._id}>{semesterLabel(item)}</option>)}</select></label>
      </div>
      {!isTeacher && <div className="segmented-control academic-doc-tabs">{['All', 'Recent', 'Completed', 'Available'].map((item) => <button className={tab === item ? 'selected' : ''} key={item} onClick={() => setTab(item)}>{item}</button>)}</div>}
      {documents.length === 0 ? <section className="surface academic-doc-empty"><FileText size={26} /><h2>No academic documents yet</h2><p>{isTeacher ? 'Upload a document for students in one of your assigned academic groups.' : "Your teachers haven't uploaded any documents for your academic profile."}</p></section>
        : filteredDocuments.length === 0 ? <section className="surface academic-doc-empty"><Search size={24} /><h2>No matching documents</h2><p>Try clearing a category or filter.</p><button className="button button-secondary" onClick={() => { setQuery(''); setCategory(''); setDepartmentFilter(''); setTypeFilter(''); setSemesterFilter(''); setYearFilter(''); setTab('All'); }}>Clear filters</button></section>
          : <div className="surface data-table-wrap academic-doc-table-wrap"><table className="data-table academic-doc-table"><thead><tr><th>Document Name</th><th>Type</th>{isTeacher && <><th>Department</th><th>Year</th></>}<th>Semester</th><th>Uploaded By</th><th>Upload Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredDocuments.map((item) => <tr key={item._id}><td><span className="table-title"><span className="academic-doc-file-icon"><FileText size={16} /></span><span><strong>{item.name}</strong><small>{item.fileName}</small></span></span></td><td>{item.type}</td>{isTeacher && <><td>{ref(item.departmentId) || '—'}</td><td>{yearLevels.find((year) => year.level === Number(item.yearId?.academicLevel))?.name || ref(item.yearId) || '—'}</td></>}<td>{semesterLabel(item.semesterId) || '—'}</td><td>{item.uploadedBy?.name || item.uploadedByName || 'Teacher'}</td><td>{formatDate(item.uploadedAt || item.createdAt)}</td><td><span className="academic-doc-status">{isTeacher ? item.status === 'draft' ? 'Draft' : 'Published' : 'Available'}</span></td><td><div className="table-actions"><Link className="icon-button" title="View document" aria-label="View document" to={`${base}/${item._id}`}><Eye size={15} /></Link>{isTeacher ? <><Link className="icon-button" title="Edit metadata" aria-label="Edit metadata" to={`${base}/${item._id}/edit`}><Pencil size={15} /></Link><button className="icon-button" title="View eligible students" aria-label="View eligible students" onClick={() => { setDocument(item); setStudentsDocumentId(item._id); loadEligibleStudents(item._id); }}><Users size={15} /></button><button className="icon-button danger-action" title="Delete document" aria-label="Delete document" onClick={() => removeDocument(item._id)}><Trash2 size={15} /></button></> : <button className="icon-button" title="Download document" aria-label="Download document" onClick={() => downloadFile('', item._id, item)}><Download size={15} /></button>}</div></td></tr>)}</tbody></table></div>}
      {isTeacher && showStudents && <div className="academic-doc-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowStudents(false); }}><section className="surface academic-doc-dialog"><button className="icon-button academic-doc-close" onClick={() => setShowStudents(false)} aria-label="Close eligible students"><X size={17} /></button><p className="eyebrow">DOCUMENT ACCESS</p><h2>Eligible students</h2><p>{document?.name}</p>{students.length ? <div className="academic-doc-student-list">{students.map((student) => <div key={student._id}><strong>{student.name}</strong><span>{student.studentId || student.email}</span></div>)}</div> : <p>No active students match this target.</p>}</section></div>}
    </>;
  }

  const departmentName = ref(document?.departmentId);
  const yearName = yearLevels.find((item) => item.level === Number(document?.yearId?.academicLevel))?.name || ref(document?.yearId);
  const semesterName = semesterLabel(document?.semesterId);

  if (isEdit || isAiEdit) return <>
    {pageTitle(isAiEdit ? 'GEMINI ASSISTED' : 'DOCUMENT EDITOR', isAiEdit ? 'AI Edit with Gemini' : 'Edit PDF in website', document?.name || 'Create a separate edited version. The teacher-uploaded original remains unchanged.', <Link to={`${base}/${documentId}`} className="button button-secondary"><ArrowLeft size={15} />Back to document</Link>)}
    {isAiEdit ? <section className="surface academic-doc-editor">
      <label className="form-field academic-doc-wide"><span>Describe the changes</span><textarea rows="5" maxLength="2000" value={instruction} onChange={(event) => { setInstruction(event.target.value); clearEditedPreview(); }} placeholder="Change the student name to Krushna Rajpure and roll number to 112." /></label>
      <div className="academic-doc-prompts">{quickPrompts.map((prompt) => <button className="button button-secondary" type="button" key={prompt} onClick={() => { setInstruction((value) => `${value}${value ? ' ' : ''}${prompt}.`); clearEditedPreview(); }}>{prompt}</button>)}</div>
    </section> : <section className="surface academic-doc-editor">
      {editableFields.map((item) => <label className="form-field" key={item.name}><span>{item.name}</span>{item.type === 'PDFCheckBox' ? <input type="checkbox" checked={editValues[item.name] === 'true'} onChange={(event) => updateEditValue(item.name, String(event.target.checked))} /> : item.options?.length ? <select value={editValues[item.name] ?? ''} onChange={(event) => updateEditValue(item.name, event.target.value)}><option value="">Select a value</option>{item.options.map((option) => <option key={option}>{option}</option>)}</select> : <input value={editValues[item.name] ?? ''} onChange={(event) => updateEditValue(item.name, event.target.value)} />}</label>)}
      {staticTextItems.map((item) => <label className="form-field academic-doc-static-text" key={item.id}><span>Page {item.pageNumber} · {item.text}</span><small>Position {Math.round(item.x)}, {Math.round(item.y)} · {Math.round(item.fontSize)} pt</small><input value={editValues[item.id] ?? ''} onChange={(event) => updateEditValue(item.id, event.target.value)} placeholder={`Replace: ${item.text}`} /></label>)}
      {totalTextItems > staticTextItems.length && <p className="academic-doc-wide">Showing the first {staticTextItems.length} of {totalTextItems} detected text items.</p>}
      {totalTextItems === 0 && <p className="academic-doc-wide" role="status">No selectable text was detected. This may be a scanned PDF. You can place new text manually below, but image-based original text cannot be erased automatically.</p>}
      {totalTextItems === 0 && <section className="academic-doc-manual-placement academic-doc-wide"><h2>Place text manually</h2><label className="form-field"><span>Page</span><input type="number" min="1" max={pdfPageCount || undefined} value={manualPlacement.pageNumber} onChange={(event) => setManualPlacement({ ...manualPlacement, pageNumber: event.target.value })} /></label><label className="form-field"><span>X position (PDF points)</span><input type="number" min="0" value={manualPlacement.x} onChange={(event) => setManualPlacement({ ...manualPlacement, x: event.target.value })} /></label><label className="form-field"><span>Y position (PDF points)</span><input type="number" min="0" value={manualPlacement.y} onChange={(event) => setManualPlacement({ ...manualPlacement, y: event.target.value })} /></label><label className="form-field"><span>Text to place</span><input value={manualPlacement.newText} onChange={(event) => setManualPlacement({ ...manualPlacement, newText: event.target.value })} /></label><button className="button button-secondary" type="button" onClick={addManualPlacement}>Add text</button>{manualPlacements.map((item, index) => <div className="academic-doc-placement-item" key={`${item.pageNumber}-${index}`}><span>Page {item.pageNumber} · ({item.x}, {item.y}) · {item.newText}</span><button className="button button-secondary" type="button" onClick={() => { setManualPlacements((current) => current.filter((_, itemIndex) => itemIndex !== index)); clearEditedPreview(); }}>Remove</button></div>)}</section>}
    </section>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {success && <p className="form-success" role="status">{success}</p>}
    {previewChanges && isAiEdit && pendingAiEdit && <section className="surface academic-doc-change-preview"><strong>Gemini proposed changes</strong>{(pendingAiEdit.changes || []).map((change, index) => <p key={`${change.itemId}-${index}`}><span>{change.field}</span><s>{change.oldText || 'Empty'}</s><b>{change.newText}</b></p>)}{Object.entries(pendingAiEdit.formValues || {}).map(([field, value]) => <p key={field}><span>{field}</span><b>{value}</b></p>)}</section>}
    <section className="surface academic-doc-preview academic-doc-edit-preview"><div className="academic-doc-preview-heading"><div><span className="eyebrow">{previewChanges && editedPreviewUrl ? 'EDITED PDF PREVIEW' : 'ORIGINAL PDF PREVIEW'}</span><strong>{document?.fileName || document?.originalFile?.fileName || document?.name}</strong></div></div>{(previewChanges && editedPreviewUrl) || previewUrl ? <iframe title={previewChanges && editedPreviewUrl ? 'Edited PDF preview' : 'Original PDF preview'} src={previewChanges && editedPreviewUrl ? editedPreviewUrl : previewUrl} /> : <div className="academic-doc-no-preview"><FileText size={30} /><strong>PDF preview unavailable</strong></div>}</section>
    <div className="academic-doc-submit"><button className="button button-secondary" type="button" disabled={busy || (isAiEdit ? !instruction.trim() : !hasPdfEdits)} onClick={previewPdfEdits}><Eye size={15} />Preview Changes</button><button className="button button-secondary" type="button" disabled={busy} onClick={resetPdfEdits}>Reset</button><button className="button button-primary" type="button" disabled={busy || (isAiEdit ? !pendingAiEdit : !hasPdfEdits)} onClick={createEdit}>{busy ? <><LoaderCircle className="spinner" size={16} />Applying...</> : <>{isAiEdit ? <Sparkles size={16} /> : <Check size={16} />}Apply Changes</>}</button></div>
  </>;

  const fileVersions = document?.versions || [];
  return <>
    {pageTitle('ACADEMIC DOCUMENT', document?.name || 'Document', document?.type || 'Document', <Link to={base} className="button button-secondary"><ArrowLeft size={15} />All documents</Link>)}
    {error && <p className="form-error" role="alert">{error}</p>}{success && <p className="form-success" role="status">{success}</p>}
    {isTeacher && <section className="surface academic-doc-manage">{metadataEditing ? <><div className="academic-doc-manage-fields"><label className="form-field"><span>Document name</span><input value={metadata.name} onChange={(event) => setMetadata({ ...metadata, name: event.target.value })} /></label><label className="form-field"><span>Document type</span><select value={metadata.type} onChange={(event) => setMetadata({ ...metadata, type: event.target.value })}>{documentTypes.map((type) => <option key={type} value={type}>{type === 'Other Document' ? 'Other' : type}</option>)}</select></label><label className="form-field"><span>Department</span><select required value={metadata.departmentId} onChange={(event) => updateMetadataTarget('departmentId', event.target.value)}><option value="">Select department</option>{catalog.departments.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label><label className="form-field"><span>Year</span><select required value={metadata.yearId} onChange={(event) => updateMetadataTarget('yearId', event.target.value)}><option value="">Select year</option>{yearOptions.map((item) => <option key={item.level} value={item.record?._id || ''} disabled={!item.record}>{item.name}</option>)}</select></label><label className="form-field"><span>Semester</span><select required value={metadata.semesterId} disabled={!metadata.yearId} onChange={(event) => updateMetadataTarget('semesterId', event.target.value)}><option value="">Select semester</option>{metadataSemesters.map((item) => <option key={item._id} value={item._id}>{semesterLabel(item)}</option>)}</select></label><label className="form-field"><span>Description</span><input value={metadata.description} onChange={(event) => setMetadata({ ...metadata, description: event.target.value })} /></label></div><div className="academic-doc-submit"><button className="button button-secondary" onClick={() => setMetadataEditing(false)}>Cancel</button><button className="button button-primary" disabled={busy || !metadata.name.trim() || !metadata.departmentId || !metadata.yearId || !metadata.semesterId} onClick={saveMetadata}>{busy ? 'Saving...' : 'Save details'}</button></div></> : <button className="button button-secondary" onClick={() => setMetadataEditing(true)}><FileText size={15} />Edit document details</button>}</section>}
    <div className="academic-doc-detail-layout"><section className="surface academic-doc-preview"><div className="academic-doc-preview-heading"><div><span className="eyebrow">DOCUMENT PREVIEW</span><strong>{document?.fileName || document?.originalFile?.fileName}</strong></div><button className="button button-secondary" onClick={() => downloadFile()}><Download size={15} />Download</button></div>{previewUrl && isPdf(document) ? <iframe title={`${document?.name} PDF preview`} src={previewUrl} /> : previewUrl && isImage(document) ? <img src={previewUrl} alt={document?.name || 'Academic document'} /> : <div className="academic-doc-no-preview"><FileText size={30} /><strong>Preview unavailable for this format</strong><span>Download the original file to open it.</span></div>}</section>
      <aside className="surface academic-doc-metadata"><h2>Document details</h2><dl><div><dt>Type</dt><dd>{document?.type}</dd></div><div><dt>Department</dt><dd>{departmentName || '—'}</dd></div><div><dt>Year / semester</dt><dd>{[yearName, semesterName].filter(Boolean).join(' · ') || '—'}</dd></div><div><dt>Uploaded by</dt><dd>{document?.uploadedBy?.name || 'Teacher'}</dd></div><div><dt>Upload date</dt><dd>{formatDate(document?.uploadedAt || document?.createdAt)}</dd></div><div><dt>File size</dt><dd>{formatSize(document?.fileSize || document?.originalFile?.fileSize)}</dd></div><div><dt>Pages</dt><dd>{document?.pageCount || document?.originalFile?.pageCount || 'Not available'}</dd></div></dl><div className="academic-doc-action-list"><button className="button button-primary" onClick={() => downloadFile()}><Download size={15} />Download original</button>{!isTeacher && isPdf(document) && <><Link className="button button-secondary" to={`${base}/${documentId}/edit`}><FileText size={15} />Manual edit</Link><Link className="button button-secondary" to={`${base}/${documentId}/ai-edit`}><Sparkles size={15} />AI edit with Gemini</Link><button className="button button-secondary" disabled={busy} onClick={() => convert('word')}><BookOpen size={15} />{busy ? 'Converting...' : 'Convert to Word'}</button><button className="button button-secondary" disabled={busy} onClick={() => convert('excel')}><FileText size={15} />{busy ? 'Converting...' : 'Convert to Excel'}</button></>}{!isTeacher && <button className="button button-secondary" onClick={async () => { try { if (navigator.share) await navigator.share({ title: document?.name, url: window.location.href }); else { await navigator.clipboard.writeText(window.location.href); setSuccess('Link copied.'); } } catch { setError('Unable to share this document.'); } }}><Link2 size={15} />Share document</button>}</div></aside></div>
    {fileVersions.length > 0 && <section className="surface academic-doc-versions"><h2>Edited and converted versions</h2>{fileVersions.map((version) => <div key={version._id}><span><strong>{version.fileName}</strong><small>{version.editType} · {formatDate(version.createdAt)}</small>{version.changes?.length > 0 && <small className="academic-doc-version-changes">{version.changes.map((change) => `${change.field}: ${change.oldText || 'Empty'} -> ${change.newText}`).join(' · ')}</small>}</span><div className="table-actions">{version.mimeType === 'application/pdf' && <button className="button button-secondary" onClick={() => previewVersion(version._id)}><Eye size={14} />View</button>}<button className="button button-secondary" onClick={() => downloadFile(version._id)}><Download size={14} />Download</button></div></div>)}</section>}
  </>;
}

export default AcademicDocumentsPage;