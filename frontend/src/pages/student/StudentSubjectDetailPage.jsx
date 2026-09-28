import PageHeader from '../../components/common/PageHeader';

function StudentSubjectDetailPage() {
  return (
    <div>
      <PageHeader title="Subject details" subtitle="View all practicals assigned to this subject." />
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <p className="text-slate-600">Practical list scaffold for subject-specific navigation and content access.</p>
      </div>
    </div>
  );
}

export default StudentSubjectDetailPage;
