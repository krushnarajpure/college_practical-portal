import PageSetting from '../models/PageSetting.js';
import { reopenExpiredPage } from '../services/pageMaintenanceService.js';

export function requireVisiblePage(pageId) {
  return async (req, res, next) => {
    if (req.user?.role === 'admin') return next();

    try {
      const setting = await reopenExpiredPage(pageId);
      if (setting && setting.dashboardType !== 'both' && setting.dashboardType !== req.user?.role) {
        return res.status(404).json({ success: false, message: 'This page is not configured for your dashboard.' });
      }
      if (setting && !setting.isVisible) {
        return res.status(503).json({
          success: false,
          code: 'PAGE_MAINTENANCE',
          pageId,
          message: setting.maintenanceMessage || 'This page is temporarily unavailable. Please check again later.'
        });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}