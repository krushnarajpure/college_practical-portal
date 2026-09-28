import PageHeader from '../../components/common/PageHeader';

function AdminPracticalsPage() {
  return (
    <div>
      <PageHeader title="Practicals" subtitle="Review practical records and publication status." />
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <p className="text-slate-600">Practical management scaffold ready for implementation.</p>
      </div>
    </div>
  );
}

export default AdminPracticalsPage;
