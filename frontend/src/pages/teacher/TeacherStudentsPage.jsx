import PageHeader from '../../components/common/PageHeader';

function TeacherStudentsPage() {
  return (
    <div>
      <PageHeader title="Students" subtitle="Students enrolled in assigned subjects." />
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <p className="text-slate-600">Student roster and practical progress view scaffold.</p>
      </div>
    </div>
  );
}

export default TeacherStudentsPage;
