import PageHeader from '../../components/common/PageHeader';

function TeacherPracticalEditPage() {
  return (
    <div>
      <PageHeader title="Edit Practical" subtitle="Review generated content and publish when approved." />
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <form className="space-y-4">
          <input className="w-full border border-slate-300 rounded-md p-3" placeholder="Enter practical title" />
          <textarea className="w-full border border-slate-300 rounded-md p-3" rows="6" placeholder="Enter reviewed practical content" />
          <div className="flex gap-3">
            <button className="bg-slate-800 text-white px-4 py-2 rounded-md">Save Draft</button>
            <button className="bg-indigo-600 text-white px-4 py-2 rounded-md">Publish</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TeacherPracticalEditPage;
