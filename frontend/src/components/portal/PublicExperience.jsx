import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight, BookOpen, Check, ChevronRight, ClipboardList, FileText,
  GraduationCap, Instagram, Linkedin, LockKeyhole, Mail, Phone, ShieldCheck, Sparkles, Users
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../common/ThemeToggle';
import api from '../../services/api';
import { getAcademicYearOptions } from '../../utils/academicYear';
import krushnaPhoto from '../../../krushna.jpeg';

const roleDestinations = { student: '/student/dashboard', teacher: '/teacher/dashboard', admin: '/admin/dashboard' };
const roleCopy = {
  student: ['Student', 'Access your assigned subjects, practicals and learning material.', GraduationCap],
  teacher: ['Teacher', 'Manage practicals and share reviewed learning resources.', Users],
  admin: ['Administrator', 'Manage users, curriculum and academic structure.', ShieldCheck]
};
const loginRoleOptions = [
  { label: 'Student', value: 'student' },
  { label: 'Teacher', value: 'teacher' }
];
const normalizeLoginRole = (value) => loginRoleOptions.find((option) => option.value === value || option.label === value)?.value || 'student';

function PublicHeader() {
  return <header className="public-header"><Link to="/" className="brand-lockup"><span className="brand-mark"><BookOpen size={19} /></span><span><strong>College Practical Portal</strong><small>ALL YOUR PRACTICALS. ONE PLACE.</small></span></Link><nav className="public-nav" aria-label="Main navigation"><Link to="/">Home</Link><a href="/#features">Features</a><a href="/#how-it-works">How it works</a><a href="/#about">About</a></nav><div className="public-actions"><ThemeToggle /><Link to="/login" className="button button-quiet">Log in</Link><Link to="/select-role" className="button button-primary">Get started <ArrowRight size={15} /></Link></div></header>;
}

