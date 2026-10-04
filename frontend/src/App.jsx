import { Navigate, Route, Routes } from 'react-router-dom';
import PortalExperience from './components/portal/PortalExperience';
import PublicExperience from './components/portal/PublicExperience';
import ProtectedRoute from './routes/ProtectedRoute';
import RoleRoute from './routes/RoleRoute';

function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicExperience />} />
      <Route path="/features" element={<PublicExperience />} />
      <Route path="/how-it-works" element={<PublicExperience />} />
      <Route path="/about" element={<PublicExperience />} />
      <Route path="/owner-profile" element={<PublicExperience />} />
      <Route path="/select-role" element={<PublicExperience />} />
      <Route path="/login" element={<PublicExperience />} />
      <Route path="/register" element={<PublicExperience />} />
      <Route path="/forgot-password" element={<PublicExperience />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/student/*" element={<RoleRoute allowedRoles={['student']}><PortalExperience /></RoleRoute>} />
        <Route path="/teacher/*" element={<RoleRoute allowedRoles={['teacher']}><PortalExperience /></RoleRoute>} />
        <Route path="/admin/*" element={<RoleRoute allowedRoles={['admin']}><PortalExperience /></RoleRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
