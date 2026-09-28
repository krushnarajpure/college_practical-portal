function RegisterPage() {
  return (
    <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-lg p-10">
      <h2 className="text-2xl font-bold text-slate-900">Register</h2>
      <form className="mt-6 space-y-4">
        <input className="w-full border border-slate-300 rounded-md p-3" type="text" placeholder="Full Name" />
        <input className="w-full border border-slate-300 rounded-md p-3" type="email" placeholder="Email" />
        <input className="w-full border border-slate-300 rounded-md p-3" type="text" placeholder="Student ID / Employee ID" />
        <input className="w-full border border-slate-300 rounded-md p-3" type="password" placeholder="Password" />
        <button className="w-full bg-indigo-600 text-white p-3 rounded-md">Create Account</button>
      </form>
    </div>
  );
}

export default RegisterPage;
