import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, ArrowDownToLine, ArrowLeft, ArrowRight, Bell, BookOpen, Bookmark, Database, Eye, EyeOff, HardDrive,
  Building2, Check, CheckCircle2, ChevronDown, ChevronRight, ClipboardList,
  Clock3, Download, ExternalLink, FilePlus2, FileText, Filter, GraduationCap, LayoutDashboard,
  Notebook,  LoaderCircle, LogOut, Menu, MoreHorizontal, Pencil, Plus, Search, Settings, ShieldCheck,
  Folder, FolderOpen, FolderPlus, Instagram, Link2, Maximize2, Minimize2, RefreshCw, Save, Sparkles, Trash2, Upload, Users, X
} from 'lucide-react';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useAuth } from '../../context/AuthContext';
import { notifications } from '../../data/portalData';
import api, { API_BASE_URL } from '../../services/api';
import departmentService from '../../services/departmentService';
import yearService from '../../services/yearService';
import semesterService from '../../services/semesterService';
import subjectService from '../../services/subjectService';
import teacherService from '../../services/teacherService';
import studentService from '../../services/studentService';
import pdfService from '../../services/pdfService';
import AcademicDocumentsPage from '../../features/academicDocuments/AcademicDocumentsPage';
import TeamManagementPage from '../../features/team/TeamManagementPage';
import progressService from '../../services/progressService';
import bookmarkService from '../../services/bookmarkService';
import notificationService from '../../services/notificationService';
import submissionService from '../../services/submissionService';
import evaluationService from '../../services/evaluationService';
import TeacherPracticalModal from './TeacherPracticalModal';
import TeacherSubjectModal from './TeacherSubjectModal';
import WorkspaceLoading from '../common/WorkspaceLoading';
import ThemeToggle from '../common/ThemeToggle';
import StudentPlanner from './StudentPlanner';

const MyraaIntegrated = lazy(() => import('../../features/myraa/MyraaIntegrated'));
const roleHome = { admin: '/admin/dashboard', teacher: '/teacher/dashboard', student: '/student/dashboard' };
const roleNames = { admin: 'Administrator', teacher: 'Teacher', student: 'Student' };
const number = (value) => String(value).padStart(2, '0');

const getNoteFolderSegments = (note) => Array.isArray(note.folderPathSegments) && note.folderPathSegments.length
  ? note.folderPathSegments
  : String(note.folderPath || '').split('/').filter(Boolean);

function Button({ children, variant = 'primary', icon: Icon, className = '', ...props }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{Icon && <Icon size={16} strokeWidth={1.8} />}{children}</button>;
}

function PageHeading({ eyebrow, title, description, actions }) {
  return <div className="page-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{actions && <div className="heading-actions">{actions}</div>}</div>;
}

function Stat({ label, value, note, icon: Icon, tone = 'blue' }) {
  return <div className="stat-card"><span className={`stat-icon tone-${tone}`}><Icon size={18} /></span><div><p className="stat-label">{label}</p><strong>{value}</strong>{note && <p className="stat-note">{note}</p>}</div></div>;
}

function Status({ children }) {
  const value = String(children || '').toLowerCase();
  return <span className={`status status-${value.replaceAll(' ', '-')}`}><i />{children}</span>;
}

function EmptyState({ title, text, icon: Icon = BookOpen, action }) {
  return <div className="empty-state"><span><Icon size={23} /></span><h3>{title}</h3><p>{text}</p>{action}</div>;
}

function SubjectTile({ subject, items, completedCount = 0 }) {
  const total = items.length || subject.practicalCount;
  const progress = total ? Math.round((completedCount / total) * 100) : 0;
  return <article className="subject-tile">
    <div className="tile-top"><span className="subject-monogram">{subject.name.slice(0, 2).toUpperCase()}</span><span className="tile-code">{subject.code}</span></div>
    <h3>{subject.name}</h3><p>{subject.description}</p>
    <div className="progress-meta"><span>{completedCount} of {total} completed</span><span>{progress}%</span></div>
    <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
    <div className="tile-footer"><span><ClipboardList size={15} /> {total} practicals</span><Link className="text-link" to={`/student/subjects/${subject.id}`}>Open subject <ArrowRight size={15} /></Link></div>
  </article>;
}

function PracticalRow({ practical, subject, onOpen, completed = false, submissionStatus }) {
  return <div className="practical-row"><span className="row-number">{number(practical.practicalNumber)}</span><div className="row-main"><strong>{practical.title}</strong><span>{subject?.name || 'Course practical'}</span></div><Status>{submissionStatus || (completed ? 'Completed' : 'Available')}</Status><Button variant="quiet" onClick={() => onOpen(practical)} aria-label={`View ${practical.title}`}>View <ChevronRight size={15} /></Button></div>;
}

function recordId(value) {
  return String(value?._id || value?.id || value || '');
}

function latestSubmissionFor(submissions, practicalId) {
  return (submissions || [])
    .filter((submission) => recordId(submission.practicalId) === String(practicalId))
    .sort((first, second) => Number(second.attempt || 0) - Number(first.attempt || 0))[0];
}

async function downloadSubmissionFile(submission) {
  const file = await submissionService.getFile(recordId(submission));
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = submission.submissionFile?.originalFileName || 'practical-submission.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getInitials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'U';
}

