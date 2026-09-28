import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilePlus2, LoaderCircle, Sparkles, X } from 'lucide-react';
import api from '../../services/api';
import pdfService from '../../services/pdfService';
import teacherService from '../../services/teacherService';
import { getAcademicYearOptions } from '../../utils/academicYear';

const idOf = (value) => String(value?._id || value || '');
const listFields = ['objectives', 'requirements', 'procedure', 'importantPoints', 'commonErrors', 'vivaQuestions'];
const guideFields = [
  ['aim', 'Aim'], ['about', 'About this practical'], ['objectives', 'Objectives'], ['theory', 'Theory'],
  ['requirements', 'Requirements'], ['procedure', 'Procedure'], ['task', 'Task'],
  ['expectedOutput', 'Expected output'], ['importantPoints', 'Important points'],
  ['commonErrors', 'Common errors'], ['vivaQuestions', 'Viva questions']
];

function toEditableList(value) {
  return Array.isArray(value) ? value.join('\n') : value || '';
}

export default function TeacherPracticalModal({ practical, user, notify, onSaved }) {
  const navigate = useNavigate();
  const [savedPractical, setSavedPractical] = useState(practical || null);
  const activePractical = savedPractical || practical;
  const practicalId = idOf(activePractical?._id || activePractical?.id);
  const isEdit = Boolean(practicalId);
  const [catalog, setCatalog] = useState({ departments: [], years: [], semesters: [], subjects: [] });
  const [fields, setFields] = useState({
    departmentId: idOf(practical?.departmentId || user?.departmentId),
    yearId: idOf(practical?.yearId),
    semesterId: idOf(practical?.semesterId),
    subjectId: idOf(practical?.subjectId),
    practicalNumber: practical?.practicalNumber || '',
    title: practical?.title || '',
    aim: practical?.aim || '',
    about: practical?.about || '',
    objectives: toEditableList(practical?.objectives),
    theory: practical?.theory || practical?.concept || '',
    requirements: toEditableList(practical?.requirements),
    procedure: toEditableList(practical?.procedure),
    task: practical?.task || '',
    expectedOutput: practical?.expectedOutput || '',
    importantPoints: toEditableList(practical?.importantPoints),
    commonErrors: toEditableList(practical?.commonErrors),
    vivaQuestions: toEditableList(practical?.vivaQuestions)
  });
  const [file, setFile] = useState(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [analysisPending, setAnalysisPending] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get('/departments'),
      api.get('/years'),
      api.get('/semesters'),
      teacherService.getSubjects()
    ]).then(([departments, years, semesters, subjects]) => {
      if (!active) return;
      setCatalog({
        departments: departments?.data?.departments || [],
        years: getAcademicYearOptions(years?.data?.years || []),
        semesters: semesters?.data?.semesters || [],
        subjects: subjects?.data?.subjects || []
      });
    }).catch((loadError) => {
      if (active) setError(loadError.message || 'Could not load academic options.');
    }).finally(() => {
      if (active) setLoadingCatalog(false);
    });
    return () => { active = false; };
  }, []);

  const semesters = catalog.semesters
    .filter((item) => idOf(item.yearId) === fields.yearId)
    .sort((left, right) => Number(left.number) - Number(right.number));
  const subjects = catalog.subjects.filter((item) =>
    idOf(item.departmentId) === fields.departmentId &&
    idOf(item.yearId) === fields.yearId &&
    idOf(item.semesterId) === fields.semesterId
  );
  const update = (key) => (event) => setFields((current) => ({ ...current, [key]: event.target.value }));

  const save = async (event) => {
    event.preventDefault();
    setError('');
    if (!fields.departmentId || !fields.yearId || !fields.semesterId || !fields.subjectId || !fields.title.trim() || !Number(fields.practicalNumber)) {
      setError('Complete the department, year, semester, subject, practical number and title.');
      return;
    }
    if (!activePractical && !file) {
      setError('Upload the original practical PDF before saving.');
      return;
    }
    if (file && !activePractical?.pdfId) {
      if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
        setError('Choose a valid PDF file.');
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        setError('PDF files must be 25 MB or smaller.');
        return;
      }
    }

    setSaving(true);
    let currentPractical = activePractical;
    let shouldAnalyze = analysisPending;
    try {
      const mapping = {
        departmentId: fields.departmentId,
        yearId: fields.yearId,
        semesterId: fields.semesterId,
        subjectId: fields.subjectId,
        practicalNumber: Number(fields.practicalNumber),
        title: fields.title.trim()
      };
      if (currentPractical) {
        const guide = { ...fields };
        for (const key of listFields) guide[key] = guide[key].split('\n').map((line) => line.trim()).filter(Boolean);
        const response = await teacherService.updatePractical(practicalId, { ...mapping, ...guide });
        currentPractical = response?.data?.practical || currentPractical;
        setSavedPractical(currentPractical);
      } else {
        const response = await teacherService.createPractical(mapping);
        currentPractical = response?.data?.practical;
        if (!currentPractical?._id) throw new Error('The backend did not return the saved practical.');
        setSavedPractical(currentPractical);
        setAnalysisPending(true);
        shouldAnalyze = true;
      }

      if (file && !currentPractical?.pdfId) {
        const uploadResponse = await pdfService.upload(file, currentPractical._id);
        currentPractical = { ...currentPractical, pdfId: uploadResponse?.data?.pdfId };
        setSavedPractical(currentPractical);
        setFile(null);
        setAnalysisPending(true);
        shouldAnalyze = true;
      }
      if (currentPractical?.pdfId && shouldAnalyze) {
        const analysisResponse = await teacherService.analyzePractical(currentPractical._id);
        currentPractical = analysisResponse?.data?.practical || currentPractical;
        setSavedPractical(currentPractical);
        setAnalysisPending(false);
      }

      onSaved().catch(() => {
        notify('Practical saved, but the list could not refresh. Reload the practicals page to see the latest data.');
      });
      notify(isEdit ? 'Practical saved to MongoDB.' : 'Practical saved with its original PDF. AI guidance is ready for review.');
      navigate('/teacher/practicals');
    } catch (saveError) {
      if (currentPractical?._id) onSaved().catch(() => undefined);
      setError(saveError.message || 'Could not save this practical.');
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    if (!saving) navigate('/teacher/practicals');
  };

  return <div className="practical-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section className="practical-modal" role="dialog" aria-modal="true" aria-labelledby="practical-modal-title">
      <header className="practical-modal-header">
        <div><p className="eyebrow">TEACHER WORKSPACE</p><h1 id="practical-modal-title">{isEdit ? 'Edit practical' : 'Add practical'}</h1></div>
        <button className="icon-button" type="button" onClick={close} aria-label="Close practical form"><X size={18} /></button>
      </header>
      <form onSubmit={save} className="practical-modal-form">
        <div className="form-grid">
          <label className="form-field"><span>Department</span><select required value={fields.departmentId} onChange={(event) => setFields((current) => ({ ...current, departmentId: event.target.value, subjectId: '' }))} disabled={loadingCatalog}><option value="">Select department</option>{catalog.departments.map((item) => <option key={idOf(item)} value={idOf(item)}>{item.name}</option>)}</select></label>
          <label className="form-field"><span>Year</span><select required value={fields.yearId} onChange={(event) => setFields((current) => ({ ...current, yearId: event.target.value, semesterId: '', subjectId: '' }))} disabled={loadingCatalog}><option value="">Select year</option>{catalog.years.map((item) => <option key={idOf(item)} value={idOf(item)}>{item.name}</option>)}</select></label>
          <label className="form-field"><span>Semester</span><select required value={fields.semesterId} onChange={(event) => setFields((current) => ({ ...current, semesterId: event.target.value, subjectId: '' }))} disabled={loadingCatalog || !fields.yearId}><option value="">Select semester</option>{semesters.map((item) => <option key={idOf(item)} value={idOf(item)}>Semester {item.number}</option>)}</select></label>
          <label className="form-field"><span>Subject</span><select required value={fields.subjectId} onChange={update('subjectId')} disabled={loadingCatalog || !fields.semesterId}><option value="">Select subject</option>{subjects.map((item) => <option key={idOf(item)} value={idOf(item)}>{item.name}</option>)}</select></label>
          <label className="form-field"><span>Practical number</span><input required type="number" min="1" step="1" value={fields.practicalNumber} onChange={update('practicalNumber')} /></label>
          <label className="form-field"><span>Practical title</span><input required value={fields.title} onChange={update('title')} placeholder="e.g. Introduction to Java" /></label>
        </div>

        {(!activePractical?.pdfId || file) && <label className="practical-upload-field">
          <input type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          <FilePlus2 size={20} />
          <span><strong>{file?.name || 'Choose original PDF'}</strong><small>Stored unchanged in MongoDB GridFS · maximum 25 MB</small></span>
        </label>}
        {activePractical?.pdfId && <p className="practical-pdf-attached">Original PDF is attached and preserved.</p>}

        {isEdit && <details className="practical-review-fields" open>
          <summary><Sparkles size={16} /> AI-generated details · teacher review</summary>
          <div className="form-grid">{guideFields.map(([key, label]) => <label className="form-field form-field-wide" key={key}><span>{label}</span><textarea rows={key === 'procedure' ? 5 : 3} value={fields[key]} onChange={update(key)} /></label>)}</div>
        </details>}

        {error && <p className="form-alert form-alert-error" role="alert">{error}</p>}
        <footer className="practical-modal-actions"><button className="button button-secondary" type="button" onClick={close} disabled={saving}>Cancel</button><button className="button button-primary" type="submit" disabled={saving || loadingCatalog}>{saving ? <><LoaderCircle size={16} className="spin" />Saving to MongoDB...</> : isEdit ? 'Save changes' : 'Create practical'}</button></footer>
      </form>
    </section>
  </div>;
}