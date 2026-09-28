import { departments } from '../data/portalData.js';
import { createCollectionService } from './mockStore.js';

const departmentService = createCollectionService({ key: 'portal-departments', name: 'Departments', initialValue: departments });

export default departmentService;