function LandingPage() {
  return <div className="public-page"><PublicHeader /><main>
    <section className="hero-section"><div className="hero-inner"><div className="hero-copy"><p className="eyebrow"><span className="eyebrow-rule" />A BETTER WAY TO LEARN IN THE LAB</p><h1>All your practicals.<br /><span>One place.</span></h1><p className="hero-description">Access subject-wise practicals, original PDFs, step-by-step guidance and learning resources through one simple college portal.</p><div className="hero-actions"><Link to="/select-role" className="button button-primary button-large">Get started <ArrowRight size={17} /></Link><a href="#features" className="button button-secondary button-large">Explore features <ChevronRight size={16} /></a></div><div className="hero-proof"><span><Check size={14} />Organized by your semester</span><span><Check size={14} />Teacher-reviewed material</span></div></div><div className="hero-preview"><div className="preview-topline"><span className="preview-dot" /><span>STUDENT WORKSPACE</span><span className="preview-term">COLLEGE PORTAL</span></div><div className="preview-heading"><div><small>YOUR ACADEMIC WORKSPACE</small><h2>Courses appear here.</h2></div><span className="preview-avatar">U</span></div><div className="preview-empty"><BookOpen size={24} /><strong>No subjects assigned yet</strong><span>Your course list will appear after academic assignments are configured.</span></div><div className="preview-footer"><span><ShieldCheck size={14} />Academic assignments are managed by your college</span><ArrowRight size={15} /></div></div></div><div className="hero-bottom-note"><span>BUILT FOR EVERY STEP OF PRACTICAL LEARNING</span><span>ACADEMIC WORKSPACE</span></div></section>
    <section className="feature-strip" id="features"><div><BookOpen size={19} /><span>Subject-wise practicals</span></div><div><FileText size={19} /><span>Original PDF access</span></div><div><ClipboardList size={19} /><span>Step-by-step guidance</span></div><div><Sparkles size={19} /><span>AI-powered assistance</span></div></section>
    <section className="how-section content-section" id="how-it-works"><div className="section-intro"><p className="eyebrow">A CLEAR PATH THROUGH EVERY PRACTICAL</p><h2>From your timetable<br />to your lab book.</h2><p>Everything is organized around your academic assignment, so the right learning material is easy to find.</p></div><div className="steps-grid">{[['01', 'Register', 'Create your account with your college details.'], ['02', 'Set your academic details', 'Choose your department, year and semester.'], ['03', 'See your subjects', 'Your curriculum is matched automatically.'], ['04', 'Open a practical', 'Find the aim, concepts and original handout.'], ['05', 'Learn step by step', 'Work through the procedure at your own pace.']].map(([number, title, copy]) => <article className="step-item" key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
    <section className="audience-section content-section" id="about"><div className="audience-heading"><div><p className="eyebrow">ONE PORTAL. THREE PERSPECTIVES.</p><h2>Built for the whole college.</h2></div><p>One shared academic structure keeps students, teachers and administrators in sync.</p></div><div className="audience-grid"><article><span className="audience-icon"><GraduationCap size={20} /></span><h3>Students</h3><p>Find the right subject, understand each practical and keep your progress moving.</p><Link to="/select-role?role=student">Explore student access <ArrowRight size={15} /></Link></article><article><span className="audience-icon"><Users size={20} /></span><h3>Teachers</h3><p>Prepare practical resources, review generated guidance and publish with confidence.</p><Link to="/select-role?role=teacher">Explore teacher access <ArrowRight size={15} /></Link></article><article><span className="audience-icon"><ShieldCheck size={20} /></span><h3>Administrators</h3><p>Keep departments, academic years, semesters and assignments organized.</p><Link to="/owner-profile">Website administrator <ArrowRight size={15} /></Link></article></div></section>
    <section className="why-section content-section"><div><p className="eyebrow">MADE FOR REAL COURSEWORK</p><h2>Less searching.<br />More understanding.</h2><p className="why-copy">Your practical resources belong together. Find the source document, a clear explanation and your course context in one dependable workspace.</p><Link to="/select-role" className="text-link">Find your workspace <ArrowRight size={15} /></Link></div><div className="why-points">{['Centralized practical resources', 'Organized by semester and subject', 'Teacher-managed course content', 'Student-friendly explanations', 'Original PDFs stay untouched', 'Myraa learning assistant, kept separate'].map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item}</strong><Check size={16} /></div>)}</div></section>
  </main><footer className="public-footer"><div className="footer-main"><Link to="/" className="brand-lockup"><span className="brand-mark"><BookOpen size={19} /></span><span><strong>College Practical Portal</strong><small>ALL YOUR PRACTICALS. ONE PLACE.</small></span></Link><p>Practical learning, thoughtfully organized.</p><div className="footer-links"><a href="#features">Features</a><Link to="/login">Login</Link><Link to="/register">Register</Link><a href="mailto:portal@college.edu">Contact</a><button onClick={() => window.alert('Privacy information will be available when the portal is connected to college policy.')}>Privacy</button><button onClick={() => window.alert('Terms will be available when the portal is connected to college policy.')}>Terms</button></div></div><Link to="/owner-profile" className="footer-owner-link"><img src={krushnaPhoto} alt="Krushna Rajpure" /><span><small>WEBSITE ADMINISTRATOR</small><strong>Krushna Rajpure</strong></span><ArrowRight size={17} aria-hidden="true" /></Link><div className="footer-meta"><span>© 2026 College Practical Portal</span><span>For the college community</span></div></footer></div>;
}

