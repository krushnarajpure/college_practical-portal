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
    }
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

  return <section className="myraa-integrated-shell"><ApiKeyGate><MyraaApp portalTools={portalTools} onOpenPortalPractical={(id) => navigate(`/student/practicals/${id}`)} /></ApiKeyGate></section>;
}
