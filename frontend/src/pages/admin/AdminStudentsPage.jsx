import PageHeader from '../../components/common/PageHeader';

function AdminStudentsPage() {
  return (
    <div>
      <PageHeader title="Students" subtitle="Manage enrolled students and academic placement." />
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <p className="text-slate-600">Student management scaffold ready for implementation.</p>
      </div>
    </div>
  );
}

export default AdminStudentsPage;