function OwnerProfilePage() {
  const contactLinks = [
    { label: 'Email', value: 'krushnarajpure93@gmail.com', href: 'mailto:krushnarajpure93@gmail.com', Icon: Mail },
    { label: 'Phone', value: '9860894960', href: 'tel:9860894960', Icon: Phone },
    { label: 'Instagram', value: '@krushna_rajpure', href: 'https://www.instagram.com/krushna_rajpure/', Icon: Instagram, external: true },
    { label: 'LinkedIn', value: 'krushna_rajpure', href: 'https://www.linkedin.com/in/krushna_rajpure/', Icon: Linkedin, external: true }
  ];

  return <div className="public-page owner-profile-page">
    <PublicHeader />
    <main className="owner-profile-main">
      <Link to="/" className="owner-profile-back"><ArrowRight size={15} />Back to portal</Link>
      <section className="owner-profile-card" aria-labelledby="owner-profile-name">
        <div className="owner-profile-photo-wrap"><img className="owner-profile-photo" src={krushnaPhoto} alt="Krushna Rajpure" /></div>
        <div className="owner-profile-copy">
          <p className="eyebrow">WEBSITE ADMINISTRATOR</p>
          <h1 id="owner-profile-name">Krushna Rajpure</h1>
          <p className="owner-profile-role">College Practical Portal</p>
          <p className="owner-profile-description">Building a clear, reliable place for students and teachers to manage practical learning resources.</p>
          <Link to="/owner-profile/admin-login" className="button button-primary owner-admin-link">Administrator sign in <ArrowRight size={15} /></Link>
        </div>
      </section>
      <section className="owner-contact-section" aria-labelledby="owner-contact-title">
        <div className="owner-contact-heading"><p className="eyebrow">GET IN TOUCH</p><h2 id="owner-contact-title">Contact</h2></div>
        <div className="owner-contact-grid">{contactLinks.map(({ label, value, href, Icon, external }) => <a className="owner-contact-card" href={href} key={label} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}><span className="owner-contact-icon"><Icon size={18} aria-hidden="true" /></span><span className="owner-contact-copy"><small>{label}</small><strong>{value}</strong></span><ArrowRight className="owner-contact-arrow" size={15} aria-hidden="true" /></a>)}</div>
      </section>
    </main>
    <footer className="public-footer owner-profile-footer"><div className="footer-meta"><span>© 2026 College Practical Portal</span><Link to="/">Back to the portal</Link></div></footer>
  </div>;
}

function RoleSelection() {
  const [params] = useSearchParams();
  const suggested = params.get('role');
  return <div className="auth-page role-selection-page">
    <PublicHeader />
    <main className="role-selection-main">
      <div className="role-selection-heading">
        <div>
          <p className="eyebrow">COLLEGE PRACTICAL PORTAL <span>·</span> GET STARTED</p>
          <h1>Choose your workspace</h1>
          <p>Select the account that matches your role in the college.</p>
        </div>
        <div className="role-selection-note"><ShieldCheck size={18} /><span>Coursework and practicals are organized around your college account.</span></div>
      </div>
      <div className="role-grid">{Object.entries(roleCopy).filter(([role]) => role !== 'admin').map(([role, [title, description, Icon]], index) => <article key={role} className={`role-card ${suggested === role ? 'role-card-suggested' : ''}`}>
        <div className="role-card-top"><span className="role-icon"><Icon size={22} /></span><span className="role-card-index">0{index + 1}</span></div>
        <p className="role-card-audience">{role === 'student' ? 'FOR LEARNERS' : 'FOR FACULTY'}</p>
        <h2>{title}</h2>
        <p className="role-card-description">{description}</p>
        <div className="role-card-actions"><Link to={`/register?role=${role}`} className="role-continue">Create {title.toLowerCase()} account <ArrowRight size={16} /></Link><Link className="role-login" to={`/login?role=${role}`}>Already have an account? <strong>Sign in</strong></Link></div>
      </article>)}</div>
      <Link className="role-admin-access" to="/owner-profile"><span><LockKeyhole size={16} /><span><strong>College administrator?</strong><small>Administrator access is available from the website profile.</small></span></span><ArrowRight size={16} /></Link>
    </main>
  </div>;
}

