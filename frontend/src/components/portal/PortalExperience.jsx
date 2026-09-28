import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, ArrowDownToLine, ArrowLeft, ArrowRight, Bell, BookOpen, Bookmark,
  Building2, Check, CheckCircle2, ChevronDown, ChevronRight, ClipboardList,
  Clock3, Download, FilePlus2, FileText, Filter, GraduationCap, LayoutDashboard,
  LoaderCircle, LogOut, Menu, MoreHorizontal, Pencil, Plus, Search, Settings, ShieldCheck,
  Sparkles, Users, X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { notifications } from '../../data/portalData';
import api from '../../services/api';
import departmentService from '../../services/departmentService';
import yearService from '../../services/yearService';
import semesterService from '../../services/semesterService';
import subjectService from '../../services/subjectService';
import teacherService from '../../services/teacherService';
import studentService from '../../services/studentService';
import pdfService from '../../services/pdfService';
import progressService from '../../services/progressService';
import bookmarkService from '../../services/bookmarkService';
import { getAcademicYearOptions } from '../../utils/academicYear';
import TeacherPracticalModal from './TeacherPracticalModal';

const roleHome = { admin: '/admin/dashboard', teacher: '/teacher/dashboard', student: '/student/dashboard' };
const roleNames = { admin: 'Administrator', teacher: 'Teacher', student: 'Student' };
const number = (value) => String(value).padStart(2, '0');

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

function PracticalRow({ practical, subject, onOpen, completed = false }) {
  return <div className="practical-row"><span className="row-number">{number(practical.practicalNumber)}</span><div className="row-main"><strong>{practical.title}</strong><span>{subject?.name || 'Course practical'}</span></div><Status>{completed ? 'Completed' : 'Available'}</Status><Button variant="quiet" onClick={() => onOpen(practical)} aria-label={`View ${practical.title}`}>View <ChevronRight size={15} /></Button></div>;
}

