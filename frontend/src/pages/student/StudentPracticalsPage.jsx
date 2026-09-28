import PageHeader from '../../components/common/PageHeader';

function StudentPracticalsPage() {
  return (
    <div>
      <PageHeader title="All Practicals" subtitle="View practicals assigned to your academic profile." />
      <p className="text-slate-600">No practicals have been published for your subjects yet.</p>
    </div>
  );
}

export default StudentPracticalsPage;