function useProfilePhoto(user) {
  const [photoUrl, setPhotoUrl] = useState('');

  useEffect(() => {
    let objectUrl = '';

    const load = async () => {
      if (!user?.profilePhotoId) {
        setPhotoUrl('');
        return;
      }

      try {
        const blob = await studentService.getProfilePhoto();
        objectUrl = URL.createObjectURL(blob);
        setPhotoUrl(objectUrl);
      } catch {
        setPhotoUrl('');
      }
    };

    load();

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [user?._id, user?.profilePhotoId]);

  return photoUrl;
}

function ProfileAvatar({ name, photoUrl, size = 'md' }) {
  const variantClass = size === 'lg' ? 'avatar-large' : size === 'sm' ? 'avatar-small' : '';
  return (
    <span className={`avatar ${variantClass}`.trim()}>
      {photoUrl ? <img src={photoUrl} alt={name || 'Profile'} /> : getInitials(name)}
    </span>
  );
}

function DashboardShell({ role, children, search, setSearch, notificationOpen, setNotificationOpen, mobileOpen, setMobileOpen, onLogout, user, searchSubjects = [], searchPracticals = [], notificationItems = [], onNotificationRead }) {
  const roleNav = {
    student: [
      ['Overview', '/student/dashboard', LayoutDashboard], ['My subjects', '/student/subjects', BookOpen],
      ['Practicals', '/student/practicals', ClipboardList], ['Bookmarks', '/student/bookmarks', Bookmark],
      ['Notes', '/student/notes', Notebook], ['Academic Documents', '/student/academic-documents', FileText],
      ['Myraa assistant', '/student/myraa', Sparkles], ['Profile', '/student/profile', Users]
    ],
    teacher: [
      ['Overview', '/teacher/dashboard', LayoutDashboard], ['My subjects', '/teacher/subjects', BookOpen],
      ['Practicals', '/teacher/practicals', ClipboardList], ['Add practical', '/teacher/practicals/add', FilePlus2],
      ['Academic Documents', '/teacher/academic-documents', FileText],
      ['Students', '/teacher/students', Users], ['Profile', '/teacher/profile', Users]
    ],
    admin: [
      ['Overview', '/admin/dashboard', LayoutDashboard], ['Departments', '/admin/departments', Building2],
      ['Years', '/admin/years', GraduationCap], ['Semesters', '/admin/semesters', Activity],
      ['Subjects', '/admin/subjects', BookOpen], ['Teachers', '/admin/teachers', Users],
      ['Students', '/admin/students', Users], ['Practicals', '/admin/practicals', ClipboardList],
      ['Team members', '/admin/team', Users], ['Notes', '/admin/notes', Notebook], ['Settings', '/admin/settings', Settings]
    ]
  };
  const scope = role === 'student'
    ? [user?.departmentId?.code || user?.departmentId?.name || user?.departmentId, user?.yearId?.name || user?.yearId, user?.semesterId?.name || user?.semesterId].filter(Boolean).join(' · ') || 'Academic assignment not set'
    : roleNames[role];
  const roleNotifications = role === 'admin'
    ? notificationItems
    : notifications.filter((item) => item.role === role);
  const unreadCount = roleNotifications.filter((item) => !item.read).length;
  const [profileOpen, setProfileOpen] = useState(false);
  const profilePhotoUrl = useProfilePhoto(user);
  const normalizedSearch = search.trim().toLowerCase();
  const searchResults = normalizedSearch ? [
    ...searchSubjects.filter((item) => `${item.name || ''} ${item.subjectCode || item.code || ''}`.toLowerCase().includes(normalizedSearch)).slice(0, 4).map((item) => ({ label: item.name, to: role === 'student' ? `/student/subjects/${item._id || item.id}` : `/${role}/subjects` })),
    ...searchPracticals.filter((item) => `${item.title || ''} ${item.practicalNumber || ''}`.toLowerCase().includes(normalizedSearch)).slice(0, 4).map((item) => ({ label: item.title, to: role === 'student' ? `/student/practicals/${item._id || item.id}` : `/${role}/practicals/${item._id || item.id}` }))
  ] : [];

  return <div className="portal-layout">
    {mobileOpen && <button className="drawer-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <Link to={roleHome[role]} className="brand-lockup"><span className="brand-mark"><BookOpen size={19} /></span><span><strong>Practical Portal</strong><small>ACADEMIC WORKSPACE</small></span></Link>
      <div className="sidebar-context"><span className="context-dot" />{roleNames[role]} workspace</div>
      <nav className="side-nav" aria-label={`${roleNames[role]} navigation`}>
        <p className="nav-caption">WORKSPACE</p>
        {roleNav[role].map(([label, to, Icon]) => <NavLink key={to} to={to} end={to.endsWith('dashboard')} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`} onClick={() => setMobileOpen(false)}><Icon size={17} strokeWidth={1.8} /><span>{label}</span></NavLink>)}
      </nav>
      <div className="sidebar-bottom"><div className="term-card"><span>ACADEMIC STRUCTURE</span><strong>Managed by your college</strong><small>Assignments appear when configured</small></div><button className="nav-link logout-link" onClick={onLogout}><LogOut size={17} /><span>Sign out</span></button></div>
    </aside>
    <div className="portal-main">
      <header className="topbar">
        <button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
        <div className="topbar-crumb"><span>College Practical Portal</span><ChevronRight size={14} /><strong>{roleNames[role]} workspace</strong></div>
        <div className="topbar-actions">
          <label className="global-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search subjects, practicals..." aria-label="Search subjects and practicals" />{search && <button onClick={() => setSearch('')} aria-label="Clear search"><X size={14} /></button>}<kbd>Ctrl K</kbd></label>
          {search && <div className="search-popover">{searchResults.map((result, index) => <Link key={`${result.label}-${index}`} to={result.to} onClick={() => setSearch('')}><Search size={14} />{result.label}<ArrowRight size={14} /></Link>)}{!searchResults.length && <span className="search-empty">No matching learning material</span>}</div>}
          <ThemeToggle />
          <div className="topbar-menu-wrap"><button className={`icon-button notification-trigger ${notificationOpen ? 'is-active' : ''}`} onClick={() => setNotificationOpen(!notificationOpen)} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}><Bell size={18} />{unreadCount > 0 && <i />}</button>{notificationOpen && <div className="notification-popover"><div className="popover-heading"><strong>Notifications</strong><button className="text-link" onClick={() => setNotificationOpen(false)}>Close</button></div>{roleNotifications.length ? roleNotifications.slice(0, 6).map((item) => <button type="button" className={`notification-item ${item.read ? 'notification-read' : ''}`} key={item._id || item.id} onClick={() => !item.read && onNotificationRead?.(item)}><span className="notification-dot" /><span><strong>{item.message || item.title}</strong><small>{item.createdAt ? new Date(item.createdAt).toLocaleString() : item.time}</small></span></button>) : <p className="popover-empty">No notifications yet.</p>}<Link to={`/${role}/notifications`} className="popover-footer" onClick={() => setNotificationOpen(false)}>View all notifications <ArrowRight size={14} /></Link></div>}</div>
          <div className="topbar-menu-wrap"><button className="profile-trigger" onClick={() => setProfileOpen(!profileOpen)}><ProfileAvatar name={user?.name} photoUrl={profilePhotoUrl} size="sm" /><span className="profile-trigger-copy"><strong>{user?.name || roleNames[role]}</strong><small>{scope}</small></span><ChevronDown size={15} /></button>{profileOpen && <div className="profile-menu"><Link to={`/${role}/profile`} onClick={() => setProfileOpen(false)}>View profile</Link><button onClick={onLogout}>Sign out</button></div>}</div>
        </div>
      </header>
      <main className="workspace-content">{children}</main>
      <footer className="workspace-footer"><span>College Practical Portal</span><span>Academic workspace</span></footer>
    </div>
  </div>;
}

function normalizeSubjectFromApi(subject) {
  if (!subject) return null;
  return {
    ...subject,
    id: subject._id || subject.id,
    code: subject.subjectCode || subject.code || 'SUB',
    departmentName: subject.departmentId?.name || '',
    yearName: subject.yearId?.name || '',
    semesterName: subject.semesterId?.name || '',
    departmentId: subject.departmentId?._id || subject.departmentId,
    yearId: subject.yearId?._id || subject.yearId,
    semesterId: subject.semesterId?._id || subject.semesterId,
    practicalCount: subject.practicalCount || 0
  };
}

function normalizePracticalFromApi(practical) {
  if (!practical) return null;
  return {
    ...practical,
    id: practical._id || practical.id,
    concept: practical.theory || practical.concept || '',
    learn: practical.objectives || practical.learn || [],
    subjectId: practical.subjectId?._id || practical.subjectId || practical.subjectId,
    departmentId: practical.departmentId?._id || practical.departmentId || practical.departmentId,
    yearId: practical.yearId?._id || practical.yearId || practical.yearId,
    semesterId: practical.semesterId?._id || practical.semesterId || practical.semesterId,
    practicalNumber: Number(practical.practicalNumber || 1),
    published: practical.status === 'published' || practical.published,
    status: practical.status === 'published' ? 'published' : practical.status || 'draft'
  };
}

function DashboardSharedNotes({ role }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openingId, setOpeningId] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const loadNotes = async () => {
      try {
        const response = await api.get('/dashboard/notes');
        if (!active) return;
        setNotes(response?.data?.notes || []);
        setError('');
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message || 'Unable to load shared notes.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadNotes();
    const interval = window.setInterval(loadNotes, 30000);
    window.addEventListener('focus', loadNotes);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', loadNotes);
    };
  }, [reloadKey]);

  const openNote = async (note) => {
    if (note.storageType === 'driveLink' && note.driveUrl) {
      window.open(note.driveUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    const tab = window.open('', '_blank');
    if (!tab) {
      setError('Allow pop-ups to open this note.');
      return;
    }
    tab.opener = null;
    setOpeningId(note.id);
    setError('');
    try {
      const blob = await api.getBlob(`/dashboard/notes/${note.id}/view`, { timeoutMs: 120000 });
      const objectUrl = URL.createObjectURL(blob);
      tab.location.href = objectUrl;
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (openError) {
      tab.close();
      setError(openError.message || 'Unable to open this note.');
    } finally {
      setOpeningId('');
    }
  };

  return <section className="surface dashboard-panel dashboard-shared-notes">
    <div className="panel-heading">
      <div><p className="eyebrow">SHARED LEARNING MATERIAL</p><h2>Latest notes</h2></div>
      {role === 'student' && <Link className="text-link" to="/student/notes">All notes <ArrowRight size={14} /></Link>}
    </div>
    {loading ? <p className="planner-caption">Loading shared notes...</p>
      : error && !notes.length ? <div><p className="planner-error" role="alert">{error}</p><Button variant="quiet" onClick={() => setReloadKey((key) => key + 1)}>Retry</Button></div>
        : notes.length ? <div className="dashboard-note-list">{notes.slice(0, 4).map((note) => (
          <button type="button" className="dashboard-note-row" key={note.id} onClick={() => openNote(note)} disabled={openingId === note.id}>
            <span className={`notes-file-icon notes-file-${note.fileType || 'other'}`}>{note.storageType === 'driveLink' ? <Link2 size={17} /> : <FileText size={17} />}</span>
            <span className="dashboard-note-copy"><strong>{note.title || 'Untitled note'}</strong><small>{note.category || note.folderPath || 'Shared notes'} · {note.storageType === 'driveLink' ? 'Google Drive link' : (note.extension || note.fileType || 'file').toUpperCase()}</small></span>
            {openingId === note.id ? <LoaderCircle size={16} className="workspace-loading-spinner" /> : <ArrowRight size={15} />}
          </button>
        ))}</div>
          : <EmptyState title="No shared notes yet" text="Notes published by the administrator will appear here." icon={Notebook} />}
    {error && notes.length > 0 && <p className="planner-error" role="alert">{error}</p>}
  </section>;
}

function StudentDashboard({ user, practicalList, bookmarkedIds, subjectList = [], completedIds = [], progressRecords = [], notify }) {
  const navigate = useNavigate();
  const studentSubjects = subjectList.map(normalizeSubjectFromApi).filter(Boolean);
  const studentPracticals = useMemo(() => practicalList.map(normalizePracticalFromApi).filter(Boolean), [practicalList]);
  const completed = studentPracticals.filter((item) => completedIds.includes(String(item.id))).length;
  return <>
    <PageHeading eyebrow="STUDENT WORKSPACE" title={`Good morning, ${user?.name?.split(' ')[0] || 'there'}`} description="Pick up where you left off in your practical work." />
    <div className="stat-grid"><Stat label="My subjects" value={studentSubjects.length} note="Current semester" icon={BookOpen} /><Stat label="Practicals" value={studentPracticals.length} note="Published for you" icon={ClipboardList} tone="green" /><Stat label="Completed" value={completed} note={`${studentPracticals.length - completed} to go`} icon={CheckCircle2} tone="amber" /><Stat label="Bookmarks" value={bookmarkedIds.length} note="Saved for later" icon={Bookmark} tone="slate" /></div>
    <StudentPlanner user={user} practicalList={studentPracticals} progressRecords={progressRecords} completedIds={completedIds} notify={notify} />
    <div className="section-heading"><div><p className="eyebrow">YOUR CURRICULUM</p><h2>My subjects</h2></div><Link className="text-link" to="/student/subjects">View all subjects <ArrowRight size={15} /></Link></div>
    {studentSubjects.length ? <div className="subject-grid">{studentSubjects.slice(0, 3).map((subject) => { const items = studentPracticals.filter((item) => item.subjectId === subject.id); return <SubjectTile key={subject.id} subject={subject} items={items} completedCount={items.filter((item) => completedIds.includes(String(item.id))).length} />; })}</div> : <EmptyState title="No subjects assigned" text="No subjects are assigned to your department, year and semester yet." />}
    <div className="section-heading section-heading-spaced"><div><p className="eyebrow">PICK UP WHERE YOU LEFT OFF</p><h2>Recently available</h2></div><Link className="text-link" to="/student/practicals">All practicals <ArrowRight size={15} /></Link></div>
    <section className="surface practical-list">{studentPracticals.slice(0, 4).map((item) => <PracticalRow key={item.id} practical={item} subject={studentSubjects.find((entry) => entry.id === item.subjectId)} completed={completedIds.includes(String(item.id))} onOpen={(practical) => navigate(`/student/practicals/${practical.id}`)} />)}</section>
    <DashboardSharedNotes role="student" />
  </>;
}

function StudentSubjects({ user, practicalList, subjectList = [], completedIds = [] }) {
  const studentSubjects = subjectList.map(normalizeSubjectFromApi).filter(Boolean);
  return <><PageHeading eyebrow="LEARNING MATERIAL" title="My subjects" description="Subjects assigned to your current academic semester." /><div className="filter-bar"><span><GraduationCap size={16} />{user?.departmentId?.name || user?.departmentId || 'Department'} <i />{user?.yearId?.name || user?.yearId || 'Year'} <i />{user?.semesterId?.name || user?.semesterId || 'Semester'}</span><span className="muted-inline">{studentSubjects.length} subjects</span></div>{studentSubjects.length ? <div className="subject-grid subject-grid-wide">{studentSubjects.map((subject) => { const items = (practicalList || []).map(normalizePracticalFromApi).filter((item) => item && String(item.subjectId) === String(subject.id)); return <SubjectTile key={subject.id} subject={subject} items={items} completedCount={items.filter((item) => completedIds.includes(String(item.id))).length} />; })}</div> : <EmptyState title="No subjects yet" text="No subjects are assigned to you yet." />}</>;
}

function StudentSubjectDetail({ subjectId, subjectList = [], completedIds = [], submissionList = [] }) {
  const navigate = useNavigate();
  const subjectPool = subjectList.map(normalizeSubjectFromApi).filter(Boolean);
  const subject = subjectPool.find((item) => String(item.id) === String(subjectId));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    setItems([]);
    studentService.getSubjectPracticals(subjectId).then((response) => {
      if (active) setItems((response?.data?.practicals || []).map(normalizePracticalFromApi).filter(Boolean));
    }).catch((error) => {
      if (active) setLoadError(error.message || 'Unable to load subject practicals.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [subjectId]);
  if (!subject) return <EmptyState title="Subject not found" text="This subject may no longer be available." action={<Button onClick={() => navigate('/student/subjects')}>Back to subjects</Button>} />;
  const completed = items.filter((item) => completedIds.includes(String(item.id))).length;
  if (loading) return <EmptyState title="Loading practicals..." text="Fetching the latest published practicals for this subject." icon={Activity} />;
  if (loadError) return <EmptyState title="Unable to load practicals" text={loadError} icon={Activity} />;
  return <><div className="breadcrumbs"><Link to="/student/dashboard">Dashboard</Link><ChevronRight size={14} /><Link to="/student/subjects">My subjects</Link><ChevronRight size={14} /><span>{subject.name}</span></div><PageHeading eyebrow={`${subject.code} · ${subject.semesterName || subject.semesterId}`} title={subject.name} description={subject.description} actions={<Button variant="secondary" onClick={() => navigate(`/student/practicals?subject=${subject.id}`)}>View all practicals <ArrowRight size={15} /></Button>} /><div className="stat-grid stat-grid-small"><Stat label="Total practicals" value={items.length} icon={ClipboardList} /><Stat label="Completed" value={completed} icon={CheckCircle2} tone="green" /><Stat label="Remaining" value={items.length - completed} icon={Clock3} tone="amber" /></div><div className="section-heading"><div><p className="eyebrow">PRACTICAL SEQUENCE</p><h2>Course practicals</h2></div><span className="muted-inline">Ordered by practical number</span></div><section className="surface practical-list">{items.map((item) => <PracticalRow key={item.id} practical={item} subject={subject} completed={completedIds.includes(String(item.id))} submissionStatus={latestSubmissionFor(submissionList, item.id)?.status || 'Not Submitted'} onOpen={(practical) => navigate(`/student/practicals/${practical.id}`)} />)}{!items.length && <EmptyState title="No practicals published" text="No practicals have been published for this subject." />}</section></>;
}

function StudentPracticals({ practicalList, subjectList = [], completedIds = [], submissionList = [] }) {
  const navigate = useNavigate();
  const params = new URLSearchParams(useLocation().search);
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState(params.get('subject') || 'All');
  const [sort, setSort] = useState('sequence');
  const subjectPool = subjectList.map(normalizeSubjectFromApi).filter(Boolean);
  const items = (practicalList || []).map(normalizePracticalFromApi).filter((item) => item && (!params.get('subject') || String(item.subjectId) === String(params.get('subject'))));
  const filteredItems = items.filter((item) => (
    (filter === 'All' || (filter === 'Completed' ? completedIds.includes(String(item.id)) : !completedIds.includes(String(item.id))))
    && (subjectFilter === 'All' || String(item.subjectId) === subjectFilter)
    && `${item.title} ${item.practicalNumber}`.toLowerCase().includes(query.trim().toLowerCase())
  ));
  const shown = [...filteredItems].sort((first, second) => sort === 'title'
    ? first.title.localeCompare(second.title)
    : Number(first.practicalNumber) - Number(second.practicalNumber));
  return <><PageHeading eyebrow="LEARNING MATERIAL" title="Practicals" description="Browse published practicals, submit your work and track teacher feedback." /><div className="table-toolbar practical-toolbar"><label className="field-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search practicals" /></label><label className="practical-filter-select"><span className="sr-only">Filter by subject</span><select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}><option value="All">All subjects</option>{subjectPool.map((subject) => <option key={subject.id} value={String(subject.id)}>{subject.name}</option>)}</select></label><label className="practical-filter-select"><span className="sr-only">Sort practicals</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="sequence">Practical sequence</option><option value="title">Title A–Z</option></select></label><div className="segmented-control" aria-label="Filter practicals">{['All', 'Completed', 'Pending'].map((value) => <button key={value} className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{value}</button>)}</div><span className="muted-inline practical-result-count">{shown.length} results</span></div><section className="surface practical-list">{shown.map((item) => <PracticalRow key={item.id} practical={item} subject={subjectPool.find((entry) => String(entry.id) === String(item.subjectId))} completed={completedIds.includes(String(item.id))} submissionStatus={latestSubmissionFor(submissionList, item.id)?.status || 'Not Submitted'} onOpen={(practical) => navigate(`/student/practicals/${practical.id}`)} />)}{!shown.length && <EmptyState title="No practicals found" text={query || subjectFilter !== 'All' ? 'Try another search term or clear your filters.' : 'No practicals match this status yet.'} icon={Filter} />}</section></>;
}

function StudentPracticalDetail({ practicalId, bookmarkedIds, toggleBookmark, completePractical, notify, subjectList = [], completedIds = [], submissionList = [], evaluationList = [], onSubmitted }) {
  const [practical, setPractical] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submissionContent, setSubmissionContent] = useState('');
  const [submissionFile, setSubmissionFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    setPractical(null);
    studentService.getPracticalById(practicalId).then((response) => {
      if (active) setPractical(normalizePracticalFromApi(response?.data?.practical));
    }).catch((error) => {
      if (active) setLoadError(error.message || 'This practical is no longer available.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [practicalId]);
  const subject = subjectList.map(normalizeSubjectFromApi).filter(Boolean).find((item) => String(item.id) === String(practical?.subjectId));
  if (loading) return <EmptyState title="Loading practical..." text="Checking the latest published version." icon={Activity} />;
  if (loadError) return <EmptyState title="Practical unavailable" text={loadError} action={<Link to="/student/practicals" className="text-link">Browse practicals</Link>} />;
  if (!practical) return <EmptyState title="Practical not found" text="This practical may no longer be available." action={<Link to="/student/practicals" className="text-link">Browse practicals</Link>} />;
  const saved = bookmarkedIds.includes(practical.id);
  const completed = completedIds.includes(String(practical.id));
  const practicalSubmissions = submissionList
    .filter((submission) => recordId(submission.practicalId) === String(practical.id))
    .sort((first, second) => Number(second.attempt || 0) - Number(first.attempt || 0));
  const latestSubmission = practicalSubmissions[0];
  const canSubmit = !latestSubmission || latestSubmission.status === 'Resubmission Required';
  const submitWork = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    setSubmissionError('');
    if (!submissionFile && !submissionContent.trim()) {
      setSubmissionError('Attach a PDF or enter your practical work before submitting.');
      return;
    }
    const payload = new FormData();
    payload.append('practicalId', practical.id);
    payload.append('content', submissionContent.trim());
    if (submissionFile) payload.append('file', submissionFile);
    setSubmitting(true);
    try {
      const response = await submissionService.create(payload);
      const submission = response?.data?.submission;
      if (!submission) throw new Error('The server did not return the saved submission.');
      onSubmitted(submission);
      setSubmissionContent('');
      setSubmissionFile(null);
      form.reset();
      notify('Practical submitted successfully.');
    } catch (error) {
      setSubmissionError(error.message || 'Could not submit this practical.');
    } finally {
      setSubmitting(false);
    }
  };
  const Section = ({ title, children, number: sectionNumber }) => <section className="detail-section"><div className="detail-section-number">{sectionNumber}</div><div><h2>{title}</h2>{children}</div></section>;
  const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
  const nonEmptyLines = (lines) => (Array.isArray(lines) ? lines : []).filter(hasText);
  const guideSections = [
    { title: 'Aim', content: hasText(practical.aim) && <p>{practical.aim}</p> },
    { title: 'About this practical', content: hasText(practical.about) && <p>{practical.about}</p> },
    { title: 'What you will learn', content: nonEmptyLines(practical.learn).length > 0 && <ul>{nonEmptyLines(practical.learn).map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ul> },
    { title: 'Requirements', content: nonEmptyLines(practical.requirements).length > 0 && <ul>{nonEmptyLines(practical.requirements).map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ul> },
    { title: 'Concept / theory', content: hasText(practical.concept) && <p>{practical.concept}</p> },
    { title: 'Step-by-step procedure', content: nonEmptyLines(practical.procedure).length > 0 && <ol>{nonEmptyLines(practical.procedure).map((line, index) => <li key={`${index}-${line}`}><span>{number(index + 1)}</span>{line}</li>)}</ol> },
    { title: 'Practical task', content: hasText(practical.task) && <p>{practical.task}</p> },
    { title: 'Expected output', content: hasText(practical.expectedOutput) && <div className="output-box"><CheckCircle2 size={17} /><p>{practical.expectedOutput}</p></div> },
    { title: 'Important points', content: nonEmptyLines(practical.importantPoints).length > 0 && <ul>{nonEmptyLines(practical.importantPoints).map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ul> },
    { title: 'Common errors', content: nonEmptyLines(practical.commonErrors).length > 0 && <ul>{nonEmptyLines(practical.commonErrors).map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ul> },
    { title: 'Viva questions', content: nonEmptyLines(practical.vivaQuestions).length > 0 && <ol className="viva-list">{nonEmptyLines(practical.vivaQuestions).map((line, index) => <li key={`${index}-${line}`}><span>{number(index + 1)}</span>{line}</li>)}</ol> }
  ].filter((section) => section.content);
  return <><div className="breadcrumbs"><Link to="/student/dashboard">Dashboard</Link><ChevronRight size={14} /><Link to={`/student/subjects/${subject?.id}`}>{subject?.name}</Link><ChevronRight size={14} /><span>Practical {number(practical.practicalNumber)}</span></div><div className="practical-detail-layout"><article className="practical-article"><div className="practical-detail-head"><Status>{completed ? 'Completed' : 'Available'}</Status><span className="muted-inline">{subject?.name} · Practical {number(practical.practicalNumber)}</span><h1>{practical.title}</h1><p>{guideSections.length ? "Follow the steps below, then use the original handout when you need the teacher's source material." : practical.pdfId ? 'The written guide is not available yet. View the original practical handout below.' : 'Your teacher has not added written instructions or a source file yet.'}</p><div className="detail-actions"><Button variant="secondary" icon={saved ? Check : Bookmark} onClick={() => { toggleBookmark(practical.id); notify(saved ? 'Bookmark removed.' : 'Bookmark added.'); }}>{saved ? 'Bookmarked' : 'Bookmark'}</Button><Button variant="secondary" icon={Download} onClick={() => pdfService.download(practical.pdfId).catch((error) => notify(error.message || 'Could not download the original PDF.'))} disabled={!practical.pdfId}>Download PDF</Button><Button onClick={() => completePractical(practical.id)} icon={CheckCircle2}>{completed ? 'Mark incomplete' : 'Mark complete'}</Button></div></div>
    <div className="guide-heading"><div><span className="eyebrow">PRACTICAL GUIDE</span><p>{guideSections.length ? `${guideSections.length} sections · Read through the guide before you begin.` : 'Your teacher’s original handout is available below.'}</p></div><ClipboardList size={19} aria-hidden="true" /></div>
    {guideSections.length > 0
      ? <div className="guide-section-list">{guideSections.map((section, index) => <Section key={section.title} title={section.title} number={number(index + 1)}>{section.content}</Section>)}</div>
      : <><div className="guide-empty-state"><div className="guide-empty-icon"><FileText size={20} /></div><div><h2>Practical guide is not available yet</h2><p>{practical.pdfId ? 'Your teacher has not added the written guide details. The original practical handout is shown below.' : 'Your teacher has not added the written guide or original handout yet. Please check back later.'}</p></div></div>{practical.pdfId && <InlineOriginalPdf pdfId={practical.pdfId} />}</>}
    <div className="original-file-mobile"><OriginalPdfPanel notify={notify} /></div></article><aside className="detail-aside"><OriginalPdfPanel notify={notify} /><div className="aside-note"><ShieldCheck size={17} /><p><strong>Teacher source preserved</strong><br />This learning guide does not replace the original practical handout.</p></div></aside></div>
    <section className="surface dashboard-panel">
      <div className="panel-heading"><div><p className="eyebrow">CLASSROOM SUBMISSION</p><h2>Submit your work</h2></div><Status>{latestSubmission?.status || 'Not Submitted'}</Status></div>
      {latestSubmission && <p className="page-description">Latest attempt {latestSubmission.attempt} · submitted {new Date(latestSubmission.submissionDate || latestSubmission.createdAt).toLocaleString()}</p>}
      {canSubmit
        ? <form className="form-grid" onSubmit={submitWork}>
          <label className="form-field form-field-wide"><span>Practical work / notes</span><textarea rows="4" value={submissionContent} onChange={(event) => setSubmissionContent(event.target.value)} placeholder="Write your work or add notes for your teacher" /></label>
          <label className="form-field form-field-wide"><span>Attach your work (PDF)</span><input type="file" accept=".pdf,application/pdf" onChange={(event) => setSubmissionFile(event.target.files?.[0] || null)} /></label>
          {submissionError && <p className="admin-modal-error" role="alert">{submissionError}</p>}
          <div className="admin-modal-actions form-field-wide"><Button type="submit" disabled={submitting}>{submitting ? 'Submitting...' : latestSubmission ? 'Submit requested revision' : 'Submit practical'}</Button></div>
        </form>
        : <p className="page-description">{latestSubmission.status === 'Evaluated' ? 'Your teacher has evaluated this attempt. You can submit again if your teacher requests a revision.' : 'Your work has been submitted and is waiting for teacher review.'}</p>}
      {practicalSubmissions.length > 0 && <div className="submission-history">
        <h3>Submission history</h3>
        {practicalSubmissions.map((submission) => {
          const evaluation = evaluationList.find((entry) => recordId(entry.submissionId) === recordId(submission));
          return <div className="activity-row" key={recordId(submission)}>
            <span className="activity-file"><FileText size={17} /></span>
            <div><strong>Attempt {submission.attempt} · {submission.status}</strong><small>{new Date(submission.submissionDate || submission.createdAt).toLocaleString()}{submission.remarks ? ` · ${submission.remarks}` : ''}</small>
              {evaluation && <small>Marks: {evaluation.marksObtained}/{evaluation.maximumMarks} ({evaluation.resultStatus}){evaluation.remarks ? ` · ${evaluation.remarks}` : ''}</small>}
              {submission.content && <small>{submission.content}</small>}
            </div>
            {submission.submissionFile?.gridFsFileId && <Button type="button" variant="quiet" onClick={() => downloadSubmissionFile(submission).catch((error) => notify(error.message || 'Could not download your submission.'))}>Download PDF</Button>}
          </div>;
        })}
      </div>}
    </section></>;
}

function OriginalPdfPanel({ notify }) {
  const { pathname } = useLocation();
  const practicalId = pathname.match(/^\/student\/practicals\/([^/]+)/)?.[1];
  const [pdfId, setPdfId] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  useEffect(() => {
    let active = true;
    if (!practicalId) return () => { active = false; };
    studentService.getPracticalById(practicalId).then((response) => {
      if (active) setPdfId(response?.data?.practical?.pdfId || '');
    }).catch(() => {
      if (active) setPdfId('');
    });
    return () => { active = false; };
  }, [practicalId]);
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);
  const openPdf = async () => {
    if (!pdfId || pdfLoading || previewUrl) return;
    setPdfLoading(true);
    try {
      const url = await pdfService.view(pdfId);
      setPreviewUrl(url);
    } catch (error) {
      notify(error.message || 'Could not open the original PDF.');
    } finally {
      setPdfLoading(false);
    }
  };
  const downloadPdf = async () => {
    try {
      if (!pdfId) throw new Error('No original PDF is attached.');
      await pdfService.download(pdfId);
    } catch (error) {
      notify(error.message || 'Could not download the original PDF.');
    }
  };
  return <><section className="pdf-panel" id="original-pdf"><div className="pdf-panel-head"><span className="pdf-icon"><FileText size={18} /></span><span><strong>Original practical PDF</strong><small>Teacher-uploaded source file</small></span><MoreHorizontal size={18} /></div><div className="pdf-preview"><FileText size={35} /><strong>{pdfId ? 'Original handout attached' : 'No PDF attached'}</strong><span>Stored in MongoDB GridFS</span></div><div className="pdf-actions"><Button variant="secondary" icon={pdfLoading ? LoaderCircle : ArrowRight} onClick={openPdf} disabled={!pdfId || pdfLoading || Boolean(previewUrl)}>{pdfLoading ? 'Opening...' : previewUrl ? 'PDF open' : 'Open PDF'}</Button><Button variant="quiet" icon={ArrowDownToLine} onClick={downloadPdf} disabled={!pdfId}>Download</Button></div></section>{previewUrl && <div className="pdf-viewer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewUrl(''); }}><section className="pdf-viewer-dialog" role="dialog" aria-modal="true" aria-label="Original practical PDF"><header className="pdf-viewer-header"><span><FileText size={18} /><strong>Original practical PDF</strong></span><button className="icon-button" type="button" onClick={() => setPreviewUrl('')} aria-label="Close PDF preview"><X size={18} /></button></header><iframe className="pdf-viewer-frame" src={previewUrl} title="Original practical PDF" /></section></div>}</>;
}

function InlineOriginalPdf({ pdfId }) {
  const [pdfUrl, setPdfUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    pdfService.view(pdfId).then((url) => {
      objectUrl = url;
      if (active) setPdfUrl(url);
      else URL.revokeObjectURL(url);
    }).catch((error) => {
      if (active) setLoadError(error.message || 'Could not load the original handout.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pdfId]);
  return <section className="inline-pdf-source" aria-label="Original practical handout">
    <div className="inline-pdf-heading"><FileText size={17} /><div><strong>Original practical handout</strong><span>Teacher-uploaded source PDF</span></div></div>
    {loading && <div className="inline-pdf-status"><LoaderCircle size={16} className="inline-pdf-spinner" />Loading the original handout...</div>}
    {loadError && <p className="inline-pdf-error">{loadError}</p>}
    {pdfUrl && <iframe className="inline-pdf-frame" src={pdfUrl} title="Original practical handout PDF" />}
  </section>;
}

function StudentBookmarks({ practicalList, bookmarkedIds, subjectList = [] }) {
  const subjectPool = subjectList.map(normalizeSubjectFromApi).filter(Boolean);
  const items = (practicalList || []).map(normalizePracticalFromApi).filter((item) => item && bookmarkedIds.includes(item.id));
  const navigate = useNavigate();
  return <><PageHeading eyebrow="SAVED LEARNING MATERIAL" title="Bookmarks" description="A short list of practicals you want to return to." />{items.length ? <section className="surface practical-list">{items.map((item) => <PracticalRow key={item.id} practical={item} subject={subjectPool.find((entry) => String(entry.id) === String(item.subjectId))} onOpen={(practical) => navigate(`/student/practicals/${practical.id}`)} />)}</section> : <EmptyState title="No bookmarks yet" text="You haven't bookmarked any practical yet. Save a practical to find it here." icon={Bookmark} action={<Link to="/student/subjects" className="text-link">Browse my subjects <ArrowRight size={15} /></Link>} />}</>;
}

function NotesPage() {
  const { user } = useAuth();
  const userId = String(user?._id || user?.id || user?.email || 'student');
  const viewStorageKey = `college_practical_notes_view:${userId}`;
  const savedView = (() => {
    try {
      return JSON.parse(sessionStorage.getItem(viewStorageKey) || '{}');
    } catch {
      return {};
    }
  })();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncWarning, setSyncWarning] = useState('');
  const [search, setSearch] = useState(savedView.search || '');
  const [category, setCategory] = useState(savedView.category || '');
  const [sort, setSort] = useState(savedView.sort || 'newest');
  const [openFolder, setOpenFolder] = useState(Array.isArray(savedView.openFolder) ? savedView.openFolder : []);
  const [previewNote, setPreviewNote] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    const loadNotes = async () => {
      try {
        setLoading(true);
        setError('');
        setSyncWarning('');
        const response = await api.get('/student/notes');
        if (!active) return;
        const uniqueNotes = new Map();
        for (const note of Array.isArray(response?.data?.notes) ? response.data.notes : []) {
          const id = String(note.id || note._id || note.driveFileId || '');
          if (id && !uniqueNotes.has(id)) uniqueNotes.set(id, note);
        }
        setNotes([...uniqueNotes.values()]);
        setSyncWarning(response?.data?.syncError || '');
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message || 'Unable to load notes.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadNotes();
    return () => { active = false; };
  }, [reloadKey]);

  useEffect(() => {
    try {
      sessionStorage.setItem(viewStorageKey, JSON.stringify({ search, category, sort, openFolder }));
    } catch {
      return;
    }
  }, [category, openFolder, search, sort, viewStorageKey]);

  const categories = [...new Set(notes.map((note) => note.category || 'General'))].sort((left, right) => left.localeCompare(right));
  const rootFolderName = notes.length
    ? getNoteFolderSegments(notes[0])[0] || 'Notes'
    : 'Notes';
  const rootPath = [rootFolderName];
  const currentPath = openFolder.length && openFolder[0] === rootFolderName ? openFolder : rootPath;
  const normalizedSearch = search.trim().toLowerCase();
  const filteredNotes = notes
    .filter((note) => !category || (note.category || 'General') === category)
    .filter((note) => {
      if (!normalizedSearch) return true;
      return [note.title, note.category, note.folderPath, note.description, note.fileType, note.extension]
        .some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
    })
    .sort((left, right) => {
      if (sort === 'oldest') return new Date(left.driveUpdatedAt || left.updatedAt) - new Date(right.driveUpdatedAt || right.updatedAt);
      if (sort === 'title-asc') return String(left.title || '').localeCompare(String(right.title || ''));
      if (sort === 'title-desc') return String(right.title || '').localeCompare(String(left.title || ''));
      if (sort === 'largest') return Number(right.size || 0) - Number(left.size || 0);
      return new Date(right.driveUpdatedAt || right.updatedAt) - new Date(left.driveUpdatedAt || left.updatedAt);
    });
  const currentPathKey = JSON.stringify(currentPath);
  const visibleFoldersByPath = new Map();
  const visibleNotes = normalizedSearch
    ? filteredNotes
    : filteredNotes.filter((note) => JSON.stringify(getNoteFolderSegments(note)) === currentPathKey);

  if (!normalizedSearch) {
    for (const note of filteredNotes) {
      const segments = getNoteFolderSegments(note);
      for (let depth = rootPath.length; depth < segments.length; depth += 1) {
        if (JSON.stringify(segments.slice(0, depth)) !== currentPathKey) continue;
        const name = segments[depth];
        const childKey = JSON.stringify(segments.slice(0, depth + 1));
        const folder = visibleFoldersByPath.get(childKey) || { name, path: segments.slice(0, depth + 1), count: 0 };
        folder.count += 1;
        visibleFoldersByPath.set(childKey, folder);
      }
    }
  }
  const visibleFolders = [...visibleFoldersByPath.values()].sort((left, right) => left.name.localeCompare(right.name));
  const totalVisibleItems = visibleFolders.length + visibleNotes.length;

  if (loading) {
    return <EmptyState title="Loading notes..." text="Fetching the latest study notes shared with students." icon={Notebook} />;
  }

  if (error) {
    return <EmptyState title="Unable to load notes" text={error} icon={Notebook} action={<Button onClick={() => setReloadKey((key) => key + 1)}>Try again</Button>} />;
  }

  return <>
    <PageHeading eyebrow="STUDY RESOURCES" title="Notes" description="Open the notes shared for your classes directly inside the portal." />
    {syncWarning && <div className="notes-sync-warning" role="status">
      <span>{syncWarning}</span>
      <Button variant="quiet" onClick={() => setReloadKey((key) => key + 1)}>Retry sync</Button>
    </div>}
    <div className="notes-summary" aria-live="polite">
      <span><strong>{notes.length}</strong> total notes</span>
      <span><strong>{visibleFolders.length}</strong> folders here</span>
      <span><strong>{visibleNotes.length}</strong> notes here</span>
    </div>
    {!normalizedSearch && <nav className="notes-breadcrumbs" aria-label="Notes folders">
      {currentPath.map((segment, index) => {
        const destination = currentPath.slice(0, index + 1);
        const isCurrent = index === currentPath.length - 1;
        return <span className="notes-breadcrumb-item" key={`${segment}-${index}`}>
          {index > 0 && <ChevronRight size={14} aria-hidden="true" />}
          <button type="button" aria-current={isCurrent ? 'page' : undefined} onClick={() => setOpenFolder(destination)}>{segment}</button>
        </span>;
      })}
    </nav>}
    <div className="notes-controls">
      <label className="notes-control notes-search">
        <Search size={16} aria-hidden="true" />
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes" aria-label="Search notes" />
      </label>
      <label className="notes-control">
        <Filter size={16} aria-hidden="true" />
        <select value={category} onChange={(event) => { setCategory(event.target.value); setOpenFolder(rootPath); }} aria-label="Filter by category">
          <option value="">All categories</option>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label className="notes-control">
        <span className="notes-sort-label">Sort</span>
        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort notes">
          <option value="newest">Recently updated</option>
          <option value="oldest">Least recently updated</option>
          <option value="title-asc">Title A–Z</option>
          <option value="title-desc">Title Z–A</option>
          <option value="largest">Largest file</option>
        </select>
      </label>
    </div>
    <section className="notes-grid" aria-label="Drive folders and notes">
      {notes.length === 0 ? <EmptyState title="No notes available." text={syncWarning ? 'No notes are stored in the portal yet. Check Drive sharing and retry.' : 'No study notes have been synced yet.'} icon={Notebook} /> : totalVisibleItems ? <>
        {visibleFolders.map((folder) => (
          <button className="notes-folder-card" type="button" key={JSON.stringify(folder.path)} onClick={() => { setOpenFolder(folder.path); setSearch(''); }}>
            <span className="notes-folder-icon"><Folder size={23} /></span>
            <span className="notes-folder-details"><strong>{folder.name}</strong><small>{folder.count} {folder.count === 1 ? 'note' : 'notes'} inside</small></span>
            <ChevronRight size={18} className="notes-folder-arrow" />
          </button>
        ))}
        {visibleNotes.map((note) => (
        <article className="notes-card" key={note.id || note._id}>
          <div className="notes-card-top">
            <span className={`notes-file-icon notes-file-${note.fileType || 'other'}`}>{note.storageType === 'driveLink' ? <Link2 size={20} /> : <FileText size={20} />}</span>
            <span className="notes-card-type">{(note.extension || note.fileType || 'FILE').toString().toUpperCase()}</span>
          </div>
          <span className="notes-card-category">{note.category || 'General'}</span>
          <h2>{note.title || 'Untitled note'}</h2>
          <p className="notes-card-folder" title={note.folderPath || 'Shared notes'}>{note.folderPath || 'Shared notes'}</p>
          <div className="notes-card-footer">
            <span>{note.size ? `${(Number(note.size) / (1024 * 1024)).toFixed(1)} MB` : note.fileType || 'Learning resource'}</span>
            {note.storageType === 'driveLink' && note.driveUrl
              ? <a className="button button-secondary" href={note.driveUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${note.title || 'Google Drive note'}`}>Open Drive <ExternalLink size={15} /></a>
              : <Button variant="secondary" onClick={() => setPreviewNote(note)} aria-label={`View ${note.title || 'note'}`}>
                View note <ArrowRight size={15} />
              </Button>}
          </div>
        </article>
        ))}
      </> : normalizedSearch
        ? <EmptyState title="No matching notes" text="Try another search or category." icon={Notebook} />
        : <EmptyState title={currentPath.length > 1 ? 'This folder is empty' : 'No notes available.'} text={currentPath.length > 1 ? 'No subfolders or notes were found in this Drive folder.' : 'No study notes have been synced yet.'} icon={FolderOpen} />}
    </section>
    {previewNote && <NotePreview note={previewNote} onClose={() => setPreviewNote(null)} />}
  </>;
}

