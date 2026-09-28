function LoginPage() {
  return (
    <div className="grid md:grid-cols-2 gap-8 items-center bg-white rounded-2xl shadow-lg overflow-hidden">
      <div className="bg-indigo-600 text-white p-10">
        <h1 className="text-3xl font-bold">Welcome back</h1>
        <p className="mt-4 text-indigo-100">Sign in to access your practical dashboard.</p>
      </div>
      <div className="p-10">
        <h2 className="text-2xl font-bold text-slate-900">Login</h2>
        <form className="mt-6 space-y-4">
          <input className="w-full border border-slate-300 rounded-md p-3" type="email" placeholder="Email" />
          <input className="w-full border border-slate-300 rounded-md p-3" type="password" placeholder="Password" />
          <button className="w-full bg-indigo-600 text-white p-3 rounded-md">Login</button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
