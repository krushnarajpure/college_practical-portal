import PageHeader from '../../components/common/PageHeader';

function StudentDashboardPage() {
  return (
    <div>
      <PageHeader title="Student Dashboard" subtitle="Your academic overview and practical learning status." />
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200"><h3 className="text-slate-500">My Subjects</h3><p className="mt-2 text-3xl font-bold">4</p></div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200"><h3 className="text-slate-500">Completed</h3><p className="mt-2 text-3xl font-bold">12</p></div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200"><h3 className="text-slate-500">Bookmarks</h3><p className="mt-2 text-3xl font-bold">6</p></div>
      </div>
    </div>
  );
}

export default StudentDashboardPage;
