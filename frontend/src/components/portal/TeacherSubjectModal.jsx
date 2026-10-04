import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import api from '../../services/api';
import teacherService from '../../services/teacherService';
import { getAcademicYearOptions } from '../../utils/academicYear';

const idOf = (value) => String(value?._id || value || '');
const emptyFields = { subjectId: '', name: '', subjectCode: '', description: '', departmentId: '', yearId: '', semesterId: '' };

export default function TeacherSubjectModal({ onClose, onSaved, notify }) {
  const [mode, setMode] = useState('existing');
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [catalog, setCatalog] = useState({ departments: [], years: [], semesters: [] });
  const [fields, setFields] = useState(emptyFields);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      teacherService.getAvailableSubjects(),
      api.get('/departments'),
      api.get('/years'),
      api.get('/semesters')
    ]).then(([subjectsResponse, departmentsResponse, yearsResponse, semestersResponse]) => {
      if (!active) return;
      const subjects = (subjectsResponse?.data?.subjects || []).map((subject) => ({
        ...subject,
        id: idOf(subject),
        departmentName: subject.departmentId?.name || '',
        yearName: subject.yearId?.name || '',
        semesterName: subject.semesterId?.name || ''
      }));
      setAvailableSubjects(subjects);
      setFields((current) => ({ ...current, subjectId: subjects[0]?.id || '' }));
      setCatalog({
        departments: departmentsResponse?.data?.departments || [],
        years: getAcademicYearOptions(yearsResponse?.data?.years || []),
        semesters: semestersResponse?.data?.semesters || []
      });
    }).catch((loadError) => {
      if (active) setError(loadError.message || 'Unable to load subject options.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const semesters = catalog.semesters.filter((item) => idOf(item.yearId) === fields.yearId);
  const update = (key) => (event) => setFields((current) => ({
    ...current,
    [key]: event.target.value,
    ...(key === 'yearId' ? { semesterId: '' } : {})
  }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (mode === 'existing') {
        if (!fields.subjectId) throw new Error('Select a subject to add.');
        await teacherService.assignSubject(fields.subjectId);
        await onSaved();
        notify('Subject added to your teaching assignments.');
      } else {
        await teacherService.createSubject({
          name: fields.name.trim(),
          subjectCode: fields.subjectCode.trim(),
          description: fields.description.trim(),
          departmentId: fields.departmentId,
          yearId: fields.yearId,
          semesterId: fields.semesterId
        });
        await onSaved();
        notify('Subject created and added to your teaching assignments.');
      }
      onClose();
    } catch (saveError) {
      setError(saveError.message || 'Unable to save this subject.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="teacher-subject-modal-title" className="admin-modal">
      <div className="admin-modal-header">
        <div><p className="eyebrow">TEACHING ASSIGNMENT</p><h2 id="teacher-subject-modal-title">Add a subject</h2></div>
        <button className="icon-button" type="button" aria-label="Close add subject dialog" disabled={saving} onClick={onClose}><X size={17} /></button>
      </div>
      <div className="segmented-control" aria-label="Subject option">
        <button type="button" className={mode === 'existing' ? 'selected' : ''} onClick={() => { setMode('existing'); setError(''); }}>Add existing</button>
        <button type="button" className={mode === 'create' ? 'selected' : ''} onClick={() => { setMode('create'); setError(''); }}>Create new</button>
      </div>
      <form onSubmit={submit} className="admin-modal-form">
        <p className="muted-inline admin-modal-field-wide">{mode === 'existing' ? 'Choose a subject already in the active curriculum.' : 'Create a subject for a department, year and semester. It will be added to your teaching assignments.'}</p>
        {loading ? <p className="muted-inline admin-modal-field-wide" role="status">Loading academic options...</p> : mode === 'existing' ? availableSubjects.length ? <label className="form-field admin-modal-field-wide"><span>Subject · Department · Year · Semester</span><select required value={fields.subjectId} onChange={update('subjectId')}><option value="">Select a subject</option>{availableSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name} · {subject.departmentName || 'Department'} · {subject.yearName || 'Year'} · {subject.semesterName || 'Semester'}</option>)}</select></label> : <p className="muted-inline admin-modal-field-wide">All active subjects outside your department are already assigned. To add another subject, choose “Create new”.</p> : <>
          <label className="form-field"><span>Subject name</span><input required maxLength="120" value={fields.name} onChange={update('name')} placeholder="e.g. Data Structures" /></label>
          <label className="form-field"><span>Subject code <small>(optional)</small></span><input maxLength="30" value={fields.subjectCode} onChange={update('subjectCode')} placeholder="e.g. CS301" /></label>
          <label className="form-field admin-modal-field-wide"><span>Description <small>(optional)</small></span><textarea rows="2" maxLength="1000" value={fields.description} onChange={update('description')} placeholder="Briefly describe the subject" /></label>
          <label className="form-field"><span>Department</span><select required value={fields.departmentId} onChange={update('departmentId')}><option value="">Select department</option>{catalog.departments.map((item) => <option key={idOf(item)} value={idOf(item)}>{item.name}</option>)}</select></label>
          <label className="form-field"><span>Year</span><select required value={fields.yearId} onChange={update('yearId')}><option value="">Select year</option>{catalog.years.map((item) => <option key={idOf(item)} value={idOf(item)}>{item.name}</option>)}</select></label>
          <label className="form-field admin-modal-field-wide"><span>Semester</span><select required value={fields.semesterId} onChange={update('semesterId')} disabled={!fields.yearId}><option value="">Select semester</option>{semesters.map((item) => <option key={idOf(item)} value={idOf(item)}>{item.name}</option>)}</select></label>
        </>}
        {error && <p className="admin-modal-error" role="alert">{error}</p>}
        <div className="admin-modal-actions"><button type="button" className="button button-secondary" disabled={saving} onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={saving || loading || (mode === 'existing' && !availableSubjects.length) || (mode === 'create' && !catalog.departments.length)}>{saving ? 'Saving...' : mode === 'existing' ? 'Add subject' : 'Create subject'}</button></div>
      </form>
    </section>
  </div>;
}
