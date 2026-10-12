import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import departmentService from '../../services/departmentService';
import programService from '../../services/programService';

const emptyProgram = {
  name: '',
  level: 'undergraduate',
  status: 'active',
  durationYears: '',
  semestersPerYear: '',
  academicStructureSource: '',
  academicStructureVerified: false,
  verificationStatus: 'pending-prospectus',
  officialSourceUrl: '',
  officialSourceTitle: ''
};

const emptyBranch = {
  programId: '',
  branchName: '',
  description: '',
  status: 'active',
  verificationStatus: 'pending-prospectus',
  officialSourceUrl: '',
  officialSourceTitle: ''
};

const referenceId = (value) => String(value?._id || value || '');

function CatalogModal({ title, children, onClose, onSubmit, saving, error }) {
  return <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="catalog-modal-title" className="admin-modal">
      <div className="admin-modal-header">
        <div><p className="eyebrow">TGPCET COURSE CATALOG</p><h2 id="catalog-modal-title">{title}</h2></div>
        <button className="icon-button" type="button" aria-label="Close form" disabled={saving} onClick={onClose}><X size={17} /></button>
      </div>
      <form className="admin-modal-form" onSubmit={onSubmit}>
        {children}
        {error && <p className="form-alert form-alert-error" role="alert">{error}</p>}
        <div className="admin-modal-actions">
          <button type="button" className="button button-secondary" disabled={saving} onClick={onClose}>Cancel</button>
          <button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
        </div>
      </form>
    </section>
  </div>;
}

