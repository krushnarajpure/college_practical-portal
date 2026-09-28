import PageHeader from '../../components/common/PageHeader';

function StudentBookmarksPage() {
  return (
    <div>
      <PageHeader title="Bookmarks" subtitle="Saved practicals for quick access." />
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <p className="text-slate-600">Bookmarks list scaffold ready for implementation.</p>
      </div>
    </div>
  );
}

export default StudentBookmarksPage;
