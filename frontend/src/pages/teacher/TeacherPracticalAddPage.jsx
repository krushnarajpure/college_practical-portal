import PageHeader from '../../components/common/PageHeader';

function TeacherPracticalAddPage() {
  return (
    <div>
      <PageHeader title="Add Practical" subtitle="Create a new practical entry and upload the source PDF." />
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <form className="space-y-4">
          <input className="w-full border border-slate-300 rounded-md p-3" placeholder="Practical Number" />
          <input className="w-full border border-slate-300 rounded-md p-3" placeholder="Title" />
          <textarea className="w-full border border-slate-300 rounded-md p-3" rows="5" placeholder="Description" />
          <input type="file" className="w-full" />
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-md">Upload and Analyze</button>
        </form>
      </div>
    </div>
  );
}

export default TeacherPracticalAddPage;
