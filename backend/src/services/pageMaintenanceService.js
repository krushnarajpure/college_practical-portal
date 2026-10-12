import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import PageSetting from '../models/PageSetting.js';
import User from '../models/User.js';

const MAX_TIMER_DELAY_MS = 2_147_000_000;
const RETRY_DELAY_MS = 5_000;
const NOTIFICATION_BATCH_SIZE = 500;

let schedulerTimer;
let schedulerStarted = false;
let schedulerRunning = false;
let schedulerRefreshRequested = false;

async function notifyStudentsPageReopened(setting) {
  const reason = setting.maintenanceMessage.trim();
  if (reason && ['student', 'both'].includes(setting.dashboardType)) {
    const students = await User.find({ role: 'student', status: 'active' }).select('_id').lean();
    const message = `${setting.pageName} is available again. Maintenance reason: ${reason}`;
    const eventKey = `${setting._id}:${setting.reopenedAt.toISOString()}`;

    for (let offset = 0; offset < students.length; offset += NOTIFICATION_BATCH_SIZE) {
      const operations = students.slice(offset, offset + NOTIFICATION_BATCH_SIZE).map((student) => {
        const id = createHash('sha256')
          .update(`${eventKey}:${student._id}`)
          .digest('hex')
          .slice(0, 24);

        return {
          updateOne: {
            filter: { _id: new mongoose.Types.ObjectId(id) },
            update: {
              $setOnInsert: {
                userId: student._id,
                action: 'page_reopened',
                entityType: 'page',
                entityId: setting._id,
                message
              }
            },
            upsert: true
          }
        };
      });

      if (operations.length) await Notification.bulkWrite(operations, { ordered: false });
    }
  }

  await PageSetting.updateOne(
    { _id: setting._id, reopenNotificationSentAt: null },
    { $set: { reopenNotificationSentAt: new Date() } }
  );
}

export async function processExpiredPageSettings() {
  const now = new Date();
  const expiredSettings = await PageSetting.find({
    isVisible: false,
    maintenanceUntil: { $ne: null, $lte: now }
  }).select('_id').lean();

  for (const expiredSetting of expiredSettings) {
    await PageSetting.findOneAndUpdate(
      {
        _id: expiredSetting._id,
        isVisible: false,
        maintenanceUntil: { $ne: null, $lte: now }
      },
      {
        $set: {
          isVisible: true,
          maintenanceUntil: null,
          reopenedAt: now,
          reopenNotificationSentAt: null
        }
      }
    );
  }

  const pendingNotifications = await PageSetting.find({
    isVisible: true,
    reopenedAt: { $ne: null },
    reopenNotificationSentAt: null
  }).lean();

  for (const setting of pendingNotifications) {
    await notifyStudentsPageReopened(setting);
  }
}

async function scheduleNextReopen() {
  if (!schedulerStarted || schedulerRunning) return;
  schedulerRunning = true;
  clearTimeout(schedulerTimer);

  try {
    await processExpiredPageSettings();
    const nextSetting = await PageSetting.findOne({
      isVisible: false,
      maintenanceUntil: { $ne: null }
    }).sort({ maintenanceUntil: 1 }).select('maintenanceUntil').lean();

    if (!schedulerStarted) return;
    if (!nextSetting) {
      schedulerTimer = undefined;
      return;
    }

    const delay = Math.min(
      MAX_TIMER_DELAY_MS,
      Math.max(0, nextSetting.maintenanceUntil.getTime() - Date.now())
    );
    schedulerTimer = setTimeout(() => {
      void scheduleNextReopen();
    }, delay);
    schedulerTimer.unref?.();
  } catch (error) {
    console.error('Unable to process scheduled page reopens:', error);
    if (schedulerStarted) {
      schedulerTimer = setTimeout(() => {
        void scheduleNextReopen();
      }, RETRY_DELAY_MS);
      schedulerTimer.unref?.();
    }
  } finally {
    schedulerRunning = false;
    if (schedulerRefreshRequested && schedulerStarted) {
      schedulerRefreshRequested = false;
      void scheduleNextReopen();
    }
  }
}

export function startPageMaintenanceScheduler() {
  schedulerStarted = true;
  void scheduleNextReopen();
}

export function refreshPageMaintenanceSchedule() {
  if (!schedulerStarted) return;
  clearTimeout(schedulerTimer);
  if (schedulerRunning) {
    schedulerRefreshRequested = true;
    return;
  }
  void scheduleNextReopen();
}

export async function reopenExpiredPage(pageId) {
  await processExpiredPageSettings();
  return PageSetting.findOne({ pageId }).lean();
}
