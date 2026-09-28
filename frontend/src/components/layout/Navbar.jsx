import { Link } from 'react-router-dom';

function Navbar() {
  return (
    <header className="bg-white shadow-sm border-b border-slate-200">
      <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-slate-900">College Practical Portal</Link>
        <nav className="flex gap-6 text-sm text-slate-700">
          <Link to="/features">Features</Link>
          <Link to="/how-it-works">How it Works</Link>
          <Link to="/about">About</Link>
          <Link to="/login" className="bg-indigo-600 text-white px-4 py-2 rounded-md">Login</Link>
        </nav>
      </div>
    </header>
  );
}

export default Navbar;
