import { years } from '../data/portalData.js';
import { createCollectionService } from './mockStore.js';

const yearService = createCollectionService({ key: 'portal-years', name: 'Years', initialValue: years });

export default yearService;
