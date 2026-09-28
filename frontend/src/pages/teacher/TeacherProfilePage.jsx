import PageHeader from '../../components/common/PageHeader';

function TeacherProfilePage() {
  return (
    <div>
      <PageHeader title="Profile" subtitle="Teacher account and preferences." />
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <p className="text-slate-600">Teacher profile scaffold ready for future data binding.</p>
      </div>
    </div>
  );
}

export default TeacherProfilePage;