function NotePreview({ note, onClose }) {
  const scrollContainerRef = useRef(null);
  const pageRefs = useRef(new Map());
  const [document, setDocument] = useState(null);
  const [pageRatio, setPageRatio] = useState(0.72);
  const [imageUrl, setImageUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let active = true;
    let loadingTask;
    let loadedDocument;
    let objectUrl;

    const loadPreview = async () => {
      try {
        setLoading(true);
        setError('');
        const blob = await api.getBlob(`/student/notes/${note.id || note._id}/view`, { timeoutMs: 120000 });
        if (!active) return;
        const contentType = (blob.type || note.viewMimeType || note.mimeType || '').split(';')[0].toLowerCase();
        setMimeType(contentType);
        if (contentType === 'application/pdf' || note.fileType === 'pdf' || note.viewMimeType === 'application/pdf') {
          const pdfjsLib = await import('pdfjs-dist');
          if (!active) return;
          pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
          loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
          loadedDocument = await loadingTask.promise;
          if (!active) {
            await loadedDocument.destroy();
            return;
          }
          const firstPage = await loadedDocument.getPage(1);
          const firstViewport = firstPage.getViewport({ scale: 1 });
          setPageRatio(firstViewport.width / firstViewport.height);
          setDocument(loadedDocument);
        } else if (contentType.startsWith('image/')) {
          objectUrl = URL.createObjectURL(blob);
          setImageUrl(objectUrl);
        } else if (contentType.startsWith('text/')) {
          setTextContent(await blob.text());
        } else {
          throw new Error('This file type cannot be previewed in the portal yet.');
        }
      } catch (loadError) {
        if (active) setError(loadError.message || 'Unable to preview this note.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadPreview();
    return () => {
      active = false;
      if (loadingTask) loadingTask.destroy();
      if (loadedDocument) loadedDocument.destroy();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [note.id, note._id]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        if (fullscreen) setFullscreen(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [fullscreen, onClose]);

  const goToPage = (targetPage) => {
    const boundedPage = Math.max(1, Math.min(document?.numPages || 1, targetPage));
    pageRefs.current.get(boundedPage)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return <div className={`notes-preview-backdrop ${fullscreen ? 'notes-preview-backdrop-fullscreen' : ''}`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`notes-preview-dialog ${fullscreen ? 'notes-preview-fullscreen' : ''}`} role="dialog" aria-modal="true" aria-label={`Preview ${note.title || 'note'}`}>
      <header className="notes-preview-header">
        <div className="notes-preview-heading">
          <span className="notes-file-icon"><FileText size={19} /></span>
          <span><strong>{note.title || 'Note preview'}</strong><small>{note.category || 'Learning resource'} · In-portal preview</small></span>
        </div>
        <div className="notes-preview-header-actions">
          <button className="notes-preview-close" type="button" onClick={() => setFullscreen((value) => !value)} aria-label={fullscreen ? 'Exit fullscreen' : 'View fullscreen'} title={fullscreen ? 'Exit fullscreen' : 'View fullscreen'}>
            {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button className="notes-preview-close" type="button" onClick={onClose} aria-label="Close note preview" title="Close"><X size={19} /></button>
        </div>
      </header>
      {document && <div className="notes-pdf-toolbar" aria-label="PDF controls">
        <div className="notes-pdf-page-controls">
          <button type="button" onClick={() => goToPage(pageNumber - 1)} disabled={pageNumber <= 1} aria-label="Previous page"><ArrowLeft size={16} /></button>
          <span>Page <strong>{pageNumber}</strong> of {document.numPages}</span>
          <button type="button" onClick={() => goToPage(pageNumber + 1)} disabled={pageNumber >= document.numPages} aria-label="Next page"><ArrowRight size={16} /></button>
        </div>
        <div className="notes-pdf-zoom-controls">
          <button type="button" onClick={() => setZoom((value) => Math.max(0.6, Number((value - 0.15).toFixed(2))))} disabled={zoom <= 0.6} aria-label="Zoom out"><span>−</span></button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((value) => Math.min(1.8, Number((value + 0.15).toFixed(2))))} disabled={zoom >= 1.8} aria-label="Zoom in"><span>+</span></button>
        </div>
        <button className="notes-pdf-fit-button" type="button" onClick={() => setZoom(1)}>Fit width</button>
      </div>}
      <div className="notes-preview-body" ref={scrollContainerRef}>
        {loading ? <div className="notes-preview-message"><span className="workspace-loading-spinner" /><strong>Opening note...</strong><p>Preparing a secure preview inside the portal.</p></div>
          : error ? <div className="notes-preview-message notes-preview-error"><strong>Unable to preview note</strong><p>{error}</p></div>
            : document ? <div className="notes-pdf-pages">
              {Array.from({ length: document.numPages }, (_, index) => index + 1).map((page) => (
                <NotesPdfPage
                  key={page}
                  document={document}
                  pageNumber={page}
                  zoom={zoom}
                  pageRatio={pageRatio}
                  scrollContainerRef={scrollContainerRef}
                  onVisible={setPageNumber}
                  onCardRef={(element) => {
                    if (element) pageRefs.current.set(page, element);
                    else pageRefs.current.delete(page);
                  }}
                />
              ))}
            </div>
              : imageUrl ? <div className="notes-file-preview"><img src={imageUrl} alt={note.title || 'Note preview'} /></div>
                : mimeType.startsWith('text/') ? <pre className="notes-text-preview">{textContent}</pre>
                  : <div className="notes-preview-message"><strong>Preview unavailable</strong><p>This file format is not supported for in-portal viewing.</p></div>}
      </div>
      {document && <aside className="notes-preview-attribution" aria-label="Instagram @krushna_rajpure">
        <Instagram size={16} strokeWidth={2.1} />
        <span>@krushna_rajpure</span>
      </aside>}
    </section>
  </div>;
}

function NotesPdfPage({ document, pageNumber, zoom, pageRatio, scrollContainerRef, onVisible, onCardRef }) {
  const cardRef = useRef(null);
  const canvasRef = useRef(null);
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    const element = cardRef.current;
    if (!element) return undefined;
    const root = scrollContainerRef.current;
    const loadObserver = new IntersectionObserver(([entry]) => {
      setNearViewport(entry.isIntersecting);
    }, {
      root,
      rootMargin: '650px 0px',
      threshold: 0
    });
    const activePageObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.2) onVisible(pageNumber);
    }, {
      root,
      threshold: [0.2, 0.5, 0.8]
    });
    loadObserver.observe(element);
    activePageObserver.observe(element);
    return () => {
      loadObserver.disconnect();
      activePageObserver.disconnect();
    };
  }, [pageNumber, scrollContainerRef, onVisible]);

  useEffect(() => {
    if (!nearViewport || !canvasRef.current) return undefined;
    let cancelled = false;
    let renderTask;

    const renderPage = async () => {
      try {
        const page = await document.getPage(pageNumber);
        if (cancelled || !canvasRef.current) return;
        const availableWidth = Math.max(280, (scrollContainerRef.current?.clientWidth || 900) - 64);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(1.35, availableWidth / baseViewport.width) * zoom;
        const viewport = page.getViewport({ scale });
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d', { alpha: false });
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        renderTask = page.render({
          canvasContext: context,
          viewport,
          transform: pixelRatio === 1 ? null : [pixelRatio, 0, 0, pixelRatio, 0, 0]
        });
        await renderTask.promise;
      } catch (renderError) {
        if (!cancelled && renderError.name !== 'RenderingCancelledException') {
          console.error(`Unable to render PDF page ${pageNumber}:`, renderError);
        }
      }
    };

    renderPage();
    return () => {
      cancelled = true;
      if (renderTask) renderTask.cancel();
      if (canvasRef.current) {
        canvasRef.current.width = 0;
        canvasRef.current.height = 0;
      }
    };
  }, [document, nearViewport, pageNumber, scrollContainerRef, zoom]);

  return <div
    className={`notes-pdf-page-shell ${nearViewport ? 'notes-pdf-page-near' : ''}`}
    ref={(element) => {
      cardRef.current = element;
      onCardRef(element);
    }}
    style={{ aspectRatio: String(pageRatio) }}
    aria-label={`Page ${pageNumber}`}
  >
    <canvas ref={canvasRef} aria-label={`PDF page ${pageNumber}`} />
    {!nearViewport && <span className="notes-pdf-page-number">Page {pageNumber}</span>}
  </div>;
}

function StudentNoteDetail({ noteId }) {
  const location = useLocation();
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    setPreviewOpen(new URLSearchParams(location.search).get('preview') === '1');
  }, [location.search, noteId]);

  useEffect(() => {
    let active = true;

    const loadNote = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await api.get(`/student/notes/${noteId}`);
        if (!active) return;
        setNote(response?.data?.note || null);
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message || 'Unable to load this note.');
      } finally {
        if (active) setLoading(false);
      }
    };

    if (noteId) loadNote();
    return () => { active = false; };
  }, [noteId]);

  if (loading) return <EmptyState title="Loading note..." text="Preparing the note preview for you." icon={Notebook} />;
  if (error) return <EmptyState title="Note unavailable" text={error} action={<Link to="/student/notes" className="text-link">Back to notes</Link>} icon={Notebook} />;
  if (!note) return <EmptyState title="Note not found" text="This note may no longer be available." action={<Link to="/student/notes" className="text-link">Back to notes</Link>} icon={Notebook} />;

  return <>
    <div className="breadcrumbs">
      <Link to="/student/dashboard">Dashboard</Link>
      <ChevronRight size={14} />
      <Link to="/student/notes">Notes</Link>
      <ChevronRight size={14} />
      <span>{note.title || 'Note'}</span>
    </div>
    <PageHeading eyebrow="STUDY RESOURCE" title={note.title || 'Untitled note'} description={note.description || note.category || 'Shared study note'} actions={note.storageType === 'driveLink' && note.driveUrl
      ? <a className="button button-secondary" href={note.driveUrl} target="_blank" rel="noopener noreferrer">Open Drive <ExternalLink size={15} /></a>
      : <Button variant="secondary" onClick={() => setPreviewOpen(true)}>View note</Button>} />
    <section className="surface profile-card">
      <div className="profile-fields">
        <div className="profile-field"><span>Category</span><strong>{note.category || 'General'}</strong></div>
        <div className="profile-field"><span>Folder</span><strong>{note.folderPath || 'Shared notes'}</strong></div>
        <div className="profile-field"><span>File type</span><strong>{note.fileType || note.extension || 'Document'}</strong></div>
        <div className="profile-field"><span>Extension</span><strong>{note.extension ? `.${note.extension}` : 'N/A'}</strong></div>
        <div className="profile-field"><span>Status</span><strong>{note.isActive === false ? 'Inactive' : 'Available'}</strong></div>
      </div>
    </section>
    {previewOpen && <NotePreview note={note} onClose={() => setPreviewOpen(false)} />}
  </>;
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return '—';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unitIndex = -1;
  do {
    size /= 1024;
    unitIndex += 1;
  } while (size >= 1024 && unitIndex < units.length - 1);
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function AdminNotesPage({ notify }) {
  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [stats, setStats] = useState(null);
  const [storage, setStorage] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [currentFolderId, setCurrentFolderId] = useState('root');
  const [editingId, setEditingId] = useState('');
  const [editedTitle, setEditedTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [formMode, setFormMode] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [newVisible, setNewVisible] = useState(true);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [newFileType, setNewFileType] = useState('markdown');
  const [newFileContent, setNewFileContent] = useState('');
  const [driveLinkTitle, setDriveLinkTitle] = useState('');
  const [driveLinkUrl, setDriveLinkUrl] = useState('');
  const [driveLinkDescription, setDriveLinkDescription] = useState('');
  const [formFolderId, setFormFolderId] = useState('');
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState('');
  const uploadInputRef = useRef(null);

  const loadData = async () => {
    setError('');
    const [notesResult, storageResult] = await Promise.allSettled([
      api.get('/admin/notes', { folderId: 'all' }),
      api.get('/admin/storage')
    ]);
    if (notesResult.status === 'rejected') throw notesResult.reason;
    setNotes(notesResult.value?.data?.notes || []);
    setFolders(notesResult.value?.data?.folders || []);
    setStats(notesResult.value?.data?.stats || null);
    if (storageResult.status === 'fulfilled') {
      setStorage(storageResult.value?.data || null);
      setStorageError('');
    } else {
      setStorage(null);
      setStorageError(storageResult.reason?.message || 'MongoDB storage information is unavailable.');
    }
  };

  useEffect(() => {
    let active = true;
    Promise.allSettled([api.get('/admin/notes', { folderId: 'all' }), api.get('/admin/storage')])
      .then(([notesResult, storageResult]) => {
        if (!active) return;
        if (notesResult.status === 'rejected') throw notesResult.reason;
        setNotes(notesResult.value?.data?.notes || []);
        setFolders(notesResult.value?.data?.folders || []);
        setStats(notesResult.value?.data?.stats || null);
        if (storageResult.status === 'fulfilled') {
          setStorage(storageResult.value?.data || null);
          setStorageError('');
        } else {
          setStorage(null);
          setStorageError(storageResult.reason?.message || 'MongoDB storage information is unavailable.');
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Unable to load note administration data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const normalizedSearch = search.trim().toLowerCase();
  const currentFolder = folders.find((folder) => folder.id === currentFolderId);
  const childFolders = folders
    .filter((folder) => normalizedSearch || folder.parentId === (currentFolderId === 'root' ? null : currentFolderId))
    .filter((folder) => !normalizedSearch || `${folder.name} ${folder.path}`.toLowerCase().includes(normalizedSearch))
    .sort((left, right) => left.name.localeCompare(right.name));
  const filteredNotes = notes
    .filter((note) => normalizedSearch
      ? `${note.title} ${note.originalName} ${note.category} ${note.folderPath} ${note.extension} ${note.fileType} ${note.mimeType}`.toLowerCase().includes(normalizedSearch)
      : currentFolderId === 'root' ? !note.folderId : note.folderId === currentFolderId)
    .filter((note) => {
      if (typeFilter === 'pdf') return note.fileType === 'pdf';
      if (typeFilter === 'created') return note.storageType === 'mongodb';
      if (typeFilter === 'driveLink') return note.storageType === 'driveLink';
      if (typeFilter === 'folder') return false;
      return true;
    })
    .sort((left, right) => {
      const leftCreated = left.driveCreatedAt || left.createdAt || 0;
      const rightCreated = right.driveCreatedAt || right.createdAt || 0;
      if (sortOrder === 'oldest') return new Date(leftCreated) - new Date(rightCreated);
      if (sortOrder === 'name') return String(left.title || '').localeCompare(String(right.title || ''));
      if (sortOrder === 'size') return Number(right.size || 0) - Number(left.size || 0);
      return new Date(rightCreated) - new Date(leftCreated);
    });

  const closeForm = () => {
    setFormMode('');
    setNewFolderName('');
    setNewFileName('');
    setNewFileContent('');
    setDriveLinkTitle('');
    setDriveLinkUrl('');
    setDriveLinkDescription('');
    setNewVisible(true);
    setFormFolderId(currentFolderId === 'root' ? '' : currentFolderId);
  };

  const submitForm = async (event) => {
    event.preventDefault();
    setFormBusy(true);
    try {
      if (formMode === 'folder') {
        await api.post('/admin/folders', {
          name: newFolderName,
          parentId: formFolderId || null
        });
        notify('Folder created.');
      } else if (formMode === 'file') {
        await api.post('/admin/notes/files', {
          title: newFileName,
          fileType: newFileType,
          content: newFileContent,
          folderId: formFolderId || null,
          isPublic: newVisible
        });
        notify('File created.');
      } else if (formMode === 'link') {
        await api.post('/admin/notes/drive-link', {
          title: driveLinkTitle,
          driveUrl: driveLinkUrl,
          description: driveLinkDescription,
          folderId: formFolderId || null,
          isPublic: newVisible
        });
        notify('Google Drive link added.');
      }
      closeForm();
      await loadData();
    } catch (formError) {
      notify(formError.message || 'Unable to save this item.');
    } finally {
      setFormBusy(false);
    }
  };

  const uploadPdf = (file) => new Promise((resolve, reject) => {
    const requestUrl = `${API_BASE_URL}/admin/notes/upload`;
    if (!API_BASE_URL) {
      reject(new Error('Portal API is not configured. Set VITE_API_URL and redeploy.'));
      return;
    }
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('folderId', formFolderId || (currentFolderId === 'root' ? '' : currentFolderId));
    formData.append('isPublic', String(newVisible));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', requestUrl);
    xhr.withCredentials = true;
    xhr.timeout = 120000;
    const token = localStorage.getItem('college_practical_token');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) setUploadProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new Error('Network error while uploading the PDF.'));
    xhr.ontimeout = () => reject(new Error('PDF upload timed out. Please try again.'));
    xhr.onload = () => {
      let payload;
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error('The server returned an invalid upload response.'));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(payload.message || payload.error || `Upload failed with HTTP ${xhr.status}.`));
        return;
      }
      resolve(payload);
    };
    xhr.send(formData);
  });

  const handlePdfSelection = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const limit = Number(storage?.uploadLimitBytes || 25 * 1024 * 1024);
    if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
      notify('Choose a PDF file.');
      return;
    }
    if (file.size > limit) {
      notify(`This PDF exceeds the ${formatBytes(limit)} upload limit.`);
      return;
    }
    setUploadProgress(0);
    try {
      await uploadPdf(file);
      notify('PDF uploaded to MongoDB GridFS.');
      await loadData();
    } catch (uploadError) {
      notify(uploadError.message || 'Unable to upload this PDF.');
    } finally {
      setUploadProgress(null);
    }
  };

  const openNote = async (note) => {
    const tab = window.open('', '_blank');
    if (!tab) {
      notify('Allow pop-ups to open this file.');
      return;
    }
    tab.opener = null;
    try {
      if (note.storageType === 'driveLink') {
        tab.location.href = note.driveUrl;
        return;
      }
      const blob = await api.getBlob(`/admin/notes/${note.id}/view`, { timeoutMs: 120000 });
      const objectUrl = URL.createObjectURL(blob);
      tab.location.href = objectUrl;
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (openError) {
      tab.close();
      notify(openError.message || 'Unable to open this file.');
    }
  };

  const downloadNote = async (note) => {
    try {
      const blob = await api.getBlob(`/admin/notes/${note.id}/download`, { timeoutMs: 120000 });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = note.title || note.originalName || 'download';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      notify(downloadError.message || 'Unable to download this file.');
    }
  };

  const copyNoteLink = async (note) => {
    const link = note.storageType === 'driveLink'
      ? note.driveUrl
      : new URL(`/api/admin/notes/${note.id}/view`, API_BASE_URL || window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(link);
      notify('Link copied.');
    } catch {
      notify('Could not copy the link. Check browser clipboard permissions.');
    }
  };

  const moveNote = async (note, folderId) => {
    await updateNote(note, { folderId: folderId === 'root' ? null : folderId || null });
  };

  const syncNotes = async () => {
    setSyncing(true);
    try {
      const response = await api.post('/admin/notes/sync', {});
      await loadData();
      const summary = response?.data || {};
      notify(`Drive sync complete: ${summary.filesAdded || 0} added, ${summary.filesUpdated || 0} updated.`);
    } catch (syncError) {
      notify(syncError.message || 'Unable to sync notes from Google Drive.');
    } finally {
      setSyncing(false);
    }
  };

  const updateNote = async (note, changes) => {
    const id = String(note._id || note.id);
    setBusyId(id);
    try {
      await api.put(`/admin/notes/${id}`, changes);
      await loadData();
      setEditingId('');
      notify('Note updated.');
    } catch (updateError) {
      notify(updateError.message || 'Unable to update this note.');
    } finally {
      setBusyId('');
    }
  };

  const deleteNote = async (note) => {
    if (!window.confirm(`Delete "${note.title}"? Uploaded files and created notes will be deleted; Google Drive originals remain unchanged.`)) return;
    const id = String(note._id || note.id);
    setBusyId(id);
    try {
      await api.del(`/admin/notes/${id}`);
      await loadData();
      notify('File deleted.');
    } catch (deleteError) {
      notify(deleteError.message || 'Unable to remove this note.');
    } finally {
      setBusyId('');
    }
  };

  const renameFolder = async (folder) => {
    const name = window.prompt('Rename folder', folder.name);
    if (name === null || !name.trim() || name.trim() === folder.name) return;
    setBusyId(folder.id);
    try {
      await api.put(`/admin/folders/${folder.id}`, { name: name.trim() });
      await loadData();
      notify('Folder renamed.');
    } catch (folderError) {
      notify(folderError.message || 'Unable to rename folder.');
    } finally {
      setBusyId('');
    }
  };

  const deleteFolder = async (folder) => {
    if (!window.confirm(`Delete the empty folder "${folder.name}"?`)) return;
    setBusyId(folder.id);
    try {
      await api.del(`/admin/folders/${folder.id}`);
      if (currentFolderId === folder.id) setCurrentFolderId(folder.parentId || 'root');
      await loadData();
      notify('Folder deleted.');
    } catch (folderError) {
      notify(folderError.message || 'Move or delete the folder contents first.');
    } finally {
      setBusyId('');
    }
  };

  if (loading) return <WorkspaceLoading title="Loading notes administration" description="Reading synced notes and MongoDB storage statistics." />;
  if (error && !notes.length) return <EmptyState title="Unable to load note administration" text={error} icon={Notebook} action={<Button onClick={() => { setLoading(true); loadData().catch((loadError) => setError(loadError.message || 'Unable to load note administration data.')).finally(() => setLoading(false)); }}>Try again</Button>} />;

  const mongoUsage = storage?.usagePercent;
  const storageProgress = Number.isFinite(mongoUsage) ? Math.min(mongoUsage, 100) : 0;
  const uploadButtonDisabled = uploadProgress !== null;
  const fileFormVisible = ['file', 'link', 'folder'].includes(formMode);

  return <>
    <PageHeading eyebrow="CONTENT & STORAGE" title="Notes administration" description="Manage academic files, folders, student visibility, and Google Drive resources." actions={<>
      <Button icon={Upload} disabled={uploadButtonDisabled} onClick={() => { setFormFolderId(currentFolderId === 'root' ? '' : currentFolderId); uploadInputRef.current?.click(); }}>{uploadProgress === null ? 'Upload PDF' : `Uploading ${uploadProgress}%`}</Button>
      <input ref={uploadInputRef} type="file" accept=".pdf,application/pdf" hidden onChange={handlePdfSelection} />
      <Button variant="secondary" icon={FolderPlus} onClick={() => { setFormMode('folder'); setFormFolderId(currentFolderId === 'root' ? '' : currentFolderId); }}>Create Folder</Button>
      <Button variant="secondary" icon={FilePlus2} onClick={() => { setFormMode('file'); setFormFolderId(currentFolderId === 'root' ? '' : currentFolderId); }}>Create File</Button>
      <Button variant="secondary" icon={Link2} onClick={() => { setFormMode('link'); setFormFolderId(currentFolderId === 'root' ? '' : currentFolderId); }}>Add Drive Link</Button>
      <Button variant="quiet" icon={RefreshCw} disabled={syncing} onClick={syncNotes}>{syncing ? 'Syncing Drive...' : 'Sync Google Drive'}</Button>
    </>} />
    {uploadProgress !== null && <div className="surface" role="status" style={{ padding: '12px', marginBottom: '12px' }}>
      <strong>Uploading PDF to MongoDB GridFS: {uploadProgress}%</strong>
      <div className="progress-track goal-progress-track"><span style={{ width: `${uploadProgress}%` }} /></div>
    </div>}
    {fileFormVisible && <form className="surface admin-note-create-form" onSubmit={submitForm}>
      <div className="panel-heading"><div><p className="eyebrow">NEW ACADEMIC ITEM</p><h2>{formMode === 'folder' ? 'Create folder' : formMode === 'file' ? 'Create text or Markdown file' : 'Add Google Drive link'}</h2></div></div>
      {formMode === 'folder' ? <label className="form-field"><span>Folder name</span><input value={newFolderName} maxLength={200} required onChange={(event) => setNewFolderName(event.target.value)} placeholder="e.g. Data Structures" /></label> : <>
        <label className="form-field"><span>{formMode === 'file' ? 'File name' : 'Document name'}</span><input value={formMode === 'file' ? newFileName : driveLinkTitle} maxLength={500} required onChange={(event) => formMode === 'file' ? setNewFileName(event.target.value) : setDriveLinkTitle(event.target.value)} placeholder={formMode === 'file' ? 'e.g. Java practical notes' : 'e.g. Java Notes'} /></label>
        {formMode === 'file' ? <>
          <label className="form-field"><span>File format</span><select value={newFileType} onChange={(event) => setNewFileType(event.target.value)}><option value="markdown">Markdown (.md)</option><option value="text">Plain text (.txt)</option></select></label>
          <label className="form-field"><span>Content</span><textarea value={newFileContent} required rows={6} maxLength={1000000} onChange={(event) => setNewFileContent(event.target.value)} placeholder="Write the note content here (up to 1 MB)." /></label>
        </> : <>
          <label className="form-field"><span>Google Drive URL</span><input type="url" value={driveLinkUrl} required onChange={(event) => setDriveLinkUrl(event.target.value)} placeholder="https://drive.google.com/..." /></label>
          <label className="form-field"><span>Description (optional)</span><textarea value={driveLinkDescription} rows={3} maxLength={5000} onChange={(event) => setDriveLinkDescription(event.target.value)} /></label>
        </>}
        <label className="setting-toggle"><span><strong>Visible to students</strong><small>Students can open this item in the Notes page.</small></span><input type="checkbox" checked={newVisible} onChange={() => setNewVisible((visible) => !visible)} /></label>
      </>}
      {formMode !== 'folder' && <label className="form-field"><span>Folder / category</span><select value={formFolderId} onChange={(event) => setFormFolderId(event.target.value)}><option value="">Root folder</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.path}</option>)}</select></label>}
      <div className="heading-actions"><Button disabled={formBusy}>{formBusy ? 'Saving...' : formMode === 'folder' ? 'Create Folder' : 'Save'}</Button><Button type="button" variant="quiet" disabled={formBusy} onClick={closeForm}>Cancel</Button></div>
    </form>}
    <section className="admin-storage-grid" aria-label="MongoDB storage usage">
      <article className="surface admin-storage-card">
        <div className="study-planner-heading"><span className="planner-icon"><Database size={18} /></span><div><p className="eyebrow">MONGODB DATABASE</p><h2>{storage?.databaseName || 'Database information unavailable'}</h2></div></div>
        <div className="admin-storage-values"><span><strong>{formatBytes(storage?.usedBytes)}</strong><small>Database storage used</small></span><span><strong>{storage ? storage.limitBytes ? formatBytes(storage.limitBytes) : 'Not configured' : 'Unavailable'}</strong><small>Application storage limit</small></span><span><strong>{storage ? storage.remainingBytes === null || storage.remainingBytes === undefined ? 'Not configured' : formatBytes(storage.remainingBytes) : 'Unavailable'}</strong><small>Remaining to configured limit</small></span></div>
        <div className="admin-storage-values"><span><strong>{stats?.totalNotes ?? '—'}</strong><small>Stored note records</small></span><span><strong>{storage?.gridFs?.totalFiles ?? '—'}</strong><small>GridFS stored files</small></span><span><strong>{formatBytes(storage?.gridFs?.totalBytes)}</strong><small>GridFS file data</small></span></div>
        <div className="progress-track goal-progress-track"><span style={{ width: `${storageProgress}%` }} /></div>
        <p className={storageError ? 'planner-error' : 'planner-caption'} role={storageError ? 'alert' : undefined}>{storageError || (storage?.quotaSource === 'configured' ? `${mongoUsage}% of the administrator-configured application limit. This is not an Atlas plan quota.` : 'Storage usage is read from MongoDB. Atlas plan capacity is not exposed by MongoDB database statistics; set MONGODB_STORAGE_LIMIT_MB to show an application limit.')}</p>
      </article>
      <article className="surface admin-storage-card">
        <div className="study-planner-heading"><span className="planner-icon planner-icon-amber"><HardDrive size={18} /></span><div><p className="eyebrow">MONGODB FILE STORAGE</p><h2>GridFS buckets</h2></div></div>
        <div className="admin-storage-values"><span><strong>{storage?.gridFs?.academicNotes?.files ?? '—'}</strong><small>Notes PDFs</small></span><span><strong>{formatBytes(storage?.gridFs?.academicNotes?.bytes)}</strong><small>Notes PDF data</small></span><span><strong>{stats?.publicNotes ?? '—'}</strong><small>Visible note items</small></span></div>
        <p className="planner-caption">Uploaded PDFs use the academicNotes GridFS bucket. Note metadata and small text files use MongoDB documents. Google Drive links store metadata only; synced Drive files stay in Drive. Database used storage includes MongoDB collection and index allocation.</p>
      </article>
    </section>
    <div className="table-toolbar">
      <label className="field-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, folder, category or file type" /></label>
      <label className="notes-control"><span className="notes-sort-label">Type</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filter note type"><option value="all">All types</option><option value="pdf">PDF</option><option value="created">Created File</option><option value="driveLink">Google Drive Link</option><option value="folder">Folder</option></select></label>
      <label className="notes-control"><span className="notes-sort-label">Sort</span><select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} aria-label="Sort notes"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="name">Name</option><option value="size">File size</option></select></label>
      <span className="muted-inline">{filteredNotes.length + childFolders.length} items</span>
    </div>
    <div className="table-toolbar">
      <Button variant="quiet" icon={ArrowLeft} disabled={currentFolderId === 'root'} onClick={() => { setCurrentFolderId(currentFolder?.parentId || 'root'); setSearch(''); }}>Back</Button>
      <span className="muted-inline">Folder: {currentFolder?.path || 'Root'}</span>
      {currentFolderId !== 'root' && <Button variant="quiet" onClick={() => { setCurrentFolderId('root'); setSearch(''); }}>Root folder</Button>}
    </div>
    <section className="admin-note-list" aria-label="Manage notes">
      {typeFilter !== 'pdf' && typeFilter !== 'created' && typeFilter !== 'driveLink' && childFolders.map((folder) => <article className="surface admin-note-row" key={folder.id}>
        <span className="notes-folder-icon"><Folder size={20} /></span>
        <button type="button" className="admin-note-folder-open" onClick={() => { setCurrentFolderId(folder.id); setSearch(''); }}><strong>{folder.name}</strong><small>Folder · {folder.fileCount} files · {folder.path}</small></button>
        <div className="admin-note-actions">
          <button type="button" className="icon-button" title="Open folder" aria-label={`Open ${folder.name}`} onClick={() => { setCurrentFolderId(folder.id); setSearch(''); }}><ExternalLink size={16} /></button>
          <button type="button" className="icon-button" title="Rename folder" aria-label={`Rename ${folder.name}`} disabled={busyId === folder.id} onClick={() => renameFolder(folder)}><Pencil size={16} /></button>
          <button type="button" className="icon-button danger-action" title="Delete empty folder" aria-label={`Delete ${folder.name}`} disabled={busyId === folder.id} onClick={() => deleteFolder(folder)}><Trash2 size={16} /></button>
        </div>
      </article>)}
      {filteredNotes.map((note) => {
        const id = String(note._id || note.id);
        const visibleToStudents = note.isPublic === true || note.isPublic === undefined;
        const deleted = Boolean(note.isDeleted);
        return <article className={`surface admin-note-row ${deleted ? 'admin-note-deleted' : ''}`} key={id}>
          <span className={`notes-file-icon notes-file-${note.fileType || 'other'}`}>{note.storageType === 'driveLink' ? <Link2 size={19} /> : <FileText size={19} />}</span>
          <div className="admin-note-copy">
            {editingId === id ? <form className="admin-note-rename" onSubmit={(event) => { event.preventDefault(); updateNote(note, { title: editedTitle }); }}><input autoFocus value={editedTitle} maxLength={500} onChange={(event) => setEditedTitle(event.target.value)} aria-label={`Rename ${note.title}`} /><Button variant="secondary" icon={Save} disabled={busyId === id}>Save</Button><Button type="button" variant="quiet" onClick={() => setEditingId('')}>Cancel</Button></form> : <strong>{note.title || 'Untitled note'}</strong>}
            <small>Type: {note.storageType === 'gridfs' ? 'PDF' : note.storageType === 'mongodb' ? 'Created file' : note.storageType === 'driveLink' ? 'Google Drive link' : note.fileType || 'Drive file'} · Folder: {note.folderPath || note.category || 'Root'}</small>
            <small>{note.size ? `Size: ${formatBytes(note.size)} · ` : ''}Created: {note.driveCreatedAt || note.createdAt ? new Date(note.driveCreatedAt || note.createdAt).toLocaleDateString() : '—'} · {deleted ? 'Removed from portal' : note.isActive === false ? 'Not currently in Drive' : visibleToStudents ? 'Visible to students' : 'Hidden from students'}</small>
          </div>
          {!deleted && note.isActive !== false && <div className="admin-note-actions">
            <button type="button" className="icon-button" title={note.storageType === 'driveLink' ? 'Open Google Drive link' : 'Open or view file'} aria-label={`Open ${note.title}`} onClick={() => openNote(note)}><ExternalLink size={16} /></button>
            {note.storageType !== 'driveLink' && <button type="button" className="icon-button" title="Download file" aria-label={`Download ${note.title}`} onClick={() => downloadNote(note)}><Download size={16} /></button>}
            <button type="button" className="icon-button" title="Rename note" aria-label={`Rename ${note.title}`} onClick={() => { setEditingId(id); setEditedTitle(note.title || ''); }}><Pencil size={16} /></button>
            <button type="button" className="icon-button" title={visibleToStudents ? 'Hide from students' : 'Publish to students'} aria-label={visibleToStudents ? 'Hide from students' : 'Publish to students'} disabled={busyId === id} onClick={() => updateNote(note, { isPublic: !visibleToStudents })}>{visibleToStudents ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            <select className="admin-note-move-select" value="" aria-label={`Move ${note.title}`} disabled={busyId === id} onChange={(event) => moveNote(note, event.target.value)}><option value="">Move to...</option><option value="root">Root folder</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.path}</option>)}</select>
            <button type="button" className="icon-button" title="Copy link" aria-label={`Copy link for ${note.title}`} onClick={() => copyNoteLink(note)}><Link2 size={16} /></button>
            <button type="button" className="icon-button danger-action" title="Delete file" aria-label={`Delete ${note.title}`} disabled={busyId === id} onClick={() => deleteNote(note)}><Trash2 size={16} /></button>
          </div>}
        </article>;
      })}
      {!filteredNotes.length && !childFolders.length && <EmptyState title="No notes found" text={search ? 'Try another search.' : currentFolderId === 'root' ? 'Upload a PDF, create a file or folder, add a Drive link, or sync Google Drive.' : 'This folder is empty.'} icon={Notebook} />}
    </section>
  </>;
}

