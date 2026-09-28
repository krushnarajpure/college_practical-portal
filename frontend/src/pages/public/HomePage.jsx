import { Link } from 'react-router-dom';

function HomePage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16">
      <div className="grid gap-10 md:grid-cols-2 items-center">
        <div>
          <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">College Practical Portal</span>
          <h1 className="mt-6 text-4xl font-bold text-slate-900">Smart practical learning for students and teachers.</h1>
          <p className="mt-4 text-lg text-slate-600">
            Manage academic practicals, upload PDFs, analyze content with AI, and guide students through structured lab work.
          </p>
          <div className="mt-8 flex gap-4">
            <Link to="/register" className="bg-indigo-600 text-white px-5 py-3 rounded-lg">Get Started</Link>
            <Link to="/features" className="border border-slate-300 px-5 py-3 rounded-lg">Explore Features</Link>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="grid gap-4">
            <div className="rounded-xl bg-slate-100 p-4">Department Management</div>
            <div className="rounded-xl bg-slate-100 p-4">Subject and Practical Tracking</div>
            <div className="rounded-xl bg-slate-100 p-4">AI-Powered Practical Analysis</div>
            <div className="rounded-xl bg-slate-100 p-4">Student Bookmarks and Progress</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HomePage;
