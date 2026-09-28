import { subjects } from '../data/portalData.js';
import { createCollectionService } from './mockStore.js';

const subjectService = createCollectionService({ key: 'portal-subjects', name: 'Subjects', initialValue: subjects });

export default subjectService;