function AdminStudentPhoto({ student, size = '' }) {
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoUnavailable, setPhotoUnavailable] = useState(false);
  const studentId = String(student?._id || student?.id || '');
  const initials = (student?.name || 'Student').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setPhotoUrl('');
    setPhotoUnavailable(false);
    if (!studentId || !student?.profilePhotoId) return () => { active = false; };

    api.getBlob(`/admin/students/${studentId}/photo`)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPhotoUrl(objectUrl);
      })
      .catch(() => {
        if (active) setPhotoUnavailable(true);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [studentId, student?.profilePhotoId]);

  return <span className={`admin-student-photo ${size}`.trim()} title={photoUnavailable ? 'Profile photo unavailable' : student?.name || 'Student'}>{photoUrl ? <img src={photoUrl} alt={`${student?.name || 'Student'} profile`} /> : initials || 'S'}</span>;
}

function AdminStudentDirectory() {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/admin/students')
      .then((response) => {
        if (active) setStudents(response?.data?.students || []);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Unable to load student accounts.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const visibleStudents = students.filter((student) => (
    `${student.name} ${student.email} ${student.studentId} ${student.departmentId?.name || ''}`.toLowerCase().includes(search.trim().toLowerCase())
  ));

  if (loading) return <WorkspaceLoading title="Loading student directory" description="Fetching student names, academic details and profile photos." />;
  if (error && !students.length) return <EmptyState title="Unable to load students" text={error} icon={Users} />;

  return <>
    <PageHeading eyebrow="PEOPLE" title="Students" description="Browse all registered students, their photos and academic assignments." />
    <div className="table-toolbar"><label className="field-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, roll number..." /></label><span className="muted-inline">{visibleStudents.length} of {students.length} students</span></div>
    {visibleStudents.length ? <section className="admin-student-grid" aria-label="Student directory">
      {visibleStudents.map((student) => <button className="surface admin-student-card" type="button" key={student._id} onClick={() => setSelectedStudent(student)}>
        <AdminStudentPhoto student={student} />
        <span className="admin-student-card-copy"><strong>{student.name || 'Unnamed student'}</strong><small>{student.email || 'No email'}</small><small>{student.studentId || 'Roll number not set'}</small></span>
        <ChevronRight size={17} />
      </button>)}
    </section> : <EmptyState title="No students found" text={search ? 'Try another search term.' : 'Student accounts will appear here after registration.'} icon={Users} />}
    {selectedStudent && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedStudent(null); }}><section className="admin-modal admin-student-dialog" role="dialog" aria-modal="true" aria-labelledby="student-detail-title">
      <div className="admin-modal-header"><div><p className="eyebrow">STUDENT PROFILE</p><h2 id="student-detail-title">{selectedStudent.name || 'Student'}</h2></div><button type="button" className="icon-button" aria-label="Close student profile" onClick={() => setSelectedStudent(null)}><X size={17} /></button></div>
      <div className="admin-student-profile"><AdminStudentPhoto student={selectedStudent} size="large" /><div className="profile-fields">
        <div className="profile-field"><span>Full name</span><strong>{selectedStudent.name || 'Not provided'}</strong></div>
        <div className="profile-field"><span>Email</span><strong>{selectedStudent.email || 'Not provided'}</strong></div>
        <div className="profile-field"><span>Roll number</span><strong>{selectedStudent.studentId || 'Not provided'}</strong></div>
        <div className="profile-field"><span>Department</span><strong>{selectedStudent.departmentId?.name || 'Not assigned'}</strong></div>
        <div className="profile-field"><span>Year / semester</span><strong>{[selectedStudent.yearId?.name, selectedStudent.semesterId?.name].filter(Boolean).join(' · ') || 'Not assigned'}</strong></div>
        <div className="profile-field"><span>Status</span><strong>{selectedStudent.status || 'Not available'}</strong></div>
      </div></div>
    </section></div>}
  </>;
}

