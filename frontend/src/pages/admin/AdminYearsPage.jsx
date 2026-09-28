import PageHeader from '../../components/common/PageHeader';

function AdminYearsPage() {
  return (
    <div>
      <PageHeader title="Years" subtitle="Manage year groups." />
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <p className="text-slate-600">Year management scaffold ready for implementation.</p>
      </div>
    </div>
  );
}

export default AdminYearsPage;
