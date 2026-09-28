import { Outlet } from 'react-router-dom';

function AuthLayout() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-6xl">
        <Outlet />
      </div>
    </div>
  );
}

export default AuthLayout;