function MyraaPage() {
  return <PageHeading eyebrow="YOUR LEARNING COMPANION" title="Myraa voice assistant" description="Your existing Myraa assistant, connected to this student workspace." />;
}

function ProfilePage({ user, role, notify }) {
  const { setUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [catalog, setCatalog] = useState({ departments: [], years: [], semesters: [] });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [removePhoto, setRemovePhoto] = useState(false);
  const [fields, setFields] = useState({
    name: user?.name || '',
    studentId: user?.studentId || '',
    departmentId: user?.departmentId?._id || user?.departmentId || '',
    yearId: user?.yearId?._id || user?.yearId || '',
    semesterId: user?.semesterId?._id || user?.semesterId || '',
    academicYear: user?.academicYear || ''
  });
  const profilePhotoUrl = useProfilePhoto(user);

  useEffect(() => {
    if (!open || role !== 'student') return;

    let active = true;
    const loadCatalog = async () => {
      try {
        const [departmentResponse, yearResponse, semesterResponse] = await Promise.all([
          api.get('/departments', { status: 'active' }),
          api.get('/years', { status: 'active' }),
          api.get('/semesters', { status: 'active' })
        ]);

        if (!active) return;
        setCatalog({
          departments: departmentResponse?.data?.departments || [],
          years: yearResponse?.data?.years || [],
          semesters: semesterResponse?.data?.semesters || []
        });
      } catch {
        if (active) {
          setError('Unable to load department, year and semester options.');
        }
      }
    };

    loadCatalog();
    return () => { active = false; };
  }, [open, role]);

  useEffect(() => {
    if (!open) return;
    setFields({
      name: user?.name || '',
      studentId: user?.studentId || '',
      departmentId: user?.departmentId?._id || user?.departmentId || '',
      yearId: user?.yearId?._id || user?.yearId || '',
      semesterId: user?.semesterId?._id || user?.semesterId || '',
      academicYear: user?.academicYear || ''
    });
    setPhotoFile(null);
    setRemovePhoto(false);
    setPhotoPreview('');
    setStatusMessage('');
    setError('');
  }, [user, open]);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const assignedSubjects = (user?.assignedSubjects || []).map((subject) => subject?.name || subject).filter(Boolean).join(', ');
  const details = role === 'student' ? [
    ['Full name', user?.name], ['Student ID / Roll number', user?.studentId], ['Email', user?.email],
    ['Department', user?.departmentId?.name || user?.departmentId],
    ['Year', user?.yearId?.name || user?.yearId], ['Semester', user?.semesterId?.name || user?.semesterId], ['Academic year', user?.academicYear]
  ] : role === 'teacher' ? [
    ['Full name', user?.name], ['Employee ID', user?.employeeId], ['Email', user?.email],
    ['Department', user?.departmentId?.name || user?.departmentId], ['Assigned subjects', assignedSubjects]
  ] : [['Full name', user?.name], ['Email', user?.email], ['Role', 'Administrator']];

  const filteredSemesters = catalog.semesters.filter((semester) => String(semester.yearId?._id || semester.yearId) === String(fields.yearId));
  const updateField = (key) => (event) => {
    const value = event.target.value;
    setFields((current) => ({
      ...current,
      [key]: value,
      ...(key === 'yearId' ? { semesterId: '' } : {})
    }));
  };

  const handlePhotoSelection = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isValidType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || ['.jpg', '.jpeg', '.png', '.webp'].includes(file.name.toLowerCase().slice(file.name.lastIndexOf('.')));
    if (!isValidType) {
      setError('Please upload a JPG, JPEG, PNG or WEBP image.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Profile photo must be 5 MB or smaller.');
      return;
    }

    setError('');
    setRemovePhoto(false);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
    setPhotoFile(file);
  };

  const saveProfile = async () => {
    setSaving(true);
    setError('');
    setStatusMessage('');

    try {
      if (!fields.name.trim() || fields.name.trim().length < 2) {
        throw new Error('Please enter a valid full name.');
      }
      if (!fields.studentId.trim()) {
        throw new Error('Student ID / roll number is required.');
      }
      if (!fields.departmentId || !fields.yearId || !fields.semesterId) {
        throw new Error('Please select a valid active department, year and semester.');
      }

      const selectedSemester = catalog.semesters.find((semester) => String(semester._id) === String(fields.semesterId));
      if (!selectedSemester || String(selectedSemester.yearId?._id || selectedSemester.yearId) !== String(fields.yearId)) {
        throw new Error('Selected semester does not belong to the selected year.');
      }

      const formData = new FormData();
      formData.append('name', fields.name.trim());
      formData.append('studentId', fields.studentId.trim());
      formData.append('departmentId', fields.departmentId);
      formData.append('yearId', fields.yearId);
      formData.append('semesterId', fields.semesterId);
      formData.append('academicYear', fields.academicYear);
      if (removePhoto) formData.append('removePhoto', 'true');
      if (photoFile) formData.append('photo', photoFile);

      const response = await studentService.updateProfile(formData);
      const nextUser = response?.data?.user || user;
      setUser(nextUser);
      setOpen(false);
      setStatusMessage('Profile updated successfully');
      if (notify) notify('Profile updated successfully');
    } catch (saveError) {
      setError(saveError.message || 'Unable to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => {
    if (saving) return;
    setOpen(false);
    setError('');
    setStatusMessage('');
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
      setPhotoPreview('');
    }
    setPhotoFile(null);
    setRemovePhoto(false);
  };

  return <>
    <PageHeading eyebrow="ACCOUNT" title="My profile" description="Your account details and academic assignment." actions={role === 'student' && <Button variant="secondary" icon={Pencil} onClick={() => setOpen(true)}>Edit profile</Button>} />
    <section className="surface profile-card">
      <div className="profile-banner">
        <ProfileAvatar name={user?.name} photoUrl={profilePhotoUrl} size="lg" />
        <div>
          <h2>{user?.name}</h2>
          <p>{roleNames[role]} · {user?.email}</p>
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
      {statusMessage && !open && <p className="form-success">{statusMessage}</p>}
      <div className="profile-fields">
        {details.map(([label, value]) => <div className="profile-field" key={label}><span>{label}</span><strong>{value || 'Not provided'}</strong></div>)}
      </div>
    </section>
    {open && role === 'student' && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) closeModal(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="student-profile-modal-title" className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">EDIT PROFILE</p>
            <h2 id="student-profile-modal-title" className="text-xl font-bold text-slate-800">Update your profile</h2>
          </div>
          <button type="button" className="icon-button" onClick={closeModal} aria-label="Close profile editor" disabled={saving}><X size={17} /></button>
        </div>
        <div className="grid gap-5 md:grid-cols-[180px_1fr]">
          <div className="space-y-3">
            <div className="flex justify-center">
              <ProfileAvatar name={fields.name || user?.name} photoUrl={removePhoto ? '' : (photoPreview || profilePhotoUrl)} size="lg" />
            </div>
            <p className="text-center text-xs text-slate-500">Profile photo is optional.</p>
            <label className="button button-secondary w-full justify-center cursor-pointer">
              <input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoSelection} />
              {photoFile || profilePhotoUrl ? 'Change photo' : 'Upload photo'}
            </label>
            {(photoFile || profilePhotoUrl) && <button type="button" className="button button-secondary w-full justify-center" onClick={() => { setRemovePhoto(true); setPhotoFile(null); if (photoPreview) { URL.revokeObjectURL(photoPreview); setPhotoPreview(''); } }}>Remove photo</button>}
          </div>
          <div className="space-y-4">
            <label className="form-field"><span>Full name</span><input value={fields.name} onChange={updateField('name')} placeholder="Enter your full name" /></label>
            <label className="form-field"><span>Student ID / Roll number</span><input value={fields.studentId} onChange={updateField('studentId')} placeholder="Enter student ID / roll number" /></label>
            <label className="form-field"><span>Email</span><input value={user?.email || ''} readOnly aria-readonly="true" placeholder="Email is managed through your account authentication." /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="form-field"><span>Department</span><select value={fields.departmentId} onChange={updateField('departmentId')}><option value="">Select department</option>{catalog.departments.map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}</select></label>
              <label className="form-field"><span>Year</span><select value={fields.yearId} onChange={updateField('yearId')}><option value="">Select year</option>{catalog.years.map((year) => <option key={year._id} value={year._id}>{year.name}</option>)}</select></label>
            </div>
            <label className="form-field"><span>Semester</span><select value={fields.semesterId} onChange={updateField('semesterId')}><option value="">Select semester</option>{filteredSemesters.map((semester) => <option key={semester._id} value={semester._id}>{semester.name}</option>)}</select></label>
            <label className="form-field"><span>Academic year</span><input value={fields.academicYear} onChange={updateField('academicYear')} placeholder="e.g. 2026-27" /></label>
            {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" className="button button-secondary" onClick={closeModal} disabled={saving}>Cancel</button>
              <button type="button" className="button button-primary" onClick={saveProfile} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
            </div>
          </div>
        </div>
      </section>
    </div>}
  </>;
}

function TeacherDashboard({ practicalList, user, subjectList = [] }) {
  const assignedSubjects = subjectList.map(normalizeSubjectFromApi).filter(Boolean);
  const subjects = assignedSubjects;
  const owned = practicalList.map(normalizePracticalFromApi).filter(Boolean);
  return <><PageHeading eyebrow="FACULTY WORKSPACE" title={`Welcome, ${user?.name || 'Teacher'}`} description="Manage your course material and guide students through their practical work." actions={<Link to="/teacher/practicals/add" className="button button-primary"><Plus size={16} />Add practical</Link>} /><div className="stat-grid"><Stat label="Assigned subjects" value={assignedSubjects.length} note="Current assignments" icon={BookOpen} /><Stat label="Total practicals" value={owned.length} note="Across your subjects" icon={ClipboardList} tone="green" /><Stat label="Published" value={owned.filter((item) => item.published).length} note="Visible to students" icon={CheckCircle2} tone="blue" /><Stat label="Drafts" value={owned.filter((item) => !item.published).length} note="Awaiting review" icon={FileText} tone="amber" /></div><div className="dashboard-columns"><section className="surface dashboard-panel"><div className="panel-heading"><div><p className="eyebrow">CONTENT ACTIVITY</p><h2>Recently updated</h2></div><Link to="/teacher/practicals" className="text-link">All practicals <ArrowRight size={14} /></Link></div>{owned.length ? owned.slice(0, 4).map((item) => <div className="activity-row" key={item.id}><span className="activity-file"><FileText size={17} /></span><div><strong>{item.title}</strong><small>{subjects.find((subject) => subject.id === item.subjectId)?.name} · Practical {number(item.practicalNumber)}</small></div><Status>{item.published ? 'Published' : 'Draft'}</Status></div>) : <EmptyState title="No practicals yet" text="Your published and draft practicals will appear here." icon={ClipboardList} />}</section><section className="surface dashboard-panel"><div className="panel-heading"><div><p className="eyebrow">YOUR COURSES</p><h2>Assigned subjects</h2></div></div>{assignedSubjects.length ? assignedSubjects.map((subject) => <Link to="/teacher/subjects" className="course-row" key={subject.id}><span className="subject-monogram">{subject.name.slice(0, 2).toUpperCase()}</span><span><strong>{subject.name}</strong><small>{subject.code}</small></span><ChevronRight size={16} /></Link>) : <EmptyState title="No subjects assigned" text="Your college will assign subjects to your account." icon={BookOpen} />}</section></div><DashboardSharedNotes role="teacher" /></>;
}

function TeacherSubjects({ subjectList = [], onAssigned, notify }) {
  const assigned = subjectList.map(normalizeSubjectFromApi).filter(Boolean);
  const [dialogOpen, setDialogOpen] = useState(false);

  return <>
    <PageHeading eyebrow="FACULTY WORKSPACE" title="My subjects" description="Manage your teaching assignments across departments and year groups." actions={<Button icon={Plus} onClick={() => setDialogOpen(true)}>Add subject</Button>} />
    {assigned.length ? <div className="subject-grid">{assigned.map((subject) => <article className="subject-tile teacher-subject" key={subject.id}><div className="tile-top"><span className="subject-monogram">{subject.name.slice(0, 2).toUpperCase()}</span><span className="tile-code">{subject.code}</span></div><h3>{subject.name}</h3><p>{subject.description || 'Practical materials and class details for this subject.'}</p><div className="tile-footer"><span><ClipboardList size={15} />{subject.practicalCount} practicals</span><span className="muted-inline">{subject.departmentName || 'Department'} · {subject.yearName || 'Year'} · {subject.semesterName || 'Semester'}</span></div></article>)}</div> : <EmptyState title="No assigned subjects" text="Add an existing subject or create a new subject for its class." action={<Button icon={Plus} onClick={() => setDialogOpen(true)}>Add subject</Button>} />}
    {dialogOpen && <TeacherSubjectModal onClose={() => setDialogOpen(false)} onSaved={onAssigned} notify={notify} />}
  </>;
}

function TeacherPracticalList({ practicalList, subjectList = [], subjectIds, submissionList = [], onDelete, onTogglePublish, onRefresh, notify }) {
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const refreshClasswork = async () => {
    try {
      await onRefresh();
      notify('Classwork status refreshed.');
    } catch (error) {
      notify(error.message || 'Could not refresh classwork status.');
    }
  };
  const subjects = subjectList.map(normalizeSubjectFromApi).filter(Boolean);
  const rows = (practicalList || []).map(normalizePracticalFromApi).filter(Boolean).filter((item) => subjectIds.has(String(item.subjectId))).filter((item) => (filter === 'All' || (filter === 'Published' ? item.published : !item.published)) && (item.title || '').toLowerCase().includes(query.toLowerCase()));
  return <><PageHeading eyebrow="CONTENT MANAGEMENT" title="Practicals" description="Publish practicals, monitor student submissions and review classwork." actions={<><Button variant="secondary" icon={RefreshCw} onClick={refreshClasswork}>Refresh classwork</Button><Link to="/teacher/practicals/add" className="button button-primary"><Plus size={16} />Add practical</Link></>} /><div className="table-toolbar"><label className="field-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search practicals" /></label><div className="segmented-control">{['All', 'Published', 'Drafts'].map((value) => <button key={value} className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{value}</button>)}</div></div><div className="surface data-table-wrap"><table className="data-table"><thead><tr><th>Practical</th><th>Subject</th><th>Submissions</th><th>Status</th><th>Last updated</th><th /></tr></thead><tbody>{rows.map((item) => { const submissions = submissionList.filter((entry) => recordId(entry.practicalId) === String(item.id)); const waiting = submissions.filter((entry) => entry.status === 'Submitted').length; return <tr key={item.id}><td><span className="table-title"><b>{number(item.practicalNumber)}</b><span><strong>{item.title}</strong><small>Practical {number(item.practicalNumber)}</small></span></span></td><td>{subjects.find((subject) => subject.id === item.subjectId)?.name || item.subjectId}</td><td><strong>{submissions.length}</strong><small>{waiting} awaiting review</small></td><td><Status>{item.published ? 'Published' : 'Draft'}</Status></td><td>{item.updatedAt || '—'}</td><td><div className="table-actions"><button className="icon-button" title="Open classroom" onClick={() => navigate(`/teacher/practicals/${item.id}`)}><Users size={15} /></button><button className="icon-button" title="Edit practical" onClick={() => navigate(`/teacher/practicals/${item.id}/edit`)}><Pencil size={15} /></button><button className="icon-button" title={item.published ? 'Unpublish' : 'Publish'} onClick={() => onTogglePublish(item)}><CheckCircle2 size={15} /></button><button className="icon-button danger-action" title="Delete practical" onClick={() => { if (window.confirm(`Delete ${item.title}?`)) onDelete(item.id); }}><X size={15} /></button></div></td></tr>; })}</tbody></table>{!rows.length && <EmptyState title="No practicals found" text="Try another search or create a new practical." icon={ClipboardList} />}</div></>;
}

function TeacherSubmissionReview({ submission, evaluation, onSave }) {
  const [fields, setFields] = useState({ maximumMarks: 100, passingMarks: 35, marksObtained: '', remarks: '', requestResubmission: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setFields({
      maximumMarks: evaluation?.maximumMarks ?? 100,
      passingMarks: evaluation?.passingMarks ?? 35,
      marksObtained: evaluation?.marksObtained ?? '',
      remarks: evaluation?.remarks ?? submission.remarks ?? '',
      requestResubmission: submission.status === 'Resubmission Required'
    });
  }, [evaluation, submission]);
  const update = (key) => (event) => setFields((current) => ({ ...current, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
  const submitReview = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSave({ submissionId: recordId(submission), ...fields });
    } catch (saveError) {
      setError(saveError.message || 'Could not save the evaluation.');
    } finally {
      setSaving(false);
    }
  };
  return <article className="surface dashboard-panel">
    <div className="panel-heading"><div><p className="eyebrow">ATTEMPT {submission.attempt}</p><h3>{submission.studentId?.name || 'Student'}</h3><p className="page-description">{submission.studentId?.email || ''} · {new Date(submission.submissionDate || submission.createdAt).toLocaleString()}</p></div><Status>{submission.status}</Status></div>
    {submission.content && <p>{submission.content}</p>}
    {submission.submissionFile?.gridFsFileId && <Button type="button" variant="secondary" icon={Download} onClick={() => downloadSubmissionFile(submission).catch((downloadError) => setError(downloadError.message || 'Could not download this submission.'))}>Download student PDF</Button>}
    {evaluation && <p className="review-note">Current result: {evaluation.marksObtained}/{evaluation.maximumMarks} · {evaluation.resultStatus}</p>}
    <form className="form-grid" onSubmit={submitReview}>
      <label className="form-field"><span>Maximum marks</span><input type="number" min="1" step="any" required value={fields.maximumMarks} onChange={update('maximumMarks')} /></label>
      <label className="form-field"><span>Passing marks</span><input type="number" min="0" step="any" required value={fields.passingMarks} onChange={update('passingMarks')} /></label>
      <label className="form-field"><span>Marks obtained</span><input type="number" min="0" step="any" required value={fields.marksObtained} onChange={update('marksObtained')} /></label>
      <label className="form-field form-field-wide"><span>Feedback / remarks</span><textarea rows="3" value={fields.remarks} onChange={update('remarks')} placeholder="Share feedback with the student" /></label>
      <label className="setting-toggle form-field-wide"><span><strong>Request resubmission</strong><small>Allow the student to submit another attempt after this review.</small></span><input type="checkbox" checked={fields.requestResubmission} onChange={update('requestResubmission')} /></label>
      {error && <p className="admin-modal-error form-field-wide" role="alert">{error}</p>}
      <div className="admin-modal-actions form-field-wide"><Button type="submit" disabled={saving}>{saving ? 'Saving...' : evaluation ? 'Update evaluation' : 'Save evaluation'}</Button></div>
    </form>
  </article>;
}

function TeacherPracticalDetail({ practical, onTogglePublish, onRefresh, notify }) {
  const [submissions, setSubmissions] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    Promise.all([submissionService.getByPractical(practical.id), evaluationService.getByPractical(practical.id)])
      .then(([submissionResponse, evaluationResponse]) => {
        if (!active) return;
        setSubmissions(submissionResponse?.data?.submissions || []);
        setEvaluations(evaluationResponse?.data?.evaluations || []);
      })
      .catch((error) => {
        if (active) setLoadError(error.message || 'Unable to load classroom submissions.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [practical.id, reloadKey]);
  const saveEvaluation = async (payload) => {
    await evaluationService.save(payload);
    setReloadKey((key) => key + 1);
    try {
      await onRefresh();
      notify(payload.requestResubmission ? 'Evaluation saved; the student may resubmit.' : 'Evaluation saved successfully.');
    } catch (error) {
      notify(`Evaluation saved, but class totals could not be refreshed: ${error.message || 'please refresh the practical list.'}`);
    }
  };
  const waiting = submissions.filter((entry) => entry.status === 'Submitted').length;
  const guideDetails = [
    ['Aim', practical.aim],
    ['About', practical.about],
    ['Requirements', practical.requirements],
    ['Concept / theory', practical.concept],
    ['Procedure', practical.procedure],
    ['Task', practical.task],
    ['Expected output', practical.expectedOutput],
    ['Important points', practical.importantPoints],
    ['Viva questions', practical.vivaQuestions]
  ].filter(([, value]) => Array.isArray(value) ? value.some((line) => String(line).trim()) : String(value || '').trim());
  return <>
    <PageHeading eyebrow="PRACTICAL CLASSROOM" title={practical.title} description={`Practical ${number(practical.practicalNumber)} · Review student work and return marks with feedback.`} actions={<><Link to={`/teacher/practicals/${practical.id}/edit`} className="button button-secondary"><Pencil size={15} />Edit practical</Link><Button variant="secondary" icon={Download} onClick={() => pdfService.download(practical.pdfId).catch((error) => notify(error.message || 'Could not download the original PDF.'))} disabled={!practical.pdfId}>Original PDF</Button><Button onClick={() => onTogglePublish(practical)}>{practical.published ? 'Unpublish' : 'Publish'}</Button></>} />
    <div className="stat-grid stat-grid-small"><Stat label="Student attempts" value={submissions.length} icon={Users} /><Stat label="Awaiting review" value={waiting} icon={Clock3} tone="amber" /><Stat label="Evaluated" value={evaluations.length} icon={CheckCircle2} tone="green" /></div>
    {guideDetails.length > 0 && <section className="surface practical-preview"><h2>Student learning guide</h2>{guideDetails.map(([label, value]) => <p key={label}><strong>{label}</strong><br />{Array.isArray(value) ? value.filter((line) => String(line).trim()).join('\n') : value}</p>)}</section>}
    {loading ? <EmptyState title="Loading classroom..." text="Retrieving student submissions and evaluations." icon={Activity} /> : loadError ? <EmptyState title="Unable to load classroom" text={loadError} icon={Activity} action={<Button onClick={() => setReloadKey((key) => key + 1)}>Try again</Button>} /> : submissions.length ? <div className="submission-history">{submissions.map((submission) => <TeacherSubmissionReview key={recordId(submission)} submission={submission} evaluation={evaluations.find((entry) => recordId(entry.submissionId) === recordId(submission))} onSave={saveEvaluation} />)}</div> : <EmptyState title="No student work yet" text="Published practicals will show student submissions here as they arrive." icon={ClipboardList} />}
  </>;
}

function TeacherPracticalForm({ onSave, practicalList, notify, practicalId, isEdit = false }) {
  const original = practicalList.find((item) => item.id === practicalId);
  const [fields, setFields] = useState({ subjectId: original?.subjectId || '', departmentId: original?.departmentId || '', yearId: original?.yearId || '', semesterId: original?.semesterId || '', practicalNumber: original?.practicalNumber || '', title: original?.title || '', aim: original?.aim || '', about: original?.about || '', requirements: original?.requirements?.join('\n') || '', concept: original?.concept || '', procedure: original?.procedure?.join('\n') || '', task: original?.task || '', expectedOutput: original?.expectedOutput || '', importantPoints: original?.importantPoints?.join('\n') || '', vivaQuestions: original?.vivaQuestions?.join('\n') || '' });
  const [fileName, setFileName] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const navigate = useNavigate();
  const update = (key) => (event) => setFields((current) => ({ ...current, [key]: event.target.value }));
  const textField = (key, label, multiline = false) => <label className={`form-field ${multiline ? 'form-field-wide' : ''}`}><span>{label}</span>{multiline ? <textarea rows={key === 'procedure' ? 4 : 3} value={fields[key]} onChange={update(key)} placeholder={`Enter ${label.toLowerCase()}`} /> : <input value={fields[key]} onChange={update(key)} placeholder={`Enter ${label.toLowerCase()}`} />}</label>;
  const analyze = () => notify('Use the database-connected practical editor to analyze its uploaded PDF.');
  const save = () => notify('This legacy editor is disabled. Use the database-connected practical editor.');
  return <><PageHeading eyebrow="PRACTICAL EDITOR" title={isEdit ? 'Edit practical' : 'Add practical'} description="Add a source PDF, review the generated learning guide and publish when ready." /><div className="editor-grid"><section className="surface editor-panel"><div className="panel-heading"><div><p className="eyebrow">COURSE DETAILS</p><h2>Practical information</h2></div></div><div className="form-grid"><label className="form-field"><span>Department</span><input value={fields.departmentId} onChange={update('departmentId')} placeholder="Enter department ID" /></label><label className="form-field"><span>Year</span><input value={fields.yearId} onChange={update('yearId')} placeholder="Enter year ID" /></label><label className="form-field"><span>Semester</span><input value={fields.semesterId} onChange={update('semesterId')} placeholder="Enter semester ID" /></label><label className="form-field"><span>Subject ID</span><input value={fields.subjectId} onChange={update('subjectId')} placeholder="Enter assigned subject ID" /></label><label className="form-field"><span>Practical number</span><input type="number" min="1" value={fields.practicalNumber} onChange={update('practicalNumber')} placeholder="Enter practical number" /></label>{textField('title', 'Practical title')}</div><div className="upload-block"><div><p className="eyebrow">ORIGINAL SOURCE</p><h3>Upload practical PDF</h3><p>The uploaded original stays unchanged. Generated content is a separate draft for your review.</p></div><label className="upload-drop"><input type="file" accept="application/pdf" onChange={(event) => setFileName(event.target.files?.[0]?.name || '')} /><FilePlus2 size={21} /><strong>{fileName || 'Choose a PDF file'}</strong><span>PDF only · up to 20 MB</span></label><Button variant="secondary" onClick={analyze} disabled={analyzing}>{analyzing ? <><span className="spinner" />Reading PDF...</> : <><Sparkles size={15} />{analyzed ? 'Analyze again' : 'Analyze PDF'}</>}</Button>{analyzing && <p className="analysis-status">Reading the PDF · Preparing a teacher-review draft</p>}</div></section><section className="surface editor-panel generated-panel"><div className="panel-heading"><div><p className="eyebrow">TEACHER REVIEW</p><h2>Generated practical information</h2></div><Status>{analyzed ? 'Ready for review' : 'Not analyzed'}</Status></div><p className="review-note"><ShieldCheck size={16} /> Generated fields are editable. Review everything before publishing.</p><div className="form-grid">{textField('aim', 'Aim', true)}{textField('about', 'About this practical', true)}{textField('requirements', 'Requirements', true)}{textField('concept', 'Concept / theory', true)}{textField('procedure', 'Step-by-step procedure', true)}{textField('task', 'Practical task', true)}{textField('expectedOutput', 'Expected output', true)}{textField('importantPoints', 'Important points', true)}{textField('vivaQuestions', 'Viva questions', true)}</div><div className="editor-actions"><Button variant="secondary" onClick={() => save(false)}>Save draft</Button><Button variant="secondary" onClick={() => notify('Preview is available after saving this practical.')}>Preview</Button><Button onClick={() => save(true)} icon={CheckCircle2}>Publish practical</Button></div></section></div></>;
}

function TeacherStudents({ studentList = [] }) {
  return <><PageHeading eyebrow="CLASS ROSTER" title="Students" description="Students registered in your department." />{studentList.length ? <div className="surface data-table-wrap"><table className="data-table"><thead><tr><th>Student</th><th>Roll number</th><th>Department</th><th>Year / semester</th></tr></thead><tbody>{studentList.map((item) => <tr key={item._id}><td><span className="person-cell"><span className="avatar">{item.name?.split(' ').map((part) => part[0]).join('') || 'S'}</span><span><strong>{item.name}</strong><small>{item.email}</small></span></span></td><td>{item.studentId || 'Not provided'}</td><td>{item.departmentId?.name || 'Not assigned'}</td><td>{[item.yearId?.name, item.semesterId?.name].filter(Boolean).join(' · ') || 'Not assigned'}</td></tr>)}</tbody></table></div> : <EmptyState title="No students registered" text="Student accounts will appear here after registration." icon={Users} />}</>;
}

function AdminDashboard({ practicalList, teacherList = [], studentList = [], catalog, subjectList = [], adminNotifications = [] }) {
  const departments = catalog.departments;
  const years = catalog.years;
  const semesters = catalog.semesters;
  const subjects = subjectList;
  const teachers = teacherList;
  const students = studentList;
  const latestPracticals = [...practicalList]
    .sort((left, right) => {
      const leftUpdated = Date.parse(left.updatedAt || left.createdAt || '') || 0;
      const rightUpdated = Date.parse(right.updatedAt || right.createdAt || '') || 0;
      return rightUpdated - leftUpdated;
    })
    .slice(0, 5);
  const quickAccess = [
    ['Departments', '/admin/departments', Building2, departments.length],
    ['Academic years', '/admin/years', GraduationCap, years.length],
    ['Semesters', '/admin/semesters', Activity, semesters.length],
    ['Subjects', '/admin/subjects', BookOpen, subjects.length],
    ['Teachers', '/admin/teachers', Users, teachers.length],
    ['Students', '/admin/students', GraduationCap, students.length],
    ['Practicals', '/admin/practicals', ClipboardList, practicalList.length],
    ['Notes', '/admin/notes', Notebook, 'Manage']
  ];
  return <>
    <PageHeading eyebrow="COLLEGE ADMINISTRATION" title="Administration overview" description="A live view of academic structure, accounts, and practical content." actions={<Link to="/admin/subjects" className="button button-secondary"><Plus size={16} />Add subject</Link>} />
    <div className="stat-grid admin-stat-grid">
      <Stat label="Departments" value={departments.length} note="Configured records" icon={Building2} />
      <Stat label="Academic years" value={years.length} note="Configured records" icon={GraduationCap} tone="green" />
      <Stat label="Semesters" value={semesters.length} note="Configured records" icon={Activity} tone="blue" />
      <Stat label="Teachers" value={teachers.length} note="Registered accounts" icon={Users} tone="green" />
      <Stat label="Students" value={students.length} note="Registered accounts" icon={GraduationCap} tone="blue" />
      <Stat label="Subjects" value={subjects.length} note="Configured records" icon={BookOpen} tone="amber" />
      <Stat label="Practicals" value={practicalList.length} note="Configured records" icon={ClipboardList} tone="slate" />
    </div>
    <div className="admin-dashboard-columns">
      <section className="surface dashboard-panel">
        <div className="panel-heading"><div><p className="eyebrow">TEACHER UPDATES</p><h2>Recent activity</h2></div><Link className="text-link" to="/admin/notifications">View all <ArrowRight size={15} /></Link></div>
        {adminNotifications.length ? <div className="admin-recent-list">{adminNotifications.slice(0, 5).map((item) => <div className={`admin-recent-row ${item.read ? '' : 'admin-recent-unread'}`} key={item._id}><span className="admin-recent-icon"><Activity size={17} /></span><span className="admin-recent-copy"><strong>{item.message}</strong><small>{item.actorId?.name || 'Teacher'} · {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Recently'}</small></span></div>)}</div> : <EmptyState title="No teacher activity yet" text="Subject assignments, new subjects and practical updates from teachers will appear here." icon={Activity} />}
      </section>
      <section className="surface dashboard-panel"><div className="panel-heading"><div><p className="eyebrow">ACADEMIC STRUCTURE</p><h2>Quick access</h2></div></div>{quickAccess.map(([label, to, Icon, count]) => <Link className="quick-row" to={to} key={to}><span><Icon size={17} /></span><strong>{label}</strong><small>{typeof count === 'number' ? `${count} records` : count}</small><ChevronRight size={16} /></Link>)}</section>
    </div>
    {latestPracticals.length > 0 && <section className="surface dashboard-panel admin-latest-practicals"><div className="panel-heading"><div><p className="eyebrow">CONTENT MANAGEMENT</p><h2>Latest practicals</h2></div><Link className="text-link" to="/admin/practicals">View all <ArrowRight size={15} /></Link></div><div className="admin-recent-list">{latestPracticals.map((item) => <Link className="admin-recent-row" key={item._id || item.id} to="/admin/practicals"><span className="admin-recent-icon"><ClipboardList size={17} /></span><span className="admin-recent-copy"><strong>{item.title || 'Untitled practical'}</strong><small>{item.subjectId?.name || 'Subject not assigned'} · Practical {number(item.practicalNumber || 1)}</small></span><Status>{item.status === 'published' || item.published ? 'Published' : 'Draft'}</Status></Link>)}</div></section>}
  </>;
}

function AdminManagement({ page, notify, practicalList }) {
  const metadata = {
    departments: { title: 'Departments', eyebrow: 'ACADEMIC STRUCTURE', description: 'Manage departments and academic access.', columns: ['Department', 'Code', 'Status'] },
    years: { title: 'Academic years', eyebrow: 'ACADEMIC STRUCTURE', description: 'Configure year groups used for student and subject assignments.', columns: ['Year', 'Code', 'Status', 'Order'] },
    semesters: { title: 'Semesters', eyebrow: 'ACADEMIC STRUCTURE', description: 'Manage semester names across academic years.', columns: ['Semester', 'Code', 'Year', 'Status'] },
    subjects: { title: 'Subjects', eyebrow: 'CURRICULUM', description: 'Subjects are assigned by department, year and semester.', columns: ['Subject', 'Code', 'Department', 'Year', 'Semester', 'Status'] },
    teachers: { title: 'Teachers', eyebrow: 'PEOPLE', description: 'Review registered faculty accounts and their assignments.', columns: ['Teacher', 'Email', 'Employee ID', 'Department', 'Assigned subjects', 'Status'] },
    students: { title: 'Students', eyebrow: 'PEOPLE', description: 'Student academic mappings determine which subjects they can access.', columns: ['Student', 'Email', 'Roll number', 'Department', 'Year', 'Semester', 'Status'] },
    practicals: { title: 'Practicals', eyebrow: 'CONTENT MANAGEMENT', description: 'Published and draft practicals across configured subjects.', columns: ['Practical', 'Subject', 'Number', 'Status', 'Updated'] }
  };
  const data = metadata[page];
  const [records, setRecords] = useState([]);
  const [catalog, setCatalog] = useState({ departments: [], years: [], semesters: [] });
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingRecord, setDeletingRecord] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const emptyForm = { name: '', code: '', description: '', order: '1', number: '1', yearId: '', departmentId: '', semesterId: '', status: 'active' };
  const [fields, setFields] = useState(emptyForm);

  const loadRecords = async () => {
    const loaders = { departments: departmentService.getAll, years: yearService.getAll, semesters: semesterService.getAll, subjects: subjectService.getAll };
    const response = loaders[page] ? await loaders[page]() : await api.get(`/admin/${page}`);
    const items = response?.data?.[page] || [];
    setRecords(items);
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (['departments', 'years', 'semesters', 'subjects'].includes(page)) {
          const [recordsResponse, departmentResponse, yearResponse, semesterResponse] = await Promise.all([
            ({ departments: departmentService.getAll, years: yearService.getAll, semesters: semesterService.getAll, subjects: subjectService.getAll })[page](),
            departmentService.getAll(), yearService.getAll(), semesterService.getAll()
          ]);
          if (!active) return;
          const items = recordsResponse?.data?.[page] || [];
          setRecords(items);
          setCatalog({
            departments: departmentResponse?.data?.departments || [],
            years: yearResponse?.data?.years || [],
            semesters: semesterResponse?.data?.semesters || []
          });
        } else {
          const response = await api.get(`/admin/${page}`);
          if (!active) return;
          setRecords(response?.data?.[page] || []);
        }
      } catch (error) {
        if (active) notify(error.message || 'Unable to load academic records.');
      }
    };
    load();
    return () => { active = false; };
  }, [page]);

  const referenceName = (reference) => reference?.name || (typeof reference === 'string' ? reference : '—');
  const rows = page === 'departments' ? records.map((item) => [item.name, item.code || '—', item.status || 'active'])
    : page === 'years' ? records.map((item) => [item.name, item.code || '—', item.status || 'active', item.order ?? '—'])
      : page === 'semesters' ? records.map((item) => [item.name, item.code || '—', referenceName(item.yearId), item.status || 'active'])
        : page === 'subjects' ? records.map((item) => [item.name, item.subjectCode || '—', referenceName(item.departmentId), referenceName(item.yearId), referenceName(item.semesterId), item.status || 'active'])
          : page === 'teachers' ? records.map((teacher) => [teacher.name, teacher.email || '—', teacher.employeeId || '—', referenceName(teacher.departmentId), (teacher.assignedSubjects || []).map(referenceName).join(', ') || 'Not assigned', teacher.status || '—'])
            : page === 'students' ? records.map((student) => [student.name, student.email || '—', student.studentId || '—', referenceName(student.departmentId), referenceName(student.yearId), referenceName(student.semesterId), student.status || '—'])
              : records.map((item) => [item.title, referenceName(item.subjectId), `Practical ${number(item.practicalNumber)}`, item.status === 'published' ? 'Published' : 'Draft', item.updatedAt || '—']);
  const filtered = rows.map((row, index) => ({ row, record: records[index] }))
    .filter(({ row }) => row.join(' ').toLowerCase().includes(query.toLowerCase()));
  const typeTitle = { departments: 'Department', years: 'Year', semesters: 'Semester', subjects: 'Subject' }[page];
  const actionLabel = `Add ${typeTitle || page.slice(0, -1)}`;
  const openCreate = () => { setEditing(null); setFields(emptyForm); setFormError(''); setFormOpen(true); };
  const openEdit = (record) => {
    setEditing(record);
    setFields({
      ...emptyForm, name: record.name || '', code: record.code || record.subjectCode || '', description: record.description || '',
      order: String(record.order ?? 1), number: String(record.number ?? 1),
      yearId: record.yearId?._id || record.yearId || '', departmentId: record.departmentId?._id || record.departmentId || '',
      semesterId: record.semesterId?._id || record.semesterId || '', status: record.status || 'active'
    });
    setFormError(''); setFormOpen(true);
  };
  const saveRecord = async (event) => {
    event.preventDefault(); setFormError('');
    if (!fields.name.trim()) { setFormError(page === 'semesters' ? 'Semester name is required.' : `${typeTitle} name is required.`); return; }
    if (page === 'semesters' && !fields.yearId) { setFormError('Please select an academic year.'); return; }
    if (page === 'semesters' && (!Number.isInteger(Number(fields.number)) || Number(fields.number) < 1 || Number(fields.number) > 8)) { setFormError('Semester number must be between 1 and 8.'); return; }
    if (page === 'subjects' && (!fields.departmentId || !fields.yearId || !fields.semesterId)) { setFormError('Please select a department, year, and semester.'); return; }
    setSaving(true);
    const services = { departments: departmentService, years: yearService, semesters: semesterService, subjects: subjectService };
    const payload = { name: fields.name.trim(), code: fields.code.trim(), status: fields.status, isActive: fields.status === 'active' };
    if (page === 'departments') payload.description = fields.description;
    if (page === 'years') payload.order = Number(fields.order);
    if (page === 'semesters') Object.assign(payload, { number: Number(fields.number), yearId: fields.yearId });
    if (page === 'subjects') Object.assign(payload, { subjectCode: fields.code, description: fields.description, departmentId: fields.departmentId, yearId: fields.yearId, semesterId: fields.semesterId });
    try {
      if (page === 'semesters') {
        await (editing ? services.semesters.updateSemester(editing._id, payload) : services.semesters.createSemester(payload));
      } else {
        await (editing ? services[page].update(editing._id, payload) : services[page].create(payload));
      }
    } catch (error) {
      setFormError(error.message || (page === 'semesters'
        ? `Unable to ${editing ? 'update' : 'add'} semester. Please try again.`
        : `Unable to ${editing ? 'update' : 'add'} ${typeTitle.toLowerCase()}. Please try again.`));
      setSaving(false);
      return;
    }
    setFormOpen(false);
    notify(page === 'semesters'
      ? `Semester ${editing ? 'updated' : 'added'} successfully.`
      : `${typeTitle} ${editing ? 'updated' : 'added'} successfully.`);
    try { await loadRecords(); } catch { notify('Saved successfully, but the list could not be refreshed.'); }
    finally { setSaving(false); }
  };
  const removeRecord = async (record) => {
    setDeletingRecord(record); setDeleteError('');
  };
  const confirmDelete = async () => {
    if (!deletingRecord) return;
    setDeleting(true); setDeleteError('');
    const services = { departments: departmentService, years: yearService, semesters: semesterService, subjects: subjectService };
    try {
      await services[page].remove(deletingRecord._id);
      setDeletingRecord(null);
      await loadRecords();
      notify(page === 'semesters' ? 'Semester deleted successfully.' : `${deletingRecord.name} deleted successfully.`);
    } catch (error) { setDeleteError(error.message || 'Unable to delete this record. Please try again.'); }
    finally { setDeleting(false); }
  };
  const editable = ['departments', 'years', 'semesters', 'subjects'].includes(page);
  const updateField = (key) => (event) => setFields((current) => ({ ...current, [key]: event.target.value }));
  return <>
    <PageHeading eyebrow={data.eyebrow} title={data.title} description={data.description} actions={editable && <Button icon={Plus} onClick={openCreate}>{actionLabel}</Button>} />
    <div className="table-toolbar"><label className="field-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${data.title.toLowerCase()}`} /></label><span className="muted-inline">{filtered.length} records</span></div>
    <div className="surface data-table-wrap"><table className="data-table"><thead><tr>{data.columns.map((column) => <th key={column}>{column}</th>)}<th>Actions</th></tr></thead><tbody>{filtered.map(({ row, record }, index) => <tr key={`${row[0]}-${index}`}>{row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`}>{['active', 'inactive', 'Active', 'Published', 'Draft'].includes(String(cell)) ? <Status>{cell}</Status> : cell}</td>)}<td><div className="table-actions">{editable && <><button className="icon-button" title="Edit record" onClick={() => openEdit(record)}><Pencil size={15} /></button><button className="icon-button danger-action" title="Delete record" onClick={() => removeRecord(record)}><X size={15} /></button></>}</div></td></tr>)}</tbody></table>{!filtered.length && <EmptyState title="No matching records" text={query ? 'Try another search term.' : 'Add a record to begin building your academic structure.'} />}</div>
    {formOpen && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setFormOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="academic-modal-title" className="admin-modal"><div className="admin-modal-header"><div><p className="eyebrow">{editing ? 'EDIT ACADEMIC RECORD' : 'ACADEMIC STRUCTURE'}</p><h2 id="academic-modal-title">{editing ? `Edit ${typeTitle}` : actionLabel}</h2></div><button className="icon-button" type="button" aria-label="Close form" disabled={saving} onClick={() => setFormOpen(false)}><X size={17} /></button></div><form noValidate onSubmit={saveRecord} className="admin-modal-form">
      <label className="form-field admin-modal-field-wide"><span>{typeTitle} Name</span><input autoFocus value={fields.name} onChange={updateField('name')} placeholder={page === 'semesters' ? 'Enter semester name' : `Enter ${typeTitle.toLowerCase()} name`} /></label>
      {page !== 'years' && <label className="form-field"><span>{page === 'departments' ? 'Department Code' : page === 'semesters' ? 'Semester Code' : 'Subject Code'}</span><input value={fields.code} onChange={updateField('code')} placeholder={page === 'semesters' ? 'Optional (e.g. SEM5)' : 'Optional'} /></label>}
      {page === 'departments' && <label className="form-field admin-modal-field-wide"><span>Description</span><textarea rows="3" value={fields.description} onChange={updateField('description')} placeholder="Optional description" /></label>}
      {page === 'years' && <label className="form-field"><span>Order</span><input type="number" min="1" value={fields.order} onChange={updateField('order')} /></label>}
      {page === 'semesters' && <><label className="form-field"><span>Semester Number</span><select value={fields.number} onChange={updateField('number')}>{Array.from({ length: 8 }, (_, index) => String(index + 1)).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label className="form-field admin-modal-field-wide"><span>Academic Year</span><select value={fields.yearId} onChange={updateField('yearId')}><option value="">Select a year</option>{catalog.years.map((year) => <option key={year._id} value={year._id}>{year.name}</option>)}</select></label></>}
      {page === 'subjects' && <><label className="form-field admin-modal-field-wide"><span>Description</span><textarea rows="2" value={fields.description} onChange={updateField('description')} placeholder="Optional description" /></label><label className="form-field"><span>Department</span><select value={fields.departmentId} onChange={updateField('departmentId')}><option value="">Select a department</option>{catalog.departments.map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}</select></label><label className="form-field"><span>Year</span><select value={fields.yearId} onChange={(event) => setFields((current) => ({ ...current, yearId: event.target.value, semesterId: '' }))}><option value="">Select a year</option>{catalog.years.map((year) => <option key={year._id} value={year._id}>{year.name}</option>)}</select></label><label className="form-field admin-modal-field-wide"><span>Semester</span><select value={fields.semesterId} onChange={updateField('semesterId')}><option value="">Select a semester</option>{catalog.semesters.filter((semester) => !fields.yearId || String(semester.yearId?._id || semester.yearId) === String(fields.yearId)).map((semester) => <option key={semester._id} value={semester._id}>{semester.name}</option>)}</select></label></>}
      <label className="form-field"><span>Status</span><select value={fields.status} onChange={updateField('status')}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
      {formError && <p className="admin-modal-error" role="alert">{formError}</p>}
      <div className="admin-modal-actions"><button type="button" className="button button-secondary" disabled={saving} onClick={() => setFormOpen(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? page === 'semesters' ? editing ? 'Updating...' : 'Adding...' : 'Saving...' : page === 'semesters' ? editing ? 'Update Semester' : 'Add Semester' : editing ? 'Save changes' : actionLabel}</button></div>
    </form></section></div>}
    {deletingRecord && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setDeletingRecord(null); }}><section role="alertdialog" aria-modal="true" aria-labelledby="delete-modal-title" className="admin-modal admin-delete-modal"><div className="admin-modal-header"><div><p className="eyebrow">CONFIRM DELETE</p><h2 id="delete-modal-title">{page === 'semesters' ? 'Delete Semester?' : `Delete ${typeTitle}?`}</h2></div><button className="icon-button" type="button" aria-label="Close confirmation" disabled={deleting} onClick={() => setDeletingRecord(null)}><X size={17} /></button></div><p className="admin-delete-copy">{page === 'semesters' ? 'Are you sure you want to delete this semester?' : `Are you sure you want to delete ${deletingRecord.name}?`}</p>{deleteError && <p className="admin-modal-error" role="alert">{deleteError}</p>}<div className="admin-modal-actions"><button type="button" className="button button-secondary" disabled={deleting} onClick={() => setDeletingRecord(null)}>Cancel</button><button type="button" className="button button-primary" disabled={deleting} onClick={confirmDelete}>{deleting ? 'Deleting...' : 'Delete'}</button></div></section></div>}
  </>;
}

function AdminSettings({ notify }) {
  const [enabled, setEnabled] = useState({ registrations: true, notifications: true, ai: false });
  const [general, setGeneral] = useState({ collegeName: '', academicYear: '', semesterStatus: '' });
  const update = (key) => (event) => setGeneral((current) => ({ ...current, [key]: event.target.value }));
  return <><PageHeading eyebrow="CONFIGURATION" title="Settings" description="Manage portal-wide preferences and account access." actions={<Button onClick={() => notify('Portal settings saved.')}>Save settings</Button>} /><div className="settings-grid"><section className="surface settings-panel"><div className="panel-heading"><div><p className="eyebrow">PORTAL PREFERENCES</p><h2>General</h2></div><Settings size={18} /></div><label className="form-field"><span>College name</span><input value={general.collegeName} onChange={update('collegeName')} placeholder="Enter college name" /></label><label className="form-field"><span>Academic year</span><input value={general.academicYear} onChange={update('academicYear')} placeholder="Enter academic year" /></label><label className="form-field"><span>Default semester status</span><select value={general.semesterStatus} onChange={update('semesterStatus')}><option value="">Choose status</option><option>In progress</option><option>Upcoming</option><option>Completed</option></select></label></section><section className="surface settings-panel"><div className="panel-heading"><div><p className="eyebrow">ACCESS & SERVICES</p><h2>Portal controls</h2></div><ShieldCheck size={18} /></div>{[['registrations', 'Student registration', 'Allow new student registrations'], ['notifications', 'Email notifications', 'Send updates for published practicals'], ['ai', 'AI PDF analysis', 'Enable the teacher analysis interface']].map(([key, title, description]) => <label className="setting-toggle" key={key}><span><strong>{title}</strong><small>{description}</small></span><input type="checkbox" checked={enabled[key]} onChange={() => setEnabled((value) => ({ ...value, [key]: !value[key] }))} /></label>)}</section></div></>;
}

function AdminNotificationsPage({ items, onMarkRead }) {
  return <>
    <PageHeading eyebrow="COLLEGE ACTIVITY" title="Teacher updates" description="Subject assignments and practical activity reported by teachers." />
    {items.length ? items.map((item) => <article className={`surface notification-full ${item.read ? 'notification-read' : 'notification-unread'}`} key={item._id}>
      <span className="notification-dot" />
      <span className="notification-message"><strong>{item.message}</strong><small>{item.actorId?.name || 'Teacher'} · {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Recently'}</small></span>
      {!item.read && <button type="button" className="notification-read-action" onClick={() => onMarkRead(item)}>Mark read</button>}
    </article>) : <EmptyState title="No teacher updates yet" text="New subjects, class assignments and practical changes made by teachers will appear here." icon={Bell} />}
  </>;
}

export default function PortalExperience() {
  const { user, setUser, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const role = location.pathname.split('/')[1] || 'student';
  const route = `/${location.pathname.split('/').slice(2).join('/')}`.replace(/\/$/, '') || '/dashboard';
  const [hasOpenedMyraa, setHasOpenedMyraa] = useState(route === '/myraa');
  const [search, setSearch] = useState('');
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [bookmarkedIds, setBookmarkedIds] = useState([]);
  const [practicalList, setPracticalList] = useState([]);
  const [studentSubjectList, setStudentSubjectList] = useState([]);
  const [studentPracticalList, setStudentPracticalList] = useState([]);
  const [studentSubmissionList, setStudentSubmissionList] = useState([]);
  const [studentEvaluationList, setStudentEvaluationList] = useState([]);
  const [completedIds, setCompletedIds] = useState([]);
  const [progressRecords, setProgressRecords] = useState([]);
  const [teacherSubjectList, setTeacherSubjectList] = useState([]);
  const [teacherPracticalList, setTeacherPracticalList] = useState([]);
  const [teacherSubmissionList, setTeacherSubmissionList] = useState([]);
  const [teacherStudentList, setTeacherStudentList] = useState([]);
  const [adminTeacherList, setAdminTeacherList] = useState([]);
  const [adminStudentList, setAdminStudentList] = useState([]);
  const [adminSubjectList, setAdminSubjectList] = useState([]);
  const [adminCatalog, setAdminCatalog] = useState({ departments: [], years: [], semesters: [] });
  const [adminNotifications, setAdminNotifications] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const dataLoadRef = useRef({ identity: '', status: 'idle' });
  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(''), 2800); };

  useEffect(() => {
    if (role === 'student' && route === '/myraa') setHasOpenedMyraa(true);
  }, [role, route]);

  useEffect(() => {
    const handleSearchShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.querySelector('.global-search input')?.focus();
      } else if (event.key === 'Escape') {
        setSearch('');
      }
    };
    window.addEventListener('keydown', handleSearchShortcut);
    return () => window.removeEventListener('keydown', handleSearchShortcut);
  }, []);

  const refreshTeacherData = async () => {
    const [subjectResponse, practicalResponse, studentResponse, submissionResponse] = await Promise.all([
      teacherService.getSubjects(),
      teacherService.getPracticals(),
      teacherService.getStudents(),
      submissionService.getAll()
    ]);
    setTeacherSubjectList(subjectResponse?.data?.subjects || []);
    setTeacherPracticalList(practicalResponse?.data?.practicals || []);
    setTeacherStudentList(studentResponse?.data?.students || []);
    setTeacherSubmissionList(submissionResponse?.data?.submissions || []);
  };

  useEffect(() => {
    if (!user || !token) {
      dataLoadRef.current = { identity: '', status: 'idle' };
      setDataLoading(false);
      setDataError('Your session is no longer available. Please sign in again.');
      return undefined;
    }
    const identity = `${user._id || user.id || user.role}:${token}`;
    const studentPageDoesNotNeedAcademicData = user.role === 'student' && ['/myraa', '/profile'].includes(route);
    if (studentPageDoesNotNeedAcademicData) {
      if (dataLoadRef.current.identity !== identity) {
        dataLoadRef.current = { identity, status: 'idle' };
      }
      setDataLoading(false);
      setDataError('');
      return undefined;
    }
    if (dataLoadRef.current.identity === identity && ['loading', 'loaded'].includes(dataLoadRef.current.status)) {
      return undefined;
    }
    dataLoadRef.current = { identity, status: 'loading' };

    const loadAcademicData = async () => {
      setDataLoading(true);
      setDataError('');
      let loaded = false;
      try {
        if (user.role === 'student') {
          const [subjectResponse, practicalResponse, progressResponse, bookmarkResponse, submissionResponse, evaluationResponse] = await Promise.all([
            api.get('/student/subjects'),
            api.get('/student/practicals'),
            progressService.getAll(),
            bookmarkService.getAll(),
            submissionService.getStudent(),
            evaluationService.getStudent()
          ]);

          if (dataLoadRef.current.identity !== identity) return;
          setStudentSubjectList(subjectResponse?.data?.subjects || []);
          setStudentPracticalList(practicalResponse?.data?.practicals || []);
          setStudentSubmissionList(submissionResponse?.data?.submissions || []);
          setStudentEvaluationList(evaluationResponse?.data?.evaluations || []);
          const loadedProgress = progressResponse?.data?.progress || [];
          setProgressRecords(loadedProgress);
          setCompletedIds(loadedProgress.map((item) => String(item.practicalId?._id || item.practicalId)));
          setBookmarkedIds((bookmarkResponse?.data?.bookmarks || []).map((item) => String(item.practicalId?._id || item.practicalId)));
        }

        if (user.role === 'teacher') {
          await refreshTeacherData();
        }

        if (user.role === 'admin') {
          const [practicals, teachers, students, subjects, departments, years, semesters, notificationResponse] = await Promise.all([
            api.get('/admin/practicals'), api.get('/admin/teachers'), api.get('/admin/students'), api.get('/admin/subjects'),
            departmentService.getAll(), yearService.getAll(), semesterService.getAll(), notificationService.getAll()
          ]);
          if (dataLoadRef.current.identity !== identity) return;
          setPracticalList(practicals?.data?.practicals || []);
          setAdminTeacherList(teachers?.data?.teachers || []);
          setAdminStudentList(students?.data?.students || []);
          setAdminSubjectList(subjects?.data?.subjects || []);
          setAdminNotifications(notificationResponse?.data?.notifications || []);
          setAdminCatalog({
            departments: departments?.data?.departments || [],
            years: years?.data?.years || [],
            semesters: semesters?.data?.semesters || []
          });
        }
        loaded = true;
      } catch (error) {
        if (dataLoadRef.current.identity !== identity) return;
        setDataError(error.message || 'Unable to load your academic data.');
        notify(error.message || 'Unable to load your academic data.');
      } finally {
        if (dataLoadRef.current.identity === identity) {
          dataLoadRef.current.status = loaded ? 'loaded' : 'idle';
          setDataLoading(false);
        }
      }
    };

    void loadAcademicData();
    return undefined;
  }, [user, token, route]);

  useEffect(() => {
    if (user?.role !== 'admin' || !token) return undefined;
    const refresh = async () => {
      try {
        const response = await notificationService.getAll();
        setAdminNotifications(response?.data?.notifications || []);
      } catch (error) {
        setToast(error.message || 'Unable to refresh teacher updates.');
      }
    };
    const interval = window.setInterval(refresh, 20000);
    return () => window.clearInterval(interval);
  }, [user?.role, token]);

  const markNotificationRead = async (notification) => {
    const id = String(notification._id || notification.id);
    try {
      await notificationService.markAsRead(id);
      setAdminNotifications((items) => items.map((item) => (item._id || item.id) === id ? { ...item, read: true } : item));
    } catch (error) {
      notify(error.message || 'Unable to mark this update as read.');
    }
  };

  const toggleBookmark = async (id) => {
    const practicalId = String(id);
    const isSaved = bookmarkedIds.includes(practicalId);
    try {
      if (isSaved) await bookmarkService.remove(practicalId);
      else await bookmarkService.add(practicalId);
      setBookmarkedIds((current) => isSaved ? current.filter((item) => item !== practicalId) : [...current, practicalId]);
      notify(isSaved ? 'Bookmark removed.' : 'Bookmark added.');
    } catch (error) {
      notify(error.message || 'Could not update bookmark.');
    }
  };
  const completePractical = async (id) => {
    const wasComplete = completedIds.includes(String(id));
    try {
      const response = wasComplete ? await progressService.uncomplete(id) : await progressService.complete(id);
      setCompletedIds((current) => wasComplete ? current.filter((item) => item !== String(id)) : [...current, String(id)]);
      setProgressRecords((current) => wasComplete
        ? current.filter((item) => String(item.practicalId?._id || item.practicalId) !== String(id))
        : [{ ...(response?.data?.progress || {}), practicalId: response?.data?.progress?.practicalId || id, completedAt: response?.data?.progress?.completedAt || new Date().toISOString() }, ...current]);
      notify(wasComplete ? 'Practical marked incomplete.' : 'Practical marked complete.');
    } catch (error) {
      notify(error.message || 'Could not update practical progress.');
    }
  };
  const togglePublished = async (target) => {
    try {
      if (target.published) await teacherService.unpublishPractical(target.id);
      else await teacherService.publishPractical(target.id);
      await refreshTeacherData();
      notify(target.published ? 'Practical unpublished.' : 'Practical published successfully.');
    } catch (error) {
      notify(error.message || 'Could not update practical status.');
    }
  };
  const deletePractical = async (id) => {
    try {
      await teacherService.deletePractical(id);
      await refreshTeacherData();
      notify('Practical deleted from MongoDB.');
    } catch (error) {
      notify(error.message || 'Could not delete practical.');
    }
  };
  const logout = () => { setUser(null); navigate('/login'); };
  const subjectMatch = route.match(/^\/subjects\/([^/]+)/);
  const practicalMatch = route.match(/^\/practicals\/([^/]+)/);
  const noteMatch = route.match(/^\/notes\/([^/]+)/);
  let page;

  if (dataLoading && !(role === 'student' && ['/myraa', '/profile'].includes(route))) {
    page = <WorkspaceLoading title={role === 'student' ? 'Loading your courses' : 'Preparing your workspace'} description="Fetching the latest academic records and assignments." />;
  } else if (dataError && (role !== 'student' || !['/myraa', '/profile'].includes(route))) {
    page = <EmptyState title="Unable to load database records" text={dataError} action={<Button onClick={() => window.location.reload()}>Try again</Button>} icon={Activity} />;
  } else if (role === 'student') {
    const activeStudentPracticals = studentPracticalList;
    const activeStudentSubjects = studentSubjectList;
    if (route.startsWith('/academic-documents')) page = <AcademicDocumentsPage role={role} notify={notify} />;
    else if (route === '/dashboard') page = <StudentDashboard user={user} practicalList={activeStudentPracticals} bookmarkedIds={bookmarkedIds} subjectList={activeStudentSubjects} completedIds={completedIds} progressRecords={progressRecords} notify={notify} />;
    else if (route === '/subjects') page = <StudentSubjects user={user} practicalList={activeStudentPracticals} subjectList={activeStudentSubjects} completedIds={completedIds} />;
    else if (subjectMatch) page = <StudentSubjectDetail subjectId={subjectMatch[1]} subjectList={activeStudentSubjects} completedIds={completedIds} submissionList={studentSubmissionList} />;
    else if (route === '/practicals') page = <StudentPracticals practicalList={activeStudentPracticals} subjectList={activeStudentSubjects} completedIds={completedIds} submissionList={studentSubmissionList} />;
    else if (practicalMatch) page = <StudentPracticalDetail practicalId={practicalMatch[1]} bookmarkedIds={bookmarkedIds} toggleBookmark={toggleBookmark} completePractical={completePractical} notify={notify} subjectList={activeStudentSubjects} completedIds={completedIds} submissionList={studentSubmissionList} evaluationList={studentEvaluationList} onSubmitted={(submission) => setStudentSubmissionList((current) => [submission, ...current.filter((item) => recordId(item) !== recordId(submission))])} />;
    else if (route === '/notes') page = <NotesPage />;
    else if (noteMatch) page = <StudentNoteDetail noteId={noteMatch[1]} />;
    else if (route === '/bookmarks') page = <StudentBookmarks practicalList={activeStudentPracticals} bookmarkedIds={bookmarkedIds} subjectList={activeStudentSubjects} />;
    else if (route === '/myraa') page = <MyraaPage />;
    else if (route === '/profile') page = <ProfilePage user={user} role={role} />;
    else if (route === '/notifications') { const notices = notifications.filter((item) => item.role === role); page = <><PageHeading eyebrow="UPDATES" title="Notifications" description="Recent updates for your courses." />{notices.length ? notices.map((item) => <div className="surface notification-full" key={item.id}><span className="notification-dot" /><strong>{item.title}</strong><small>{item.time}</small></div>) : <EmptyState title="No notifications yet" text="Updates will appear here when your college publishes them." icon={Bell} />}</>; }
  } else if (role === 'teacher') {
    const teacherSubjects = teacherSubjectList;
    const teacherPracticals = teacherPracticalList;
    if (route.startsWith('/academic-documents')) page = <AcademicDocumentsPage role={role} notify={notify} />;
    else if (route === '/dashboard') page = <TeacherDashboard practicalList={teacherPracticals} user={user} subjectList={teacherSubjects} />;
    else if (route === '/subjects') page = <TeacherSubjects subjectList={teacherSubjects} onAssigned={refreshTeacherData} notify={notify} />;
    else if (route === '/practicals') page = <TeacherPracticalList practicalList={teacherPracticals} subjectList={teacherSubjects} subjectIds={new Set(teacherSubjects.map((item) => String(item._id || item.id)))} submissionList={teacherSubmissionList} onDelete={deletePractical} onTogglePublish={togglePublished} onRefresh={refreshTeacherData} notify={notify} />;
    else if (route === '/practicals/add') page = <TeacherPracticalModal user={user} notify={notify} onSaved={refreshTeacherData} />;
    else if (route.endsWith('/edit')) { const item = teacherPracticals.find((practical) => String(practical._id || practical.id) === String(practicalMatch?.[1])); page = <TeacherPracticalModal practical={item} user={user} notify={notify} onSaved={refreshTeacherData} />; }
    else if (practicalMatch) { const item = teacherPracticals.map(normalizePracticalFromApi).filter(Boolean).find((practical) => String(practical.id) === String(practicalMatch[1])); page = item ? <TeacherPracticalDetail practical={item} onTogglePublish={togglePublished} onRefresh={refreshTeacherData} notify={notify} /> : <EmptyState title="Practical not found" text="This practical may no longer be available in your teaching workspace." action={<Link to="/teacher/practicals" className="text-link">Back to practicals</Link>} />; }
    else if (route === '/students') page = <TeacherStudents studentList={teacherStudentList} />;
    else if (route === '/profile') page = <ProfilePage user={user} role={role} notify={notify} />;
  } else if (role === 'admin') {
    if (route === '/dashboard') page = <AdminDashboard practicalList={practicalList} teacherList={adminTeacherList} studentList={adminStudentList} catalog={adminCatalog} subjectList={adminSubjectList} adminNotifications={adminNotifications} />;
    else if (route === '/students') page = <AdminStudentDirectory />;
    else if (route === '/team') page = <TeamManagementPage />;
    else if (route === '/notes') page = <AdminNotesPage notify={notify} />;
    else if (['/departments', '/years', '/semesters', '/subjects', '/teachers', '/practicals'].includes(route)) page = <AdminManagement page={route.slice(1)} practicalList={practicalList} notify={notify} />;
    else if (route === '/notifications') page = <AdminNotificationsPage items={adminNotifications} onMarkRead={markNotificationRead} />;
    else if (route === '/settings') page = <AdminSettings notify={notify} />;
    else if (route === '/profile') page = <ProfilePage user={user} role={role} notify={notify} />;
  }
  if (!page) page = <EmptyState title="Page not found" text="This workspace page is not available." action={<Link to={roleHome[role]} className="text-link">Return to overview</Link>} />;

  const searchSubjects = role === 'student' ? studentSubjectList : role === 'teacher' ? teacherSubjectList : adminSubjectList;
  const searchPracticals = role === 'student' ? studentPracticalList : role === 'teacher' ? teacherPracticalList : practicalList;
  return <DashboardShell role={role} user={user} search={search} setSearch={setSearch} notificationOpen={notificationOpen} setNotificationOpen={setNotificationOpen} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} onLogout={logout} searchSubjects={searchSubjects} searchPracticals={searchPracticals} notificationItems={adminNotifications} onNotificationRead={markNotificationRead}><div className="page-enter">{page}</div>{role === 'student' && hasOpenedMyraa && <div hidden={route !== '/myraa'}><Suspense fallback={route === '/myraa' ? <WorkspaceLoading title="Loading Myraa" description="Preparing your voice assistant." /> : null}><MyraaIntegrated /></Suspense></div>}<div className={`toast ${toast ? 'toast-visible' : ''}`} role="status"><CheckCircle2 size={17} />{toast}</div></DashboardShell>;
}