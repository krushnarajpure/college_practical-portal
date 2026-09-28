import PageHeader from '../../components/common/PageHeader';

function AdminSettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" subtitle="Portal settings and configuration." />
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <p className="text-slate-600">Settings scaffold ready for future configuration options.</p>
      </div>
    </div>
  );
}

export default AdminSettingsPage;
