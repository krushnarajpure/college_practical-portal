import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MyraaApp from '@myraa/App.tsx';
import { ApiKeyGate } from '@myraa/components/ApiKeyGate.tsx';
import studentService from '../../services/studentService';
import api from '../../services/api';

const MYRAA_STYLE_ID = 'myraa-integrated-styles';

export default function MyraaIntegrated() {
  const navigate = useNavigate();

  const portalTools = {
    listPracticals: async ({ topic = '' } = {}) => {
      const response = await studentService.getPracticals();
      const practicals = response?.data?.practicals || [];
      const filtered = topic
        ? practicals.filter((item) => `${item.title} ${item.subjectId?.name || ''}`.toLowerCase().includes(topic.toLowerCase()))
        : practicals;
      return {
        total: filtered.length,
        practicals: filtered.slice(0, 60).map((item) => ({
          id: String(item._id),
          practicalNumber: item.practicalNumber,
          title: item.title,
          subject: item.subjectId?.name || 'Unknown subject',
          hasPdf: Boolean(item.pdfId)
        }))
      };
    },
    readPracticalPdf: async ({ practicalId }) => {
      const response = await studentService.getPracticalById(practicalId);
      const practical = response?.data?.practical;
      if (!practical?.pdfId) throw new Error('This practical has no attached PDF.');
      return api.get(`/pdfs/${practical.pdfId}/text`);
    },
    searchNotes: async ({ query = '' }) => {
      const response = await api.get('/student/notes/assistant/search', { q: query });
      return response?.data || { notes: [] };
    },
    openNote: async ({ query = '' }) => {
      const response = await api.get('/student/notes/assistant/search', { q: query });
      const notes = response?.data?.notes || [];
      const note = notes.find((item) => item.fileType === 'pdf' || item.mimeType === 'application/pdf')
        || notes.find((item) => item.fileType === 'text')
        || notes[0];
      if (!note) throw new Error(query ? `No published note matched "${query}".` : 'There are no published notes to open.');
      if (note.fileType === 'driveLink') {
        throw new Error('The matching item is a Drive link, not a portal PDF. Open it from the Notes page.');
      }
      navigate(`/student/notes/${note.id}?preview=1`);
      return { id: note.id, title: note.title, fileType: note.fileType };
    },
    readNotePdf: async ({ noteId }) => api.get(`/student/notes/${noteId}/text`, undefined, 120000)
  };

  useEffect(() => {
    if (document.getElementById(MYRAA_STYLE_ID)) return undefined;
    const link = document.createElement('link');
    link.id = MYRAA_STYLE_ID;
    link.rel = 'stylesheet';
    link.href = '/myraa-assets/assets/index-CgR-eYnk.css';
    document.head.appendChild(link);
    return () => {
      document.getElementById(MYRAA_STYLE_ID)?.remove();
    };
  }, []);

  const navigatePortal = (target) => {
    const routes = {
      dashboard: '/student/dashboard',
      practicals: '/student/practicals',
      'academic-documents': '/student/academic-documents',
      notes: '/student/notes',
      subjects: '/student/subjects',
      bookmarks: '/student/bookmarks',
      profile: '/student/profile'
    };
    if (target === 'back') {
      navigate(-1);
      return;
    }
    navigate(routes[target] || routes.dashboard);
  };

  return <section className="myraa-integrated-shell"><ApiKeyGate><MyraaApp portalTools={portalTools} onOpenPortalPractical={(id) => navigate(`/student/practicals/${id}`)} onNavigatePortal={navigatePortal} /></ApiKeyGate></section>;
}
