import { notifications } from '../data/portalData.js';
import { createCollectionService } from './mockStore.js';

const collection = createCollectionService({ key: 'portal-notifications', name: 'Notifications', initialValue: notifications });
const notificationService = {
  ...collection,
  markAsRead: async (id) => collection.update(id, { unread: false, readAt: new Date().toISOString() })
};

export default notificationService;
