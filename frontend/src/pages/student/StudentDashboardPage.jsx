import { BookOpen, BookMarked, CheckCircle2, FolderOpen, NotebookPen } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';

function DashboardStat({ icon: Icon, label, value, tone }) {
  return (
    <div className="stat-card">
      <span className={`stat-icon ${tone || ''}`}>
        <Icon size={18} />
      </span>
      <div>
        <p className="stat-label">{label}</p>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function StudentDashboardPage() {
  return (
    <div>
      <PageHeader title="Student Dashboard" subtitle="Your academic overview and practical learning status." />

      <div className="stat-grid">
        <DashboardStat icon={BookOpen} label="My Subjects" value="04" tone="tone-blue" />
        <DashboardStat icon={CheckCircle2} label="Completed" value="12" tone="tone-green" />
        <DashboardStat icon={BookMarked} label="Bookmarks" value="06" tone="tone-amber" />
        <DashboardStat icon={FolderOpen} label="Folders" value="03" tone="tone-slate" />
      </div>

      <div className="section-heading">
        <div>
          <p className="eyebrow">STUDY HUB</p>
          <h2>Notes and learning space</h2>
        </div>
      </div>

      <div className="surface" style={{ padding: '18px' }}>
        <div className="notes-summary">
          <span><strong>18</strong> total notes</span>
          <span><strong>4</strong> folders</span>
          <span><strong>3</strong> recent uploads</span>
        </div>

        <div className="notes-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <button type="button" className="notes-folder-card" style={{ width: '100%' }}>
            <span className="notes-folder-icon"><FolderOpen size={22} /></span>
            <span className="notes-folder-details">
              <strong>Semester 5</strong>
              <small>7 notes inside</small>
            </span>
          </button>

          <button type="button" className="notes-folder-card" style={{ width: '100%' }}>
            <span className="notes-folder-icon"><NotebookPen size={22} /></span>
            <span className="notes-folder-details">
              <strong>Practical Labs</strong>
              <small>5 notes inside</small>
            </span>
          </button>

          <article className="notes-card">
            <div className="notes-card-top">
              <span className="notes-file-icon notes-file-pdf"><BookOpen size={18} /></span>
              <span className="notes-card-type">PDF</span>
            </div>
            <span className="notes-card-category">Algorithms</span>
            <h2>Flowchart Notes</h2>
            <p className="notes-card-folder">Semester 5 / Practical Labs</p>
            <div className="notes-card-footer">
              <span>2.4 MB</span>
              <button type="button" className="button button-secondary">Open</button>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

export default StudentDashboardPage;
