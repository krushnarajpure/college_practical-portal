import PageHeader from '../../components/common/PageHeader';

function AdminDepartmentsPage() {
  return (
    <div>
      <PageHeader title="Departments" subtitle="Manage departments and academic units." />
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <p className="text-slate-600">Department management scaffold ready for implementation.</p>
      </div>
    </div>
  );
}

export default AdminDepartmentsPage;
