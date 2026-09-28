function FeaturesPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-3xl font-bold text-slate-900">Features</h1>
      <div className="mt-8 grid md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <h2 className="font-semibold">Academic Structure</h2>
          <p className="mt-2 text-slate-600">Dynamic department, year, semester, subject, and practical hierarchy.</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <h2 className="font-semibold">Teacher Workflow</h2>
          <p className="mt-2 text-slate-600">Upload PDF, analyze it, review AI-generated details, and publish practicals.</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <h2 className="font-semibold">Student Experience</h2>
          <p className="mt-2 text-slate-600">View practicals, bookmarks, progress, and Myraa section in one dashboard.</p>
        </div>
      </div>
    </section>
  );
}

export default FeaturesPage;
