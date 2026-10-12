import PageSetting from '../models/PageSetting.js';
import { pageDefinitions } from '../config/pageDefinitions.js';
import { processExpiredPageSettings, refreshPageMaintenanceSchedule } from '../services/pageMaintenanceService.js';

export async function listPageSettings(_req, res) {
  await processExpiredPageSettings();
  const storedSettings = await PageSetting.find().sort({ pageName: 1 }).lean();
  const storedById = new Map(storedSettings.map((setting) => [setting.pageId, setting]));
  const defaults = pageDefinitions.map((definition) => ({
    ...definition,
    isVisible: true,
    maintenanceMessage: '',
    ...storedById.get(definition.pageId)
  }));
  const customSettings = storedSettings.filter((setting) => !pageDefinitions.some((definition) => definition.pageId === setting.pageId));

  res.json({ success: true, data: { pageSettings: [...defaults, ...customSettings] } });
}

export async function updatePageSetting(req, res) {
  const { pageId, pageName, dashboardType, isVisible, maintenanceMessage = '', maintenanceUntil = null } = req.body || {};
  const normalizedPageId = String(pageId || '').trim().toLowerCase();
  const normalizedName = String(pageName || '').trim();
  const normalizedType = String(dashboardType || '').trim().toLowerCase();

  if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(normalizedPageId)) {
    return res.status(400).json({ success: false, message: 'Page ID must use lowercase letters, numbers, and hyphens.' });
  }
  if (!normalizedName || normalizedName.length > 100) {
    return res.status(400).json({ success: false, message: 'Page name is required and must be under 100 characters.' });
  }
  if (!['student', 'teacher', 'both'].includes(normalizedType)) {
    return res.status(400).json({ success: false, message: 'Dashboard type must be Student, Teacher, or Both.' });
  }
  if (typeof isVisible !== 'boolean') {
    return res.status(400).json({ success: false, message: 'Visibility status must be provided.' });
  }
  const parsedMaintenanceUntil = maintenanceUntil ? new Date(maintenanceUntil) : null;
  if (parsedMaintenanceUntil && Number.isNaN(parsedMaintenanceUntil.getTime())) {
    return res.status(400).json({ success: false, message: 'Scheduled reopen time must be a valid date and time.' });
  }
  if (!isVisible && parsedMaintenanceUntil && parsedMaintenanceUntil <= new Date()) {
    return res.status(400).json({ success: false, message: 'Scheduled reopen time must be in the future.' });
  }

  const setting = await PageSetting.findOneAndUpdate(
    { pageId: normalizedPageId },
    {
      $set: {
        pageName: normalizedName,
        dashboardType: normalizedType,
        isVisible,
        maintenanceMessage: String(maintenanceMessage).trim().slice(0, 500),
        maintenanceUntil: parsedMaintenanceUntil
      }
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  refreshPageMaintenanceSchedule();

  return res.json({ success: true, data: { pageSetting: setting } });
}