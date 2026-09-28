import PageHeader from '../../components/common/PageHeader';

function StudentMyraaPage() {
  return (
    <div>
      <PageHeader title="Myraa" subtitle="Separate student dashboard section reserved for the Myraa integration." />
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <p className="text-slate-600">This section is isolated for future Myraa project integration without affecting portal behavior.</p>
      </div>
    </div>
  );
}

export default StudentMyraaPage;
