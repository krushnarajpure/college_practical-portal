import { Outlet } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';

function DashboardLayout() {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
