import PageHeader from '../../components/common/PageHeader';

function StudentProfilePage() {
  return (
    <div>
      <PageHeader title="Profile" subtitle="Student profile and settings." />
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <p className="text-slate-600">Student profile scaffold ready for future details and editing.</p>
      </div>
    </div>
  );
}

export default StudentProfilePage;
