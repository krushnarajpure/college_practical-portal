import PageHeader from '../../components/common/PageHeader';

function AdminTeachersPage() {
  return (
    <div>
      <PageHeader title="Teachers" subtitle="Manage teacher records and subject assignments." />
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <p className="text-slate-600">Teacher management scaffold ready for implementation.</p>
      </div>
    </div>
  );
}

export default AdminTeachersPage;
