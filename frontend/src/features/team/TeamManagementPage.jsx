import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ImagePlus, LoaderCircle, Mail, Pencil, Plus, ShieldCheck, Trash2, Users, X } from 'lucide-react';
import teamService from '../../services/teamService';

const emptyForm = { name: '', title: '', bio: '', email: '', profileUrl: '' };
const allowedPhotoTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const maxPhotoSize = 5 * 1024 * 1024;

function getInitials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'TM';
}

function TeamAvatar({ member, className = 'team-avatar' }) {
  const [photoUnavailable, setPhotoUnavailable] = useState(false);
  const photoUrl = member.profilePhotoId || member.hasPhoto ? teamService.getPhotoUrl(member._id, member.updatedAt) : '';
  return photoUrl && !photoUnavailable
    ? <img className={className} src={photoUrl} alt={`${member.name} profile`} onError={() => setPhotoUnavailable(true)} />
    : <span className={className} aria-hidden="true">{getInitials(member.name)}</span>;
}

function TeamManagementPage() {
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [photoFile, setPhotoFile] = useState(null);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackError, setFeedbackError] = useState(false);
  const photoInputRef = useRef(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const currentMember = members.find((member) => member._id === editingId);
  const currentPhotoUrl = currentMember?.profilePhotoId ? teamService.getPhotoUrl(currentMember._id, currentMember.updatedAt) : '';

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview('');
      return undefined;
    }
    const previewUrl = URL.createObjectURL(photoFile);
    setPhotoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [photoFile]);

  const loadMembers = async () => {
    setLoading(true);
    setPageError('');
    try {
      const response = await teamService.getMembers();
      setMembers(response?.data?.members || []);
    } catch (error) {
      setPageError(error.message || 'Unable to load team members.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setFeedback('');
    setFeedbackError(false);
  };

  const resetForm = () => {
    setForm(emptyForm);
    setPhotoFile(null);
    setEditingId('');
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const startEditing = (member) => {
    setForm({
      name: member.name || '',
      title: member.title || '',
      bio: member.bio || '',
      email: member.email || '',
      profileUrl: member.profileUrl || ''
    });
    setPhotoFile(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
    setEditingId(member._id);
    setFeedback('');
    document.querySelector('.team-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const saveMember = async (event) => {
    event.preventDefault();
    if (!editingId && !photoFile) {
      setFeedback('Please choose a profile photo before adding this team member.');
      setFeedbackError(true);
      return;
    }
    setSaving(true);
    setFeedback('');
    try {
      if (editingId) await teamService.updateMember(editingId, form, photoFile);
      else await teamService.createMember(form, photoFile);
      await loadMembers();
      resetForm();
      setFeedback(editingId ? 'Team member details updated.' : 'Team member added to the public profile.');
      setFeedbackError(false);
    } catch (error) {
      setFeedback(error.message || 'Unable to save this team member.');
      setFeedbackError(true);
    } finally {
      setSaving(false);
    }
  };

  const selectPhoto = (event) => {
    const file = event.target.files?.[0] || null;
    if (file && !allowedPhotoTypes.includes(file.type)) {
      setFeedback('Choose a JPG, PNG or WEBP image.');
      setFeedbackError(true);
      event.target.value = '';
      setPhotoFile(null);
      return;
    }
    if (file && file.size > maxPhotoSize) {
      setFeedback('Choose an image smaller than 5 MB.');
      setFeedbackError(true);
      event.target.value = '';
      setPhotoFile(null);
      return;
    }
    setFeedback('');
    setFeedbackError(false);
    setPhotoFile(file);
  };

  const removeMember = async (member) => {
    if (!window.confirm(`Remove ${member.name} from the public team profile?`)) return;
    setFeedback('');
    try {
      await teamService.deleteMember(member._id);
      setMembers((current) => current.filter((item) => item._id !== member._id));
      if (editingId === member._id) resetForm();
      setFeedback(`${member.name} was removed from the public team profile.`);
      setFeedbackError(false);
    } catch (error) {
      setFeedback(error.message || 'Unable to remove this team member.');
      setFeedbackError(true);
    }
  };

  return <div className="team-admin-page">
    <div className="page-heading">
      <div>
        <p className="eyebrow">PUBLIC PROFILE</p>
        <h1>Team members</h1>
        <p className="page-description">Introduce the people behind the College Practical Portal. Changes appear on the public owner profile.</p>
      </div>
      <span className="team-admin-count"><Users size={16} />{members.length} {members.length === 1 ? 'member' : 'members'}</span>
    </div>

    {pageError && <div className="team-feedback team-feedback-error" role="alert">{pageError}<button type="button" onClick={loadMembers}>Try again</button></div>}
    {feedback && <div className={`team-feedback ${feedbackError ? 'team-feedback-error' : ''}`} role={feedbackError ? 'alert' : 'status'}>{feedback}</div>}

    <div className="team-admin-grid">
      <form className="surface team-editor" onSubmit={saveMember}>
        <div className="team-panel-heading">
          <span className="team-panel-icon"><Plus size={18} /></span>
          <div><p className="eyebrow">{editingId ? 'EDIT PROFILE' : 'ADD TO YOUR TEAM'}</p><h2>{editingId ? 'Update member' : 'New team member'}</h2></div>
          {editingId && <button type="button" className="team-cancel-button" onClick={resetForm} aria-label="Cancel editing"><X size={17} /></button>}
        </div>
        <div className="team-photo-field">
          <div className="team-photo-preview">
            {photoPreview
              ? <img src={photoPreview} alt="Selected team member photo preview" />
              : currentPhotoUrl
                ? <TeamAvatar member={currentMember} className="team-photo-current" />
                : <span className="team-photo-placeholder"><ImagePlus size={22} /><small>{editingId ? 'No photo yet' : 'Photo required'}</small></span>}
          </div>
          <div className="team-photo-copy">
            <strong>Profile photo</strong>
            <span>{photoFile ? photoFile.name : currentPhotoUrl ? 'Choose a new photo to replace the current one.' : 'Add a clear photo. JPG, PNG or WEBP · up to 5 MB.'}</span>
              <button className="team-photo-button" type="button" onClick={() => photoInputRef.current?.click()}><ImagePlus size={14} />{photoFile || currentPhotoUrl ? 'Change photo' : 'Choose photo'}</button>
              <input ref={photoInputRef} className="team-photo-input" type="file" accept="image/jpeg,.jpg,.jpeg,.png,.webp" onChange={selectPhoto} />
          </div>
        </div>
        <label className="form-field"><span>Full name <b>*</b></span><input name="name" value={form.name} onChange={updateField} maxLength={80} autoComplete="name" placeholder="e.g. Aditi Patil" required /></label>
        <label className="form-field"><span>Role or designation <b>*</b></span><input name="title" value={form.title} onChange={updateField} maxLength={80} placeholder="e.g. Product Designer" required /></label>
        <label className="form-field"><span>Short introduction</span><textarea name="bio" value={form.bio} onChange={updateField} maxLength={500} rows={4} placeholder="Share what this person contributes to the portal." /></label>
        <label className="form-field"><span>Email address</span><input name="email" type="email" value={form.email} onChange={updateField} maxLength={254} autoComplete="email" placeholder="name@example.com" /></label>
        <label className="form-field"><span>Professional profile link</span><input name="profileUrl" type="url" value={form.profileUrl} onChange={updateField} maxLength={500} placeholder="https://www.linkedin.com/in/..." /></label>
        <button className="button button-primary team-save-button" type="submit" disabled={saving}>
          {saving ? <LoaderCircle className="team-spinner" size={16} /> : editingId ? <Pencil size={16} /> : <Plus size={16} />}
          {saving ? 'Saving...' : editingId ? 'Save changes' : 'Add team member'}
        </button>
        <p className="team-editor-note"><ShieldCheck size={14} />Team profiles are managed by administrators.</p>
      </form>

      <section className="team-directory" aria-labelledby="team-directory-title">
        <div className="team-panel-heading team-directory-heading">
          <span className="team-panel-icon"><Users size={18} /></span>
          <div><p className="eyebrow">CURRENT TEAM</p><h2 id="team-directory-title">Public profiles</h2></div>
        </div>
        {loading ? <div className="team-loading"><LoaderCircle className="team-spinner" size={20} />Loading team profiles...</div>
          : members.length ? <div className="team-admin-list">{members.map((member) => <article className="team-admin-card" key={member._id}>
          <TeamAvatar member={member} />
            <div className="team-admin-copy"><strong>{member.name}</strong><span>{member.title}</span>{member.email && <a href={`mailto:${member.email}`}><Mail size={13} />{member.email}</a>}{member.profileUrl && <a href={member.profileUrl} target="_blank" rel="noreferrer"><ArrowUpRight size={13} />Professional profile</a>}</div>
            <div className="team-card-actions"><button type="button" onClick={() => startEditing(member)} aria-label={`Edit ${member.name}`} title="Edit"><Pencil size={15} /></button><button type="button" onClick={() => removeMember(member)} aria-label={`Remove ${member.name}`} title="Remove"><Trash2 size={15} /></button></div>
          </article>)}</div>
            : <div className="team-admin-empty"><Users size={25} /><strong>No team profiles yet</strong><span>Add a team member and their profile will appear on the public owner page.</span></div>}
      </section>
    </div>
  </div>;
}

export default TeamManagementPage;
