import PageHeader from '../../components/common/PageHeader';

function TeacherDashboardPage() {
  return (
    <div>
      <PageHeader title="Teacher Dashboard" subtitle="Track subjects, practicals, and student progress." />
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200"><h3 className="text-slate-500">Assigned Subjects</h3><p className="mt-2 text-3xl font-bold">5</p></div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200"><h3 className="text-slate-500">Pending Reviews</h3><p className="mt-2 text-3xl font-bold">3</p></div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200"><h3 className="text-slate-500">Published</h3><p className="mt-2 text-3xl font-bold">18</p></div>
      </div>
    </div>
  );
}

export default TeacherDashboardPage;
