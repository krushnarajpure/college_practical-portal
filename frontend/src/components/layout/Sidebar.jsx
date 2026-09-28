import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function Sidebar() {
  const { user } = useAuth();

  const sections = {
    admin: [
      ['Dashboard', '/admin/dashboard'],
      ['Departments', '/admin/departments'],
      ['Years', '/admin/years'],
      ['Semesters', '/admin/semesters'],
      ['Subjects', '/admin/subjects'],
      ['Teachers', '/admin/teachers'],
      ['Students', '/admin/students'],
      ['Practicals', '/admin/practicals'],
      ['Settings', '/admin/settings'],
      ['Profile', '/admin/profile']
    ],
    teacher: [
      ['Dashboard', '/teacher/dashboard'],
      ['My Subjects', '/teacher/subjects'],
      ['Practicals', '/teacher/practicals'],
      ['Add Practical', '/teacher/practicals/add'],
      ['Students', '/teacher/students'],
      ['Profile', '/teacher/profile']
    ],
    student: [
      ['Dashboard', '/student/dashboard'],
      ['My Subjects', '/student/subjects'],
      ['Practicals', '/student/practicals'],
      ['Bookmarks', '/student/bookmarks'],
      ['Myraa', '/student/myraa'],
      ['Profile', '/student/profile']
    ]
  };

  const roleLinks = sections[user?.role] || sections.student;

  return (
    <aside className="w-72 min-h-screen bg-slate-900 text-slate-200 p-5">
      <div className="mb-8">
        <h2 className="text-xl font-bold">Portal</h2>
        <p className="text-sm text-slate-400 mt-1">{user?.role || 'student'} account</p>
      </div>

      <nav className="space-y-2">
        {roleLinks.map(([label, to]) => (
          <Link
            key={to}
            to={to}
            className="block rounded-md px-3 py-2 text-sm hover:bg-slate-800 transition"
          >
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
