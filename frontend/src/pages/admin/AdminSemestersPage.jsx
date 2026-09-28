import PageHeader from '../../components/common/PageHeader';

function AdminSemestersPage() {
  return (
    <div>
      <PageHeader title="Semesters" subtitle="Manage academic semesters." />
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <p className="text-slate-600">Semester management scaffold ready for implementation.</p>
      </div>
    </div>
  );
}

export default AdminSemestersPage;