function CourseManagementPage({ notify }) {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [programEditor, setProgramEditor] = useState(null);
  const [branchEditor, setBranchEditor] = useState(null);
  const [programFields, setProgramFields] = useState(emptyProgram);
  const [branchFields, setBranchFields] = useState(emptyBranch);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadCatalog = async () => {
    setLoadError('');
    const response = await programService.getAll({ status: 'all' });
    setPrograms(response?.data?.programs || []);
  };

  useEffect(() => {
    let active = true;
    programService.getAll({ status: 'all' })
      .then((response) => { if (active) setPrograms(response?.data?.programs || []); })
      .catch((error) => { if (active) setLoadError(error.message || 'Unable to load course catalog.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visiblePrograms = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return programs.filter((program) => {
      if (levelFilter !== 'all' && program.level !== levelFilter) return false;
      if (!normalizedQuery) return true;
      return `${program.name} ${program.branches.map((branch) => branch.branchName || branch.name).join(' ')}`.toLowerCase().includes(normalizedQuery);
    });
  }, [programs, query, levelFilter]);

  const openProgramEditor = (program = null) => {
    setProgramEditor(program);
    setProgramFields(program ? {
      name: program.name || '',
      level: program.level || 'undergraduate',
      status: program.status || 'active',
      durationYears: program.durationYears ?? '',
      semestersPerYear: program.semestersPerYear ?? '',
      academicStructureSource: program.academicStructureSource || '',
      academicStructureVerified: Boolean(program.academicStructureVerified),
      verificationStatus: program.verificationStatus || 'pending-prospectus',
      officialSourceUrl: program.officialSourceUrl || '',
      officialSourceTitle: program.officialSourceTitle || ''
    } : emptyProgram);
    setFormError('');
  };

  const openBranchEditor = (program, branch = null) => {
    setBranchEditor({ program, branch });
    setBranchFields(branch ? {
      programId: referenceId(branch.programId) || String(program._id),
      branchName: branch.branchName || branch.name?.replace(`${program.name} - `, '') || '',
      description: branch.description || '',
      status: branch.status || 'active',
      verificationStatus: branch.verificationStatus || 'pending-prospectus',
      officialSourceUrl: branch.officialSourceUrl || '',
      officialSourceTitle: branch.officialSourceTitle || ''
    } : { ...emptyBranch, programId: String(program._id) });
    setFormError('');
  };

  const saveProgram = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!programFields.name.trim()) return setFormError('Course name is required.');
    if (programFields.academicStructureVerified && (!programFields.durationYears || !programFields.semestersPerYear || !/^https?:\/\/\S+$/i.test(programFields.academicStructureSource.trim()))) {
      return setFormError('Add a verified duration, semesters per year, and an official regulation URL.');
    }
    if (programFields.verificationStatus === 'prospectus-verified' && !programFields.officialSourceUrl.trim()) {
      return setFormError('A prospectus source URL is required before marking this course verified.');
    }
    setSaving(true);
    const payload = {
      ...programFields,
      name: programFields.name.trim(),
      durationYears: programFields.durationYears === '' ? null : Number(programFields.durationYears),
      semestersPerYear: programFields.semestersPerYear === '' ? null : Number(programFields.semestersPerYear)
    };
    try {
      if (programEditor) await programService.update(programEditor._id, payload);
      else await programService.create(payload);
      await loadCatalog();
      setProgramEditor(null);
      notify(`Course ${programEditor ? 'updated' : 'added'} successfully.`);
    } catch (error) {
      setFormError(error.message || 'Unable to save course.');
    } finally {
      setSaving(false);
    }
  };

  const saveBranch = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!branchFields.programId || !branchFields.branchName.trim()) return setFormError('Course and branch name are required.');
    setSaving(true);
    const selectedProgram = programs.find((program) => String(program._id) === branchFields.programId);
    if (!selectedProgram) {
      setFormError('Select a valid course.');
      setSaving(false);
      return;
    }
    const payload = {
      name: `${selectedProgram.name} - ${branchFields.branchName.trim()}`,
      branchName: branchFields.branchName.trim(),
      programId: branchFields.programId,
      description: branchFields.description.trim(),
      status: branchFields.status,
      verificationStatus: branchFields.verificationStatus,
      officialSourceUrl: branchFields.officialSourceUrl.trim(),
      officialSourceTitle: branchFields.officialSourceTitle.trim()
    };
    try {
      if (branchEditor.branch) await departmentService.update(branchEditor.branch._id, payload);
      else await departmentService.create(payload);
      await loadCatalog();
      setBranchEditor(null);
      notify(`Branch ${branchEditor.branch ? 'updated' : 'added'} successfully.`);
    } catch (error) {
      setFormError(error.message || 'Unable to save branch.');
    } finally {
      setSaving(false);
    }
  };

  const toggleBranchStatus = async (branch) => {
    try {
      await departmentService.update(branch._id, {
        status: branch.status === 'active' ? 'inactive' : 'active',
        isActive: branch.status !== 'active'
      });
      await loadCatalog();
      notify(`Branch ${branch.status === 'active' ? 'deactivated' : 'activated'}.`);
    } catch (error) {
      notify(error.message || 'Unable to change branch status.');
    }
  };

  const deleteBranch = async (branch) => {
    if (!window.confirm(`Delete ${branch.branchName || branch.name}? Linked students or academic records will prevent deletion.`)) return;
    try {
      await departmentService.remove(branch._id);
      await loadCatalog();
      notify('Branch deleted.');
    } catch (error) {
      notify(error.message || 'Unable to delete branch. Deactivate it instead.');
    }
  };

  const changeProgramStatus = async (program) => {
    try {
      await programService.update(program._id, { ...program, status: program.status === 'active' ? 'inactive' : 'active' });
      await loadCatalog();
      notify(`Course ${program.status === 'active' ? 'deactivated' : 'activated'}.`);
    } catch (error) {
      notify(error.message || 'Unable to change course status.');
    }
  };

  const deleteProgram = async (program) => {
    if (!window.confirm(`Delete ${program.name}? A course with branches cannot be deleted.`)) return;
    try {
      await programService.remove(program._id);
      await loadCatalog();
      notify('Course deleted.');
    } catch (error) {
      notify(error.message || 'Unable to delete course. Deactivate it instead.');
    }
  };

  return <>
    <div className="page-heading">
      <div><p className="eyebrow">ACADEMIC STRUCTURE</p><h1>Courses &amp; branches</h1><p className="page-description">Manage TGPCET course categories, branch availability, academic structures, and verification sources.</p></div>
      <div className="heading-actions"><button className="button button-primary" onClick={() => openProgramEditor()}><Plus size={16} /> Add course</button></div>
    </div>
    <div className="surface catalog-verification-note">
      Initial year and semester mappings are configured separately for each course so registration can continue. They remain pending official academic-regulation verification; administrators can review and update them from each course.
    </div>
    {loadError && <p className="form-alert form-alert-error" role="alert">{loadError} <button className="text-link" onClick={() => loadCatalog()}>Retry</button></p>}
    <div className="table-toolbar">
      <label className="field-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search courses and branches" /></label>
      <select aria-label="Filter by course level" value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}>
        <option value="all">All course levels</option><option value="undergraduate">Undergraduate</option><option value="postgraduate">Postgraduate</option><option value="diploma">Diploma</option>
      </select>
      <span className="muted-inline">{visiblePrograms.length} courses</span>
    </div>
    {loading ? <div className="surface" style={{ padding: 24 }}>Loading courses and branches…</div> : visiblePrograms.length ? visiblePrograms.map((program) => <section className="surface dashboard-panel" key={program._id} style={{ marginBottom: 18 }}>
      <div className="panel-heading">
        <div><p className="eyebrow">{program.level} · {program.verificationStatus === 'prospectus-verified' ? 'Prospectus verified' : 'Prospectus verification pending'}</p><h2>{program.name}</h2>
          <small>{program.durationYears && program.semestersPerYear
            ? `${program.durationYears} years · ${program.semestersPerYear} semesters per year · ${program.academicStructureVerified ? 'regulations verified' : 'academic structure pending verification'}`
            : 'Academic structure not configured'} · {program.branches.length} branches</small>
        </div>
        <div className="table-actions">
          <button className="icon-button" title="Edit course" onClick={() => openProgramEditor(program)}><Pencil size={15} /></button>
          <button className="button button-secondary" onClick={() => changeProgramStatus(program)}>{program.status === 'active' ? 'Deactivate course' : 'Activate course'}</button>
          <button className="icon-button danger-action" title="Delete course" onClick={() => deleteProgram(program)}><Trash2 size={15} /></button>
          <button className="button button-secondary" onClick={() => openBranchEditor(program)}><Plus size={15} /> Add branch</button>
        </div>
      </div>
      <div className="program-structure-panel">
        <div className="program-structure-heading"><strong>Academic years &amp; semesters</strong><span>{program.years?.length || 0} years configured</span></div>
        {program.years?.length
          ? <div className="program-year-list">{program.years.map((year) => <div className="program-year-row" key={year._id}>
            <strong>{year.name}</strong>
            <div className="program-semester-list">{year.semesters?.length
              ? year.semesters.map((semester) => <span key={semester._id}>{semester.name}</span>)
              : <span className="program-empty-semesters">No semesters configured</span>}</div>
          </div>)}</div>
          : <p className="program-empty-years">Set the course duration and semesters per year using Edit course to generate its academic structure.</p>}
      </div>
      <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Branch / department</th><th>Status</th><th>Prospectus verification</th><th>Students</th><th>Subjects</th><th>Official source</th><th>Actions</th></tr></thead>
        <tbody>{program.branches.map((branch) => <tr key={branch._id}>
          <td><strong>{branch.branchName || branch.name}</strong></td>
          <td><span className={`status status-${branch.status || 'active'}`}><i />{branch.status || 'active'}</span></td>
          <td>{branch.verificationStatus === 'prospectus-verified' ? 'Verified' : 'Pending'}</td>
          <td>{branch.enrollmentCount || 0}</td><td>{branch.subjectCount || 0}</td>
          <td>{branch.officialSourceUrl ? <a href={branch.officialSourceUrl} target="_blank" rel="noreferrer">View source</a> : 'Not recorded'}</td>
          <td><div className="table-actions"><button className="icon-button" title="Edit branch" onClick={() => openBranchEditor(program, branch)}><Pencil size={15} /></button><button className="button button-quiet" onClick={() => toggleBranchStatus(branch)}>{branch.status === 'active' ? 'Deactivate' : 'Activate'}</button><button className="icon-button danger-action" title="Delete branch" disabled={branch.enrollmentCount > 0 || branch.subjectCount > 0} onClick={() => deleteBranch(branch)}><Trash2 size={15} /></button></div></td>
        </tr>)}</tbody>
      </table>{!program.branches.length && <p className="muted-inline" style={{ padding: 16 }}>No branches are configured for this course.</p>}</div>
    </section>) : <div className="surface" style={{ padding: 24 }}>No courses match the current filters.</div>}

    {programEditor && <CatalogModal title={programEditor._id ? `Edit ${programEditor.name}` : 'Add course'} onClose={() => setProgramEditor(null)} onSubmit={saveProgram} saving={saving} error={formError}>
      <label className="form-field"><span>Course name</span><input required value={programFields.name} onChange={(event) => setProgramFields({ ...programFields, name: event.target.value })} /></label>
      <label className="form-field"><span>Course level</span><select value={programFields.level} onChange={(event) => setProgramFields({ ...programFields, level: event.target.value })}><option value="undergraduate">Undergraduate</option><option value="postgraduate">Postgraduate</option><option value="diploma">Diploma</option></select></label>
      <label className="form-field"><span>Status</span><select value={programFields.status} onChange={(event) => setProgramFields({ ...programFields, status: event.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
      <label className="form-field"><span>Duration (years)</span><input type="number" min="1" max="8" value={programFields.durationYears} onChange={(event) => setProgramFields({ ...programFields, durationYears: event.target.value })} /></label>
      <label className="form-field"><span>Semesters per year</span><input type="number" min="1" max="4" value={programFields.semestersPerYear} onChange={(event) => setProgramFields({ ...programFields, semestersPerYear: event.target.value })} /></label>
      <label className="form-field"><span>Academic structure verification</span><select value={programFields.academicStructureVerified ? 'verified' : 'pending'} onChange={(event) => setProgramFields({ ...programFields, academicStructureVerified: event.target.value === 'verified' })}><option value="pending">Not verified</option><option value="verified">Verified from official regulation</option></select></label>
      <label className="form-field admin-modal-field-wide"><span>Academic regulation source URL</span><input value={programFields.academicStructureSource} onChange={(event) => setProgramFields({ ...programFields, academicStructureSource: event.target.value })} placeholder="Official university / college regulation URL" /></label>
      <label className="form-field"><span>Prospectus verification</span><select value={programFields.verificationStatus} onChange={(event) => setProgramFields({ ...programFields, verificationStatus: event.target.value })}><option value="pending-prospectus">Pending prospectus verification</option><option value="prospectus-verified">Verified against prospectus</option></select></label>
      <label className="form-field"><span>Official source title</span><input value={programFields.officialSourceTitle} onChange={(event) => setProgramFields({ ...programFields, officialSourceTitle: event.target.value })} /></label>
      <label className="form-field admin-modal-field-wide"><span>Official source URL</span><input value={programFields.officialSourceUrl} onChange={(event) => setProgramFields({ ...programFields, officialSourceUrl: event.target.value })} /></label>
    </CatalogModal>}

    {branchEditor && <CatalogModal title={branchEditor.branch ? 'Edit branch' : `Add branch to ${branchEditor.program.name}`} onClose={() => setBranchEditor(null)} onSubmit={saveBranch} saving={saving} error={formError}>
      <label className="form-field"><span>Course</span><select required value={branchFields.programId} onChange={(event) => setBranchFields({ ...branchFields, programId: event.target.value })}>{programs.map((program) => <option key={program._id} value={program._id}>{program.name}</option>)}</select></label>
      <label className="form-field"><span>Branch / department name</span><input required value={branchFields.branchName} onChange={(event) => setBranchFields({ ...branchFields, branchName: event.target.value })} /></label>
      <label className="form-field"><span>Status</span><select value={branchFields.status} onChange={(event) => setBranchFields({ ...branchFields, status: event.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
      <label className="form-field"><span>Prospectus verification</span><select value={branchFields.verificationStatus} onChange={(event) => setBranchFields({ ...branchFields, verificationStatus: event.target.value })}><option value="pending-prospectus">Pending prospectus verification</option><option value="prospectus-verified">Verified against prospectus</option></select></label>
      <label className="form-field admin-modal-field-wide"><span>Description</span><textarea rows="2" value={branchFields.description} onChange={(event) => setBranchFields({ ...branchFields, description: event.target.value })} /></label>
      <label className="form-field"><span>Official source title</span><input value={branchFields.officialSourceTitle} onChange={(event) => setBranchFields({ ...branchFields, officialSourceTitle: event.target.value })} /></label>
      <label className="form-field admin-modal-field-wide"><span>Official source URL</span><input value={branchFields.officialSourceUrl} onChange={(event) => setBranchFields({ ...branchFields, officialSourceUrl: event.target.value })} /></label>
    </CatalogModal>}
  </>;
}

export default CourseManagementPage;
