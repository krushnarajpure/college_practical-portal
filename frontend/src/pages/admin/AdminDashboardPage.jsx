import PageHeader from '../../components/common/PageHeader';

function AdminDashboardPage() {
  return (
    <div>
      <PageHeader title="Admin Dashboard" subtitle="Overview of academic operations." />
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200"><h3 className="text-slate-500">Departments</h3><p className="mt-2 text-3xl font-bold">12</p></div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200"><h3 className="text-slate-500">Subjects</h3><p className="mt-2 text-3xl font-bold">48</p></div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200"><h3 className="text-slate-500">Practicals</h3><p className="mt-2 text-3xl font-bold">164</p></div>
      </div>
    </div>
  );
}

export default AdminDashboardPage;
