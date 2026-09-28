import PageHeader from '../../components/common/PageHeader';

function StudentSubjectsPage() {
  return (
    <div>
      <PageHeader title="My Subjects" subtitle="Subjects based on your department, year, and semester." />
      <p className="text-slate-600">No subjects are assigned to your academic profile yet.</p>
    </div>
  );
}

export default StudentSubjectsPage;
