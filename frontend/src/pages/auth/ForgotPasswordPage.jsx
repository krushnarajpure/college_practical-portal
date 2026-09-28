function ForgotPasswordPage() {
  return (
    <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-lg p-10">
      <h2 className="text-2xl font-bold text-slate-900">Forgot Password</h2>
      <p className="mt-2 text-slate-600">Enter your email to receive reset instructions.</p>
      <form className="mt-6">
        <input className="w-full border border-slate-300 rounded-md p-3" type="email" placeholder="Email" />
        <button className="w-full mt-4 bg-indigo-600 text-white p-3 rounded-md">Send Reset Link</button>
      </form>
    </div>
  );
}

export default ForgotPasswordPage;