function AuthPage({ mode = 'login' }) {
  const { login, register } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const adminLoginMode = mode === 'admin-login';
  const [role, setRole] = useState(() => adminLoginMode ? 'admin' : normalizeLoginRole(params.get('role')));
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [years, setYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [fields, setFields] = useState({ fullName: '', studentId: '', employeeId: '', email: '', password: '', confirmPassword: '', departmentId: '', yearId: '', semesterId: '' });
  const update = (key) => (event) => setFields((current) => ({ ...current, [key]: event.target.value }));
  const updateYear = (event) => setFields((current) => ({ ...current, yearId: event.target.value, semesterId: '' }));
  const availableSemesters = semesters.filter((semester) => String(semester.yearId?._id || semester.yearId) === String(fields.yearId));
  const registerMode = mode === 'register';
  const forgotMode = mode === 'forgot';

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [departmentData, yearData, semesterData] = await Promise.all([
          api.get('/public/departments'),
          api.get('/public/years'),
          api.get('/public/semesters')
        ]);

        setDepartments(departmentData?.data?.departments || []);
        setYears(getAcademicYearOptions(yearData?.data?.years || []));
        setSemesters(semesterData?.data?.semesters || []);
      } catch {
        setDepartments([]);
        setYears([]);
        setSemesters([]);
      }
    };

    if (registerMode) {
      fetchOptions();
    }
  }, [registerMode]);

  const submit = async (event) => {
    event.preventDefault(); setError(''); setMessage('');
    if (forgotMode) { setMessage('If an account exists for that email, password reset instructions will be sent.'); return; }
    if (registerMode && fields.password !== fields.confirmPassword) { setError('Your passwords do not match.'); return; }
    if (registerMode && role === 'student' && (!fields.departmentId || !fields.yearId || !fields.semesterId)) { setError('Department, year and semester are required.'); return; }
    setBusy(true);
    try {
      const signedIn = registerMode
        ? await register({
          fullName: fields.fullName,
          email: fields.email,
          password: fields.password,
          role,
          studentId: fields.studentId,
          employeeId: fields.employeeId,
          departmentId: fields.departmentId,
          yearId: fields.yearId,
          semesterId: fields.semesterId
        })
        : await login({ email: fields.email, password: fields.password, role: adminLoginMode ? 'admin' : normalizeLoginRole(role) });
      navigate(roleDestinations[signedIn.role], { replace: true });
    } catch (submitError) { setError(submitError.message || 'We could not complete that request.'); }
    finally { setBusy(false); }
  };
  return <div className={`auth-page ${mode === 'login' ? 'auth-login-page' : ''}`}><PublicHeader /><main className={`auth-main auth-main-narrow ${mode === 'login' ? 'auth-main-login' : ''}`}><div className={`auth-panel ${mode === 'login' ? 'auth-panel-login' : ''}`}><Link to={adminLoginMode ? '/owner-profile' : '/'} className="auth-back"><ArrowRight size={14} />{adminLoginMode ? 'Back to profile' : 'Back to home'}</Link><p className="eyebrow">{adminLoginMode ? 'ADMINISTRATOR ACCESS' : forgotMode ? 'ACCOUNT RECOVERY' : registerMode ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK'}</p><h1>{adminLoginMode ? 'Administrator sign in.' : forgotMode ? 'Reset your password.' : registerMode ? 'Join your workspace.' : 'Sign in to continue.'}</h1><p className="auth-panel-copy">{adminLoginMode ? 'Sign in with your authorized administrator account.' : forgotMode ? 'Enter your college email and we’ll guide you through the next step.' : registerMode ? 'Your academic assignment helps us show the right coursework.' : 'Choose your role and enter your college account details.'}</p>{!forgotMode && !adminLoginMode && <div className="auth-role-switch" aria-label="Select account role">{['student', 'teacher'].map((value) => {
        const RoleIcon = roleCopy[value][2];
        return <button type="button" key={value} className={role === value ? 'selected' : ''} aria-pressed={role === value} onClick={() => setRole(value)}><RoleIcon size={16} /><span>{roleCopy[value][0]}</span></button>;
      })}</div>}
    <form className="auth-form" onSubmit={submit}>
      {registerMode && <label className="form-field"><span>Full name</span><input required autoComplete="name" value={fields.fullName} onChange={update('fullName')} placeholder="Your name" /></label>}
      {registerMode && role === 'student' && <label className="form-field"><span>Student ID / Roll number</span><input required value={fields.studentId} onChange={update('studentId')} placeholder="Enter your college roll number" /></label>}
      {registerMode && role === 'teacher' && <label className="form-field"><span>Employee ID</span><input required value={fields.employeeId} onChange={update('employeeId')} placeholder="Enter your employee ID" /></label>}
      <label className="form-field"><span>{forgotMode ? 'College email' : 'Email / User ID'}</span><span className="input-with-icon"><Mail size={16} /><input type="email" required autoComplete="email" value={fields.email} onChange={update('email')} placeholder="name@college.edu" /></span></label>
      {!forgotMode && <label className="form-field"><span>Password</span><span className="input-with-icon"><LockKeyhole size={16} /><input type="password" required autoComplete={registerMode ? 'new-password' : 'current-password'} minLength={6} value={fields.password} onChange={update('password')} placeholder="At least 6 characters" /></span></label>}
      {registerMode && <label className="form-field"><span>Confirm password</span><input type="password" required autoComplete="new-password" value={fields.confirmPassword} onChange={update('confirmPassword')} placeholder="Re-enter your password" /></label>}
      {registerMode && role === 'student' && <div className="academic-fields"><p className="eyebrow">ACADEMIC DETAILS</p><div className="form-grid"><label className="form-field"><span>Department <b>*</b></span><select required value={fields.departmentId} onChange={update('departmentId')}><option value="">Select Department</option>{departments.map((department) => <option key={department._id || department.id} value={department._id || department.id}>{department.name}</option>)}</select></label><label className="form-field"><span>Year <b>*</b></span><select required value={fields.yearId} onChange={updateYear}><option value="">Select Year</option>{years.map((year) => <option key={year._id || year.id} value={year._id || year.id}>{year.name}</option>)}</select></label><label className="form-field form-field-wide"><span>Semester <b>*</b></span><select required disabled={!fields.yearId} value={fields.semesterId} onChange={update('semesterId')}><option value="">{fields.yearId ? 'Select Semester' : 'Select a year first'}</option>{availableSemesters.map((semester) => <option key={semester._id || semester.id} value={semester._id || semester.id}>{semester.name}</option>)}</select></label></div></div>}
      {registerMode && role === 'teacher' && <div className="academic-fields"><p className="eyebrow">TEACHING ASSIGNMENT</p><label className="form-field"><span>Department</span><select value={fields.departmentId} onChange={update('departmentId')}><option value="">Select Department</option>{departments.map((department) => <option key={department._id || department.id} value={department._id || department.id}>{department.name}</option>)}</select></label><p className="form-help">Subjects can be assigned after they are configured by an administrator.</p></div>}
      {mode === 'login' && <div className="remember-row"><label><input type="checkbox" defaultChecked />Remember me</label><Link to="/forgot-password">Forgot password?</Link></div>}
      {error && <p className="form-alert form-alert-error" role="alert">{error}</p>}{message && <p className="form-alert form-alert-success" role="status">{message}</p>}
      <button className="button button-primary auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait...' : forgotMode ? 'Send reset instructions' : registerMode ? 'Create account' : 'Sign in'} <ArrowRight size={16} /></button>
    </form>{!forgotMode && !adminLoginMode && <p className="auth-switch">{registerMode ? 'Already have an account?' : 'New to the portal?'} <Link to={registerMode ? `/login?role=${role}` : `/register?role=${role}`}>{registerMode ? 'Sign in' : 'Create an account'}</Link></p>}{(role === 'admin' || adminLoginMode) && <p className="auth-footnote"><ShieldCheck size={14} />Admin accounts are provisioned by authorized college staff.</p>}</div></main><footer className="auth-footer">College Practical Portal <span>·</span> College community access</footer></div>;
}

export default function PublicExperience({ mode }) {
  const location = useLocation();
  if (location.pathname === '/owner-profile') return <OwnerProfilePage />;
  if (location.pathname === '/owner-profile/admin-login') return <AuthPage mode="admin-login" />;
  if (location.pathname === '/select-role') return <RoleSelection />;
  if (location.pathname === '/login') return <AuthPage mode="login" />;
  if (location.pathname === '/register') return <AuthPage mode="register" />;
  if (location.pathname === '/forgot-password') return <AuthPage mode="forgot" />;
  return <LandingPage />;
}