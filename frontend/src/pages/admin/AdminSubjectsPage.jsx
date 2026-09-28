import PageHeader from '../../components/common/PageHeader';

function AdminSubjectsPage() {
  return (
    <div>
      <PageHeader title="Subjects" subtitle="Manage subject catalog and teacher assignments." />
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <p className="text-slate-600">Subject management scaffold ready for implementation.</p>
      </div>
    </div>
  );
}

export default AdminSubjectsPage;