function DashboardShell({ role, children, search, setSearch, notificationOpen, setNotificationOpen, mobileOpen, setMobileOpen, onLogout, user, searchSubjects = [], searchPracticals = [] }) {
  const roleNav = {
    student: [
      ['Overview', '/student/dashboard', LayoutDashboard], ['My subjects', '/student/subjects', BookOpen],
      ['Practicals', '/student/practicals', ClipboardList], ['Bookmarks', '/student/bookmarks', Bookmark],
      ['Myraa assistant', '/student/myraa', Sparkles], ['Profile', '/student/profile', Users]
    ],
    teacher: [
      ['Overview', '/teacher/dashboard', LayoutDashboard], ['My subjects', '/teacher/subjects', BookOpen],
      ['Practicals', '/teacher/practicals', ClipboardList], ['Add practical', '/teacher/practicals/add', FilePlus2],
      ['Students', '/teacher/students', Users], ['Profile', '/teacher/profile', Users]
    ],
    admin: [
      ['Overview', '/admin/dashboard', LayoutDashboard], ['Departments', '/admin/departments', Building2],
      ['Years', '/admin/years', GraduationCap], ['Semesters', '/admin/semesters', Activity],
      ['Subjects', '/admin/subjects', BookOpen], ['Teachers', '/admin/teachers', Users],
      ['Students', '/admin/students', Users], ['Practicals', '/admin/practicals', ClipboardList], ['Settings', '/admin/settings', Settings]
    ]
  };
  const scope = role === 'student'
    ? [user?.departmentId?.code || user?.departmentId?.name || user?.departmentId, user?.yearId?.name || user?.yearId, user?.semesterId?.name || user?.semesterId].filter(Boolean).join(' · ') || 'Academic assignment not set'
    : roleNames[role];
  const roleNotifications = notifications.filter((item) => item.role === role);
  const [profileOpen, setProfileOpen] = useState(false);

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
          <label className="global-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search subjects, practicals..." aria-label="Search subjects and practicals" />{search && <button onClick={() => setSearch('')} aria-label="Clear search"><X size={14} /></button>}<kbd>⌘ K</kbd></label>
          {search && <div className="search-popover">{[...searchSubjects.filter((item) => item.name?.toLowerCase().includes(search.toLowerCase())).slice(0, 3).map((item) => ({ label: item.name, to: role === 'student' ? `/student/subjects/${item._id || item.id}` : `/${role}/subjects` })), ...searchPracticals.filter((item) => item.title?.toLowerCase().includes(search.toLowerCase())).slice(0, 3).map((item) => ({ label: item.title, to: role === 'student' ? `/student/practicals/${item._id || item.id}` : `/${role}/practicals/${item._id || item.id}` }))].map((result, index) => <Link key={`${result.label}-${index}`} to={result.to} onClick={() => setSearch('')}><Search size={14} />{result.label}<ArrowRight size={14} /></Link>)}{!searchSubjects.some((item) => item.name?.toLowerCase().includes(search.toLowerCase())) && !searchPracticals.some((item) => item.title?.toLowerCase().includes(search.toLowerCase())) && <span className="search-empty">No matching learning material</span>}</div>}
          <div className="topbar-menu-wrap"><button className={`icon-button notification-trigger ${notificationOpen ? 'is-active' : ''}`} onClick={() => setNotificationOpen(!notificationOpen)} aria-label="Notifications"><Bell size={18} /></button>{notificationOpen && <div className="notification-popover"><div className="popover-heading"><strong>Notifications</strong><button className="text-link" onClick={() => setNotificationOpen(false)}>Close</button></div>{roleNotifications.length ? roleNotifications.map((item) => <div className="notification-item" key={item.id}><span className="notification-dot" /><div><strong>{item.title}</strong><small>{item.time}</small></div></div>) : <p className="popover-empty">No notifications yet.</p>}<Link to={`/${role}/notifications`} className="popover-footer" onClick={() => setNotificationOpen(false)}>View all notifications <ArrowRight size={14} /></Link></div>}</div>
          <div className="topbar-menu-wrap"><button className="profile-trigger" onClick={() => setProfileOpen(!profileOpen)}><span className="avatar">{user?.name?.split(' ').map((part) => part[0]).slice(0, 2).join('') || 'U'}</span><span className="profile-trigger-copy"><strong>{user?.name || roleNames[role]}</strong><small>{scope}</small></span><ChevronDown size={15} /></button>{profileOpen && <div className="profile-menu"><Link to={`/${role}/profile`} onClick={() => setProfileOpen(false)}>View profile</Link><button onClick={onLogout}>Sign out</button></div>}</div>
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

function StudentDashboard({ user, practicalList, bookmarkedIds, subjectList = [], completedIds = [] }) {
  const navigate = useNavigate();
  const studentSubjects = subjectList.map(normalizeSubjectFromApi).filter(Boolean);
  const studentPracticals = practicalList.map(normalizePracticalFromApi).filter(Boolean);
  const completed = studentPracticals.filter((item) => completedIds.includes(String(item.id))).length;
  return <>
    <PageHeading eyebrow="STUDENT WORKSPACE" title={`Good morning, ${user?.name?.split(' ')[0] || 'there'}`} description="Pick up where you left off in your practical work." />
    <div className="stat-grid"><Stat label="My subjects" value={studentSubjects.length} note="Current semester" icon={BookOpen} /><Stat label="Practicals" value={studentPracticals.length} note="Published for you" icon={ClipboardList} tone="green" /><Stat label="Completed" value={completed} note={`${studentPracticals.length - completed} to go`} icon={CheckCircle2} tone="amber" /><Stat label="Bookmarks" value={bookmarkedIds.length} note="Saved for later" icon={Bookmark} tone="slate" /></div>
    <div className="section-heading"><div><p className="eyebrow">YOUR CURRICULUM</p><h2>My subjects</h2></div><Link className="text-link" to="/student/subjects">View all subjects <ArrowRight size={15} /></Link></div>
    {studentSubjects.length ? <div className="subject-grid">{studentSubjects.slice(0, 3).map((subject) => { const items = studentPracticals.filter((item) => item.subjectId === subject.id); return <SubjectTile key={subject.id} subject={subject} items={items} completedCount={items.filter((item) => completedIds.includes(String(item.id))).length} />; })}</div> : <EmptyState title="No subjects assigned" text="No subjects are assigned to your department, year and semester yet." />}
    <div className="section-heading section-heading-spaced"><div><p className="eyebrow">PICK UP WHERE YOU LEFT OFF</p><h2>Recently available</h2></div><Link className="text-link" to="/student/practicals">All practicals <ArrowRight size={15} /></Link></div>
    <section className="surface practical-list">{studentPracticals.slice(0, 4).map((item) => <PracticalRow key={item.id} practical={item} subject={studentSubjects.find((entry) => entry.id === item.subjectId)} completed={completedIds.includes(String(item.id))} onOpen={(practical) => navigate(`/student/practicals/${practical.id}`)} />)}</section>
  </>;
}

function StudentSubjects({ user, practicalList, subjectList = [], completedIds = [] }) {
  const studentSubjects = subjectList.map(normalizeSubjectFromApi).filter(Boolean);
  return <><PageHeading eyebrow="LEARNING MATERIAL" title="My subjects" description="Subjects assigned to your current academic semester." /><div className="filter-bar"><span><GraduationCap size={16} />{user?.departmentId?.name || user?.departmentId || 'Department'} <i />{user?.yearId?.name || user?.yearId || 'Year'} <i />{user?.semesterId?.name || user?.semesterId || 'Semester'}</span><span className="muted-inline">{studentSubjects.length} subjects</span></div>{studentSubjects.length ? <div className="subject-grid subject-grid-wide">{studentSubjects.map((subject) => { const items = (practicalList || []).map(normalizePracticalFromApi).filter((item) => item && String(item.subjectId) === String(subject.id)); return <SubjectTile key={subject.id} subject={subject} items={items} completedCount={items.filter((item) => completedIds.includes(String(item.id))).length} />; })}</div> : <EmptyState title="No subjects yet" text="No subjects are assigned to you yet." />}</>;
}

function StudentSubjectDetail({ subjectId, subjectList = [], completedIds = [] }) {
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
  return <><div className="breadcrumbs"><Link to="/student/dashboard">Dashboard</Link><ChevronRight size={14} /><Link to="/student/subjects">My subjects</Link><ChevronRight size={14} /><span>{subject.name}</span></div><PageHeading eyebrow={`${subject.code} · ${subject.semesterName || subject.semesterId}`} title={subject.name} description={subject.description} actions={<Button variant="secondary" onClick={() => navigate(`/student/practicals?subject=${subject.id}`)}>View all practicals <ArrowRight size={15} /></Button>} /><div className="stat-grid stat-grid-small"><Stat label="Total practicals" value={items.length} icon={ClipboardList} /><Stat label="Completed" value={completed} icon={CheckCircle2} tone="green" /><Stat label="Remaining" value={items.length - completed} icon={Clock3} tone="amber" /></div><div className="section-heading"><div><p className="eyebrow">PRACTICAL SEQUENCE</p><h2>Course practicals</h2></div><span className="muted-inline">Ordered by practical number</span></div><section className="surface practical-list">{items.map((item) => <PracticalRow key={item.id} practical={item} subject={subject} completed={completedIds.includes(String(item.id))} onOpen={(practical) => navigate(`/student/practicals/${practical.id}`)} />)}{!items.length && <EmptyState title="No practicals published" text="No practicals have been published for this subject." />}</section></>;
}

function StudentPracticals({ practicalList, subjectList = [], completedIds = [] }) {
  const navigate = useNavigate();
  const params = new URLSearchParams(useLocation().search);
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const subjectPool = subjectList.map(normalizeSubjectFromApi).filter(Boolean);
  const items = (practicalList || []).map(normalizePracticalFromApi).filter((item) => item && (!params.get('subject') || String(item.subjectId) === String(params.get('subject'))));
  const shown = items.filter((item) => (filter === 'All' || (filter === 'Completed' ? completedIds.includes(String(item.id)) : !completedIds.includes(String(item.id)))) && item.title.toLowerCase().includes(query.toLowerCase()));
  return <><PageHeading eyebrow="LEARNING MATERIAL" title="Practicals" description="Browse published practicals across your assigned subjects." /><div className="table-toolbar"><label className="field-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search practicals" /></label><div className="segmented-control" aria-label="Filter practicals">{['All', 'Completed', 'Pending'].map((value) => <button key={value} className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{value}</button>)}</div></div><section className="surface practical-list">{shown.map((item) => <PracticalRow key={item.id} practical={item} subject={subjectPool.find((entry) => String(entry.id) === String(item.subjectId))} completed={completedIds.includes(String(item.id))} onOpen={(practical) => navigate(`/student/practicals/${practical.id}`)} />)}{!shown.length && <EmptyState title="No practicals found" text={query ? 'Try another search term or clear your filters.' : 'No practicals match this status yet.'} icon={Filter} />}</section></>;
}

function StudentPracticalDetail({ practicalId, bookmarkedIds, toggleBookmark, completePractical, notify, subjectList = [], completedIds = [] }) {
  const [practical, setPractical] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
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
  const Section = ({ title, children, number: sectionNumber }) => <section className="detail-section"><div className="detail-section-number">{sectionNumber}</div><div><h2>{title}</h2>{children}</div></section>;
  return <><div className="breadcrumbs"><Link to="/student/dashboard">Dashboard</Link><ChevronRight size={14} /><Link to={`/student/subjects/${subject?.id}`}>{subject?.name}</Link><ChevronRight size={14} /><span>Practical {number(practical.practicalNumber)}</span></div><div className="practical-detail-layout"><article className="practical-article"><div className="practical-detail-head"><Status>{completed ? 'Completed' : 'Available'}</Status><span className="muted-inline">{subject?.name} · Practical {number(practical.practicalNumber)}</span><h1>{practical.title}</h1><p>Follow the steps below, then use the original handout when you need the teacher's source material.</p><div className="detail-actions"><Button variant="secondary" icon={saved ? Check : Bookmark} onClick={() => { toggleBookmark(practical.id); notify(saved ? 'Bookmark removed.' : 'Bookmark added.'); }}>{saved ? 'Bookmarked' : 'Bookmark'}</Button><Button variant="secondary" icon={Download} onClick={() => pdfService.download(practical.pdfId).catch((error) => notify(error.message || 'Could not download the original PDF.'))} disabled={!practical.pdfId}>Download PDF</Button><Button onClick={() => completePractical(practical.id)} icon={CheckCircle2}>{completed ? 'Mark incomplete' : 'Mark complete'}</Button></div></div>
    <Section title="Aim" number="01"><p>{practical.aim}</p></Section>
    <Section title="About this practical" number="02"><p>{practical.about}</p></Section>
    <Section title="What you will learn" number="03"><ul>{practical.learn?.map((line) => <li key={line}>{line}</li>)}</ul></Section>
    <Section title="Requirements" number="04"><ul>{practical.requirements?.map((line) => <li key={line}>{line}</li>)}</ul></Section>
    <Section title="Concept / theory" number="05"><p>{practical.concept}</p></Section>
    <Section title="Step-by-step procedure" number="06"><ol>{practical.procedure?.map((line, index) => <li key={line}><span>{number(index + 1)}</span>{line}</li>)}</ol></Section>
    <Section title="Practical task" number="07"><p>{practical.task}</p></Section>
    <Section title="Expected output" number="08"><div className="output-box"><CheckCircle2 size={17} /><p>{practical.expectedOutput}</p></div></Section>
    <Section title="Important points" number="09"><ul>{practical.importantPoints?.map((line) => <li key={line}>{line}</li>)}</ul></Section>
    <Section title="Common errors" number="10"><ul>{practical.commonErrors?.map((line) => <li key={line}>{line}</li>)}</ul></Section>
    <Section title="Viva questions" number="11"><ol className="viva-list">{practical.vivaQuestions?.map((line, index) => <li key={line}><span>{number(index + 1)}</span>{line}</li>)}</ol></Section>
    <div className="original-file-mobile"><OriginalPdfPanel notify={notify} /></div></article><aside className="detail-aside"><OriginalPdfPanel notify={notify} /><div className="aside-note"><ShieldCheck size={17} /><p><strong>Teacher source preserved</strong><br />This learning guide does not replace the original practical handout.</p></div></aside></div></>;
}

function OriginalPdfPanel({ notify }) {
  const { pathname } = useLocation();
  const practicalId = pathname.match(/^\/student\/practicals\/([^/]+)/)?.[1];
  const [pdfId, setPdfId] = useState('');
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
  const openPdf = async () => {
    const popup = window.open('about:blank', '_blank');
    try {
      if (!pdfId) throw new Error('No original PDF is attached.');
      const url = await pdfService.view(pdfId);
      if (popup) { popup.opener = null; popup.location.href = url; }
      else window.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      popup?.close();
      notify(error.message || 'Could not open the original PDF.');
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
  return <section className="pdf-panel" id="original-pdf"><div className="pdf-panel-head"><span className="pdf-icon"><FileText size={18} /></span><span><strong>Original practical PDF</strong><small>Teacher-uploaded source file</small></span><MoreHorizontal size={18} /></div><div className="pdf-preview"><FileText size={35} /><strong>{pdfId ? 'Original handout attached' : 'No PDF attached'}</strong><span>Stored in MongoDB GridFS</span></div><div className="pdf-actions"><Button variant="secondary" icon={ArrowRight} onClick={openPdf} disabled={!pdfId}>Open PDF</Button><Button variant="quiet" icon={ArrowDownToLine} onClick={downloadPdf} disabled={!pdfId}>Download</Button></div></section>;
}

function StudentBookmarks({ practicalList, bookmarkedIds, subjectList = [] }) {
  const subjectPool = subjectList.map(normalizeSubjectFromApi).filter(Boolean);
  const items = (practicalList || []).map(normalizePracticalFromApi).filter((item) => item && bookmarkedIds.includes(item.id));
  const navigate = useNavigate();
  return <><PageHeading eyebrow="SAVED LEARNING MATERIAL" title="Bookmarks" description="A short list of practicals you want to return to." />{items.length ? <section className="surface practical-list">{items.map((item) => <PracticalRow key={item.id} practical={item} subject={subjectPool.find((entry) => String(entry.id) === String(item.subjectId))} onOpen={(practical) => navigate(`/student/practicals/${practical.id}`)} />)}</section> : <EmptyState title="No bookmarks yet" text="You haven't bookmarked any practical yet. Save a practical to find it here." icon={Bookmark} action={<Link to="/student/subjects" className="text-link">Browse my subjects <ArrowRight size={15} /></Link>} />}</>;
}

function MyraaPage() {
  const myraaUrl = import.meta.env.VITE_MYRAA_URL || 'http://localhost:3000';
  return <><PageHeading eyebrow="YOUR LEARNING COMPANION" title="Myraa voice assistant" description="Your Myraa assistant, connected from the existing voice assistant project." /><section className="myraa-embed"><iframe title="Myraa voice assistant" src={myraaUrl} allow="microphone; autoplay" /></section></>;
}

function ProfilePage({ user, role }) {
  const [saved, setSaved] = useState(false);
  const assignedSubjects = (user?.assignedSubjects || []).map((subject) => subject?.name || subject).filter(Boolean).join(', ');
  const details = role === 'student' ? [
    ['Full name', user?.name], ['Student ID / Roll number', user?.studentId], ['Email', user?.email],
    ['Department', user?.departmentId?.name || user?.departmentId],
    ['Year', user?.yearId?.name || user?.yearId], ['Semester', user?.semesterId?.name || user?.semesterId]
  ] : role === 'teacher' ? [
    ['Full name', user?.name], ['Employee ID', user?.employeeId], ['Email', user?.email],
    ['Department', user?.departmentId?.name || user?.departmentId], ['Assigned subjects', assignedSubjects]
  ] : [['Full name', user?.name], ['Email', user?.email], ['Role', 'Administrator']];
  return <><PageHeading eyebrow="ACCOUNT" title="My profile" description="Your account details and academic assignment." actions={<Button onClick={() => setSaved(true)} icon={Check}>{saved ? 'Changes saved' : 'Save changes'}</Button>} /><section className="surface profile-card"><div className="profile-banner"><div className="avatar avatar-large">{user?.name?.split(' ').map((part) => part[0]).slice(0, 2).join('') || 'U'}</div><div><h2>{user?.name}</h2><p>{roleNames[role]} · {user?.email}</p></div><Button variant="secondary" icon={Pencil} onClick={() => setSaved(false)}>Edit profile</Button></div><div className="profile-fields">{details.map(([label, value]) => <div className="profile-field" key={label}><span>{label}</span><strong>{value || 'Not provided'}</strong></div>)}</div></section></>;
}

function TeacherDashboard({ practicalList, user, subjectList = [] }) {
  const assignedSubjects = subjectList.map(normalizeSubjectFromApi).filter(Boolean);
  const subjects = assignedSubjects;
  const owned = practicalList.map(normalizePracticalFromApi).filter(Boolean);
  return <><PageHeading eyebrow="FACULTY WORKSPACE" title={`Welcome, ${user?.name || 'Teacher'}`} description="Manage your course material and guide students through their practical work." actions={<Link to="/teacher/practicals/add" className="button button-primary"><Plus size={16} />Add practical</Link>} /><div className="stat-grid"><Stat label="Assigned subjects" value={assignedSubjects.length} note="Current assignments" icon={BookOpen} /><Stat label="Total practicals" value={owned.length} note="Across your subjects" icon={ClipboardList} tone="green" /><Stat label="Published" value={owned.filter((item) => item.published).length} note="Visible to students" icon={CheckCircle2} tone="blue" /><Stat label="Drafts" value={owned.filter((item) => !item.published).length} note="Awaiting review" icon={FileText} tone="amber" /></div><div className="dashboard-columns"><section className="surface dashboard-panel"><div className="panel-heading"><div><p className="eyebrow">CONTENT ACTIVITY</p><h2>Recently updated</h2></div><Link to="/teacher/practicals" className="text-link">All practicals <ArrowRight size={14} /></Link></div>{owned.length ? owned.slice(0, 4).map((item) => <div className="activity-row" key={item.id}><span className="activity-file"><FileText size={17} /></span><div><strong>{item.title}</strong><small>{subjects.find((subject) => subject.id === item.subjectId)?.name} · Practical {number(item.practicalNumber)}</small></div><Status>{item.published ? 'Published' : 'Draft'}</Status></div>) : <EmptyState title="No practicals yet" text="Your published and draft practicals will appear here." icon={ClipboardList} />}</section><section className="surface dashboard-panel"><div className="panel-heading"><div><p className="eyebrow">YOUR COURSES</p><h2>Assigned subjects</h2></div></div>{assignedSubjects.length ? assignedSubjects.map((subject) => <Link to="/teacher/subjects" className="course-row" key={subject.id}><span className="subject-monogram">{subject.name.slice(0, 2).toUpperCase()}</span><span><strong>{subject.name}</strong><small>{subject.code}</small></span><ChevronRight size={16} /></Link>) : <EmptyState title="No subjects assigned" text="Your college will assign subjects to your account." icon={BookOpen} />}</section></div></>;
}

function TeacherSubjects({ subjectList = [] }) {
  const assigned = subjectList.map(normalizeSubjectFromApi).filter(Boolean);
  const subjects = assigned;
  const departments = subjects.map((item) => ({ id: item.departmentId, name: item.departmentName }));
  const semesters = subjects.map((item) => ({ id: item.semesterId, name: item.semesterName }));
  return <><PageHeading eyebrow="FACULTY WORKSPACE" title="My subjects" description="Courses assigned to you for the current semester." />{assigned.length ? <div className="subject-grid">{assigned.map((subject) => <article className="subject-tile teacher-subject" key={subject.id}><div className="tile-top"><span className="subject-monogram">{subject.name.slice(0, 2).toUpperCase()}</span><span className="tile-code">{subject.code}</span></div><h3>{subject.name}</h3><p>{subject.description}</p><div className="tile-footer"><span><ClipboardList size={15} />{subject.practicalCount} practicals</span><span className="muted-inline">{departments.find((item) => item.id === subject.departmentId)?.name || subject.departmentId} · {semesters.find((item) => item.id === subject.semesterId)?.name || subject.semesterId}</span></div></article>)}</div> : <EmptyState title="No assigned subjects" text="Your assigned subjects will appear here." />}</>;
}

function TeacherPracticalList({ practicalList, subjectList = [], subjectIds, onDelete, onTogglePublish, notify }) {
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const subjects = subjectList.map(normalizeSubjectFromApi).filter(Boolean);
  const rows = (practicalList || []).map(normalizePracticalFromApi).filter(Boolean).filter((item) => subjectIds.has(String(item.subjectId))).filter((item) => (filter === 'All' || (filter === 'Published' ? item.published : !item.published)) && (item.title || '').toLowerCase().includes(query.toLowerCase()));
  return <><PageHeading eyebrow="CONTENT MANAGEMENT" title="Practicals" description="Review, publish and maintain your practical material." actions={<Link to="/teacher/practicals/add" className="button button-primary"><Plus size={16} />Add practical</Link>} /><div className="table-toolbar"><label className="field-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search practicals" /></label><div className="segmented-control">{['All', 'Published', 'Drafts'].map((value) => <button key={value} className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{value}</button>)}</div></div><div className="surface data-table-wrap"><table className="data-table"><thead><tr><th>Practical</th><th>Subject</th><th>Source PDF</th><th>Status</th><th>Last updated</th><th /></tr></thead><tbody>{rows.map((item) => <tr key={item.id}><td><span className="table-title"><b>{number(item.practicalNumber)}</b><span><strong>{item.title}</strong><small>Practical {number(item.practicalNumber)}</small></span></span></td><td>{subjects.find((subject) => subject.id === item.subjectId)?.name || item.subjectId}</td><td><span className="file-label"><FileText size={15} />Original PDF</span></td><td><Status>{item.published ? 'Published' : 'Draft'}</Status></td><td>{item.updatedAt || '—'}</td><td><div className="table-actions"><button className="icon-button" title="Edit practical" onClick={() => navigate(`/teacher/practicals/${item.id}/edit`)}><Pencil size={15} /></button><button className="icon-button" title={item.published ? 'Unpublish' : 'Publish'} onClick={() => onTogglePublish(item)}><CheckCircle2 size={15} /></button><button className="icon-button danger-action" title="Delete practical" onClick={() => { if (window.confirm(`Delete ${item.title}?`)) onDelete(item.id); }}><X size={15} /></button></div></td></tr>)}</tbody></table>{!rows.length && <EmptyState title="No practicals found" text="Try another search or create a new practical." icon={ClipboardList} />}</div></>;
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

function AdminDashboard({ practicalList, teacherList = [], studentList = [], catalog, subjectList = [] }) {
  const departments = catalog.departments;
  const years = catalog.years;
  const semesters = catalog.semesters;
  const subjects = subjectList;
  const teachers = teacherList;
  const students = studentList;
  const quickAccess = [
    ['Departments', '/admin/departments', Building2, departments.length],
    ['Academic years', '/admin/years', GraduationCap, years.length],
    ['Semesters', '/admin/semesters', Activity, semesters.length],
    ['Subjects', '/admin/subjects', BookOpen, subjects.length]
  ];
  return <><PageHeading eyebrow="COLLEGE ADMINISTRATION" title="Administration overview" description="A clear view of configured academic structure and registered accounts." actions={<Link to="/admin/subjects" className="button button-secondary"><Plus size={16} />Add subject</Link>} /><div className="stat-grid admin-stat-grid"><Stat label="Departments" value={departments.length} note="Configured records" icon={Building2} /><Stat label="Teachers" value={teachers.length} note="Registered accounts" icon={Users} tone="green" /><Stat label="Students" value={students.length} note="Registered accounts" icon={GraduationCap} tone="blue" /><Stat label="Subjects" value={subjects.length} note="Configured records" icon={BookOpen} tone="amber" /><Stat label="Practicals" value={practicalList.length} note="Configured records" icon={ClipboardList} tone="slate" /></div><div className="admin-dashboard-columns"><section className="surface dashboard-panel"><div className="panel-heading"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Latest updates</h2></div></div><EmptyState title="No recent activity" text="Activity will appear here when records are added or updated." icon={Activity} /></section><section className="surface dashboard-panel"><div className="panel-heading"><div><p className="eyebrow">ACADEMIC STRUCTURE</p><h2>Quick access</h2></div></div>{quickAccess.map(([label, to, Icon, count]) => <Link className="quick-row" to={to} key={to}><span><Icon size={17} /></span><strong>{label}</strong><small>{count} records</small><ChevronRight size={16} /></Link>)}</section></div></>;
}

function AdminManagement({ page, notify, practicalList }) {
  const metadata = {
    departments: { title: 'Departments', eyebrow: 'ACADEMIC STRUCTURE', description: 'Manage departments and academic access.', columns: ['Department', 'Code', 'Status'] },
    years: { title: 'Academic years', eyebrow: 'ACADEMIC STRUCTURE', description: 'Configure year groups used for student and subject assignments.', columns: ['Year', 'Code', 'Status', 'Order'] },
    semesters: { title: 'Semesters', eyebrow: 'ACADEMIC STRUCTURE', description: 'Manage semester names across academic years.', columns: ['Semester', 'Code', 'Year', 'Status'] },
    subjects: { title: 'Subjects', eyebrow: 'CURRICULUM', description: 'Subjects are assigned by department, year and semester.', columns: ['Subject', 'Code', 'Department', 'Year', 'Semester', 'Status'] },
    teachers: { title: 'Teachers', eyebrow: 'PEOPLE', description: 'Review registered faculty accounts and their assignments.', columns: ['Teacher', 'Employee ID', 'Department', 'Assigned subjects', 'Status'] },
    students: { title: 'Students', eyebrow: 'PEOPLE', description: 'Student academic mappings determine which subjects they can access.', columns: ['Student', 'Roll number', 'Department', 'Year', 'Semester', 'Status'] },
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
    setRecords(page === 'years' ? getAcademicYearOptions(items) : items);
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
          setRecords(page === 'years' ? getAcademicYearOptions(items) : items);
          setCatalog({
            departments: departmentResponse?.data?.departments || [],
            years: getAcademicYearOptions(yearResponse?.data?.years || []),
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
          : page === 'teachers' ? records.map((teacher) => [teacher.name, teacher.employeeId || '—', referenceName(teacher.departmentId), (teacher.assignedSubjects || []).map(referenceName).join(', ') || 'Not assigned', teacher.status || '—'])
            : page === 'students' ? records.map((student) => [student.name, student.studentId || '—', referenceName(student.departmentId), referenceName(student.yearId), referenceName(student.semesterId), student.status || '—'])
              : records.slice(0, 8).map((item) => [item.title, referenceName(item.subjectId), `Practical ${number(item.practicalNumber)}`, item.status === 'published' ? 'Published' : 'Draft', item.updatedAt || '—']);
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
    } catch {
      setFormError(page === 'semesters'
        ? `Unable to ${editing ? 'update' : 'add'} semester. Please try again.`
        : `Unable to ${editing ? 'update' : 'add'} ${typeTitle.toLowerCase()}. Please try again.`);
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
    } catch { setDeleteError('Unable to delete this record. Please try again.'); }
    finally { setDeleting(false); }
  };
  const editable = ['departments', 'years', 'semesters', 'subjects'].includes(page);
  const updateField = (key) => (event) => setFields((current) => ({ ...current, [key]: event.target.value }));
  return <>
    <PageHeading eyebrow={data.eyebrow} title={data.title} description={data.description} actions={editable && <Button icon={Plus} onClick={openCreate}>{actionLabel}</Button>} />
    <div className="table-toolbar"><label className="field-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${data.title.toLowerCase()}`} /></label><span className="muted-inline">{filtered.length} records</span></div>
    <div className="surface data-table-wrap"><table className="data-table"><thead><tr>{data.columns.map((column) => <th key={column}>{column}</th>)}<th>Actions</th></tr></thead><tbody>{filtered.map(({ row, record }, index) => <tr key={`${row[0]}-${index}`}>{row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`}>{cell === 'Active' || cell === 'inactive' || cell === 'Published' || cell === 'Draft' ? <Status>{cell}</Status> : cell}</td>)}<td><div className="table-actions">{editable && <><button className="icon-button" title="Edit record" onClick={() => openEdit(record)}><Pencil size={15} /></button><button className="icon-button danger-action" title="Delete record" onClick={() => removeRecord(record)}><X size={15} /></button></>}</div></td></tr>)}</tbody></table>{!filtered.length && <EmptyState title="No matching records" text={query ? 'Try another search term.' : 'Add a record to begin building your academic structure.'} />}</div>
    {formOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setFormOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="academic-modal-title" className="w-full max-w-xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-xl sm:p-6"><div className="mb-5 flex items-start justify-between gap-4"><div><p className="eyebrow">{editing ? 'EDIT ACADEMIC RECORD' : 'ACADEMIC STRUCTURE'}</p><h2 id="academic-modal-title" className="text-xl font-bold text-slate-800">{editing ? `Edit ${typeTitle}` : actionLabel}</h2></div><button className="icon-button" type="button" aria-label="Close form" disabled={saving} onClick={() => setFormOpen(false)}><X size={17} /></button></div><form noValidate onSubmit={saveRecord} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label className="form-field sm:col-span-2"><span>{typeTitle} Name</span><input autoFocus value={fields.name} onChange={updateField('name')} placeholder={page === 'semesters' ? 'Enter semester name' : `Enter ${typeTitle.toLowerCase()} name`} /></label>
      {page !== 'years' && <label className="form-field"><span>{page === 'departments' ? 'Department Code' : page === 'semesters' ? 'Semester Code' : 'Subject Code'}</span><input value={fields.code} onChange={updateField('code')} placeholder={page === 'semesters' ? 'Optional (e.g. SEM5)' : 'Optional'} /></label>}
      {page === 'departments' && <label className="form-field sm:col-span-2"><span>Description</span><textarea rows="3" value={fields.description} onChange={updateField('description')} placeholder="Optional description" /></label>}
      {page === 'years' && <label className="form-field"><span>Order</span><input type="number" min="1" value={fields.order} onChange={updateField('order')} /></label>}
      {page === 'semesters' && <><label className="form-field"><span>Semester Number</span><select value={fields.number} onChange={updateField('number')}>{Array.from({ length: 8 }, (_, index) => String(index + 1)).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label className="form-field sm:col-span-2"><span>Academic Year</span><select value={fields.yearId} onChange={updateField('yearId')}><option value="">Select a year</option>{catalog.years.map((year) => <option key={year._id} value={year._id}>{year.name}</option>)}</select></label></>}
      {page === 'subjects' && <><label className="form-field sm:col-span-2"><span>Description</span><textarea rows="2" value={fields.description} onChange={updateField('description')} placeholder="Optional description" /></label><label className="form-field"><span>Department</span><select value={fields.departmentId} onChange={updateField('departmentId')}><option value="">Select a department</option>{catalog.departments.map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}</select></label><label className="form-field"><span>Year</span><select value={fields.yearId} onChange={(event) => setFields((current) => ({ ...current, yearId: event.target.value, semesterId: '' }))}><option value="">Select a year</option>{catalog.years.map((year) => <option key={year._id} value={year._id}>{year.name}</option>)}</select></label><label className="form-field sm:col-span-2"><span>Semester</span><select value={fields.semesterId} onChange={updateField('semesterId')}><option value="">Select a semester</option>{catalog.semesters.filter((semester) => !fields.yearId || String(semester.yearId?._id || semester.yearId) === String(fields.yearId)).map((semester) => <option key={semester._id} value={semester._id}>{semester.name}</option>)}</select></label></>}
      <label className="form-field"><span>Status</span><select value={fields.status} onChange={updateField('status')}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
      {formError && <p className="sm:col-span-2 text-sm text-red-700" role="alert">{formError}</p>}
      <div className="sm:col-span-2 flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" className="button button-secondary" disabled={saving} onClick={() => setFormOpen(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? page === 'semesters' ? editing ? 'Updating...' : 'Adding...' : 'Saving...' : page === 'semesters' ? editing ? 'Update Semester' : 'Add Semester' : editing ? 'Save changes' : actionLabel}</button></div>
    </form></section></div>}
    {deletingRecord && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setDeletingRecord(null); }}><section role="alertdialog" aria-modal="true" aria-labelledby="delete-modal-title" className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl"><div className="mb-5 flex items-start justify-between gap-4"><div><p className="eyebrow">CONFIRM DELETE</p><h2 id="delete-modal-title" className="text-xl font-bold text-slate-800">{page === 'semesters' ? 'Delete Semester?' : `Delete ${typeTitle}?`}</h2></div><button className="icon-button" type="button" aria-label="Close confirmation" disabled={deleting} onClick={() => setDeletingRecord(null)}><X size={17} /></button></div><p className="mb-5 text-sm text-slate-600">{page === 'semesters' ? 'Are you sure you want to delete this semester?' : `Are you sure you want to delete ${deletingRecord.name}?`}</p>{deleteError && <p className="mb-4 text-sm text-red-700" role="alert">{deleteError}</p>}<div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" className="button button-secondary" disabled={deleting} onClick={() => setDeletingRecord(null)}>Cancel</button><button type="button" className="button button-primary" disabled={deleting} onClick={confirmDelete}>{deleting ? 'Deleting...' : 'Delete'}</button></div></section></div>}
  </>;
}

function AdminSettings({ notify }) {
  const [enabled, setEnabled] = useState({ registrations: true, notifications: true, ai: false });
  const [general, setGeneral] = useState({ collegeName: '', academicYear: '', semesterStatus: '' });
  const update = (key) => (event) => setGeneral((current) => ({ ...current, [key]: event.target.value }));
  return <><PageHeading eyebrow="CONFIGURATION" title="Settings" description="Manage portal-wide preferences and account access." actions={<Button onClick={() => notify('Portal settings saved.')}>Save settings</Button>} /><div className="settings-grid"><section className="surface settings-panel"><div className="panel-heading"><div><p className="eyebrow">PORTAL PREFERENCES</p><h2>General</h2></div><Settings size={18} /></div><label className="form-field"><span>College name</span><input value={general.collegeName} onChange={update('collegeName')} placeholder="Enter college name" /></label><label className="form-field"><span>Academic year</span><input value={general.academicYear} onChange={update('academicYear')} placeholder="Enter academic year" /></label><label className="form-field"><span>Default semester status</span><select value={general.semesterStatus} onChange={update('semesterStatus')}><option value="">Choose status</option><option>In progress</option><option>Upcoming</option><option>Completed</option></select></label></section><section className="surface settings-panel"><div className="panel-heading"><div><p className="eyebrow">ACCESS & SERVICES</p><h2>Portal controls</h2></div><ShieldCheck size={18} /></div>{[['registrations', 'Student registration', 'Allow new student registrations'], ['notifications', 'Email notifications', 'Send updates for published practicals'], ['ai', 'AI PDF analysis', 'Enable the teacher analysis interface']].map(([key, title, description]) => <label className="setting-toggle" key={key}><span><strong>{title}</strong><small>{description}</small></span><input type="checkbox" checked={enabled[key]} onChange={() => setEnabled((value) => ({ ...value, [key]: !value[key] }))} /></label>)}</section></div></>;
}

export default function PortalExperience() {
  const { user, setUser, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const role = location.pathname.split('/')[1] || 'student';
  const route = `/${location.pathname.split('/').slice(2).join('/')}`.replace(/\/$/, '') || '/dashboard';
  const [search, setSearch] = useState('');
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [bookmarkedIds, setBookmarkedIds] = useState([]);
  const [practicalList, setPracticalList] = useState([]);
  const [studentSubjectList, setStudentSubjectList] = useState([]);
  const [studentPracticalList, setStudentPracticalList] = useState([]);
  const [completedIds, setCompletedIds] = useState([]);
  const [teacherSubjectList, setTeacherSubjectList] = useState([]);
  const [teacherPracticalList, setTeacherPracticalList] = useState([]);
  const [teacherStudentList, setTeacherStudentList] = useState([]);
  const [adminTeacherList, setAdminTeacherList] = useState([]);
  const [adminStudentList, setAdminStudentList] = useState([]);
  const [adminSubjectList, setAdminSubjectList] = useState([]);
  const [adminCatalog, setAdminCatalog] = useState({ departments: [], years: [], semesters: [] });
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(''), 2800); };

  const refreshTeacherData = async () => {
    const [subjectResponse, practicalResponse, studentResponse] = await Promise.all([
      teacherService.getSubjects(),
      teacherService.getPracticals(),
      teacherService.getStudents()
    ]);
    setTeacherSubjectList(subjectResponse?.data?.subjects || []);
    setTeacherPracticalList(practicalResponse?.data?.practicals || []);
    setTeacherStudentList(studentResponse?.data?.students || []);
  };

  useEffect(() => {
    if (!user || !token) return;
    let isMounted = true;

    const loadAcademicData = async () => {
      setDataLoading(true);
      setDataError('');
      try {
        if (user.role === 'student') {
          const [subjectResponse, practicalResponse, progressResponse, bookmarkResponse] = await Promise.all([
            api.get('/student/subjects'),
            api.get('/student/practicals'),
            progressService.getAll(),
            bookmarkService.getAll()
          ]);

          if (!isMounted) return;
          setStudentSubjectList(subjectResponse?.data?.subjects || []);
          setStudentPracticalList(practicalResponse?.data?.practicals || []);
          setCompletedIds((progressResponse?.data?.progress || []).map((item) => String(item.practicalId?._id || item.practicalId)));
          setBookmarkedIds((bookmarkResponse?.data?.bookmarks || []).map((item) => String(item.practicalId?._id || item.practicalId)));
        }

        if (user.role === 'teacher') {
          await refreshTeacherData();
        }

        if (user.role === 'admin') {
          const [practicals, teachers, students, subjects, departments, years, semesters] = await Promise.all([
            api.get('/admin/practicals'), api.get('/admin/teachers'), api.get('/admin/students'), api.get('/admin/subjects'),
            departmentService.getAll(), yearService.getAll(), semesterService.getAll()
          ]);
          if (!isMounted) return;
          setPracticalList(practicals?.data?.practicals || []);
          setAdminTeacherList(teachers?.data?.teachers || []);
          setAdminStudentList(students?.data?.students || []);
          setAdminSubjectList(subjects?.data?.subjects || []);
          setAdminCatalog({
            departments: departments?.data?.departments || [],
            years: getAcademicYearOptions(years?.data?.years || []),
            semesters: semesters?.data?.semesters || []
          });
        }
      } catch (error) {
        if (!isMounted) return;
        setDataError(error.message || 'Unable to load your academic data.');
        notify(error.message || 'Unable to load your academic data.');
      } finally {
        if (isMounted) setDataLoading(false);
      }
    };

    loadAcademicData();
    return () => {
      isMounted = false;
    };
  }, [user, token]);

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
      if (wasComplete) await progressService.uncomplete(id);
      else await progressService.complete(id);
      setCompletedIds((current) => wasComplete ? current.filter((item) => item !== String(id)) : [...current, String(id)]);
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
  let page;

  if (dataLoading && !(role === 'student' && ['/myraa', '/profile'].includes(route))) {
    page = <EmptyState title={role === 'student' ? 'Loading practicals...' : 'Loading workspace data...'} text="Fetching the latest records from the college database." icon={LoaderCircle} />;
  } else if (dataError && (role !== 'student' || !['/myraa', '/profile'].includes(route))) {
    page = <EmptyState title="Unable to load database records" text={dataError} action={<Button onClick={() => window.location.reload()}>Try again</Button>} icon={Activity} />;
  } else if (role === 'student') {
    const activeStudentPracticals = studentPracticalList;
    const activeStudentSubjects = studentSubjectList;
    if (route === '/dashboard') page = <StudentDashboard user={user} practicalList={activeStudentPracticals} bookmarkedIds={bookmarkedIds} subjectList={activeStudentSubjects} completedIds={completedIds} />;
    else if (route === '/subjects') page = <StudentSubjects user={user} practicalList={activeStudentPracticals} subjectList={activeStudentSubjects} completedIds={completedIds} />;
    else if (subjectMatch) page = <StudentSubjectDetail subjectId={subjectMatch[1]} subjectList={activeStudentSubjects} completedIds={completedIds} />;
    else if (route === '/practicals') page = <StudentPracticals practicalList={activeStudentPracticals} subjectList={activeStudentSubjects} completedIds={completedIds} />;
    else if (practicalMatch) page = <StudentPracticalDetail practicalId={practicalMatch[1]} bookmarkedIds={bookmarkedIds} toggleBookmark={toggleBookmark} completePractical={completePractical} notify={notify} subjectList={activeStudentSubjects} completedIds={completedIds} />;
    else if (route === '/bookmarks') page = <StudentBookmarks practicalList={activeStudentPracticals} bookmarkedIds={bookmarkedIds} subjectList={activeStudentSubjects} />;
    else if (route === '/myraa') page = <MyraaPage />;
    else if (route === '/profile') page = <ProfilePage user={user} role={role} />;
    else if (route === '/notifications') { const notices = notifications.filter((item) => item.role === role); page = <><PageHeading eyebrow="UPDATES" title="Notifications" description="Recent updates for your courses." />{notices.length ? notices.map((item) => <div className="surface notification-full" key={item.id}><span className="notification-dot" /><strong>{item.title}</strong><small>{item.time}</small></div>) : <EmptyState title="No notifications yet" text="Updates will appear here when your college publishes them." icon={Bell} />}</>; }
  } else if (role === 'teacher') {
    const teacherSubjects = teacherSubjectList;
    const teacherPracticals = teacherPracticalList;
    if (route === '/dashboard') page = <TeacherDashboard practicalList={teacherPracticals} user={user} subjectList={teacherSubjects} />;
    else if (route === '/subjects') page = <TeacherSubjects user={user} subjectList={teacherSubjects} />;
    else if (route === '/practicals') page = <TeacherPracticalList practicalList={teacherPracticals} subjectList={teacherSubjects} subjectIds={new Set(teacherSubjects.map((item) => String(item._id || item.id)))} onDelete={deletePractical} onTogglePublish={togglePublished} notify={notify} />;
    else if (route === '/practicals/add') page = <TeacherPracticalModal user={user} notify={notify} onSaved={refreshTeacherData} />;
    else if (route.endsWith('/edit')) { const item = teacherPracticals.find((practical) => String(practical._id || practical.id) === String(practicalMatch?.[1])); page = <TeacherPracticalModal practical={item} user={user} notify={notify} onSaved={refreshTeacherData} />; }
    else if (practicalMatch) { const item = teacherPracticals.map(normalizePracticalFromApi).filter(Boolean).find((practical) => String(practical.id) === String(practicalMatch[1])); page = <><PageHeading eyebrow="PRACTICAL DETAIL" title={item?.title || 'Practical'} description="Review the original file and generated student learning guide." actions={<Link to={`/teacher/practicals/${item?.id}/edit`} className="button button-secondary"><Pencil size={15} />Edit practical</Link>} /><div className="surface practical-preview"><h2>Student learning guide</h2><p><strong>Aim</strong><br />{item?.aim}</p><p><strong>About</strong><br />{item?.about}</p><div className="pdf-actions"><Button variant="secondary" onClick={() => notify('Original PDF preview is available after upload.')}>Open original PDF</Button><Button onClick={() => togglePublished(item)}>{item?.published ? 'Unpublish' : 'Publish'}</Button></div></div></>; }
    else if (route === '/students') page = <TeacherStudents studentList={teacherStudentList} />;
    else if (route === '/profile') page = <ProfilePage user={user} role={role} />;
  } else if (role === 'admin') {
    if (route === '/dashboard') page = <AdminDashboard practicalList={practicalList} teacherList={adminTeacherList} studentList={adminStudentList} catalog={adminCatalog} subjectList={adminSubjectList} />;
    else if (['/departments', '/years', '/semesters', '/subjects', '/teachers', '/students', '/practicals'].includes(route)) page = <AdminManagement page={route.slice(1)} practicalList={practicalList} notify={notify} />;
    else if (route === '/settings') page = <AdminSettings notify={notify} />;
    else if (route === '/profile') page = <ProfilePage user={user} role={role} />;
  }
  if (!page) page = <EmptyState title="Page not found" text="This workspace page is not available." action={<Link to={roleHome[role]} className="text-link">Return to overview</Link>} />;

  const searchSubjects = role === 'student' ? studentSubjectList : role === 'teacher' ? teacherSubjectList : adminSubjectList;
  const searchPracticals = role === 'student' ? studentPracticalList : role === 'teacher' ? teacherPracticalList : practicalList;
  return <DashboardShell role={role} user={user} search={search} setSearch={setSearch} notificationOpen={notificationOpen} setNotificationOpen={setNotificationOpen} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} onLogout={logout} searchSubjects={searchSubjects} searchPracticals={searchPracticals}><div className="page-enter">{page}</div><div className={`toast ${toast ? 'toast-visible' : ''}`} role="status"><CheckCircle2 size={17} />{toast}</div></DashboardShell>;
}