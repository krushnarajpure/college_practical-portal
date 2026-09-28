import PageHeader from '../../components/common/PageHeader';

function TeacherSubjectsPage() {
  return (
    <div>
      <PageHeader title="My Subjects" subtitle="Subjects assigned to the current teacher." />
      <p className="text-slate-600">No subjects have been assigned to your account yet.</p>
    </div>
  );
}

export default TeacherSubjectsPage;
