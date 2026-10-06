import { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, CalendarClock, CheckCircle2, Plus, Target, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const defaultPlan = { weeklyGoal: 3, reminders: [], notificationsEnabled: false };

function readPlan(storageKey) {
  try {
    const storedPlan = localStorage.getItem(storageKey);
    if (!storedPlan) return defaultPlan;

    const parsedPlan = JSON.parse(storedPlan);
    if (!parsedPlan || typeof parsedPlan !== 'object') return defaultPlan;
    return {
      weeklyGoal: Number.isInteger(parsedPlan.weeklyGoal) ? parsedPlan.weeklyGoal : defaultPlan.weeklyGoal,
      reminders: Array.isArray(parsedPlan.reminders)
        ? parsedPlan.reminders.filter((reminder) => (
          reminder
          && typeof reminder.id === 'string'
          && typeof reminder.practicalId === 'string'
          && /^\d{4}-\d{2}-\d{2}$/.test(reminder.dueDate)
        ))
        : [],
      notificationsEnabled: Boolean(parsedPlan.notificationsEnabled)
    };
  } catch {
    return defaultPlan;
  }
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekStart(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

function StudentPlanner({ user, practicalList = [], progressRecords = [], completedIds = [], notify }) {
  const userId = user?._id || user?.id || user?.email || 'student';
  const storageKey = `college_practical_study_plan:${userId}`;
  const [plan, setPlan] = useState(() => readPlan(storageKey));
  const [practicalId, setPracticalId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [reminderError, setReminderError] = useState('');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    setPlan(readPlan(storageKey));
  }, [storageKey]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  const completedThisWeek = useMemo(() => {
    const weekStart = getWeekStart(now);
    return progressRecords.filter((record) => {
      const id = String(record.practicalId?._id || record.practicalId || '');
      const completedAt = record.completedAt ? new Date(record.completedAt) : null;
      return id && completedIds.includes(id) && completedAt && completedAt >= weekStart;
    }).length;
  }, [completedIds, now, progressRecords]);

  const savePlan = (nextPlan) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextPlan));
      setPlan(nextPlan);
      return true;
    } catch {
      notify('Your study plan could not be saved in this browser.');
      return false;
    }
  };

  const today = getLocalDateString(now);
  const browserNotificationsEnabled = plan.notificationsEnabled
    && 'Notification' in window
    && Notification.permission === 'granted';
  const dueReminders = useMemo(
    () => plan.reminders.filter((reminder) => reminder.dueDate <= today),
    [plan.reminders, today]
  );

  useEffect(() => {
    if (!plan.notificationsEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;

    dueReminders.forEach((reminder) => {
      const noticeKey = `${storageKey}:notified:${reminder.id}`;
      try {
        if (localStorage.getItem(noticeKey) === today) return;
        const practical = practicalList.find((item) => String(item._id || item.id) === reminder.practicalId);
        new Notification('Practical reminder', {
          body: `${practical?.title || 'A practical'} is due ${reminder.dueDate === today ? 'today' : 'now'}.`
        });
        localStorage.setItem(noticeKey, today);
      } catch {
        setReminderError('A browser reminder could not be shown. Check your notification permissions.');
      }
    });
  }, [dueReminders, plan.notificationsEnabled, practicalList, storageKey, today]);

  const changeGoal = (event) => {
    const weeklyGoal = Number(event.target.value);
    if (Number.isInteger(weeklyGoal) && weeklyGoal >= 1 && weeklyGoal <= 30) {
      savePlan({ ...plan, weeklyGoal });
    }
  };

  const addReminder = (event) => {
    event.preventDefault();
    setReminderError('');
    if (!practicalId || !practicalList.some((item) => String(item._id || item.id) === practicalId)) {
      setReminderError('Choose a practical for this reminder.');
      return;
    }
    if (!dueDate || dueDate < today) {
      setReminderError('Choose today or a future date.');
      return;
    }

    const reminder = { id: globalThis.crypto?.randomUUID?.() || `${Date.now()}`, practicalId, dueDate };
    if (savePlan({ ...plan, reminders: [...plan.reminders, reminder] })) {
      setPracticalId('');
      setDueDate('');
    }
  };

  const removeReminder = (id) => {
    savePlan({ ...plan, reminders: plan.reminders.filter((reminder) => reminder.id !== id) });
  };

  const enableNotifications = async () => {
    if (!('Notification' in window)) {
      notify('This browser does not support desktop notifications.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        notify('Notifications were not enabled. You can still use reminders in the portal.');
        return;
      }
      if (savePlan({ ...plan, notificationsEnabled: true })) {
        notify('Browser reminders enabled for this device.');
      }
    } catch (error) {
      notify(error.message || 'Could not enable browser notifications.');
    }
  };

  const goalProgress = Math.min(100, Math.round((completedThisWeek / plan.weeklyGoal) * 100));
  const sortedReminders = [...plan.reminders].sort((first, second) => first.dueDate.localeCompare(second.dueDate));

  return (
    <section className="study-planner-grid" aria-label="Study planner">
      <article className="surface study-goal-card">
        <div className="study-planner-heading">
          <span className="planner-icon"><Target size={18} /></span>
          <div><p className="eyebrow">WEEKLY TARGET</p><h2>Study goal</h2></div>
        </div>
        <label className="goal-setting">
          <span>Practicals to complete this week</span>
          <select value={plan.weeklyGoal} onChange={changeGoal} aria-label="Weekly practical goal">
            {[1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 30].map((goal) => <option key={goal} value={goal}>{goal} practicals</option>)}
          </select>
        </label>
        <div className="goal-progress-copy"><strong>{completedThisWeek} of {plan.weeklyGoal}</strong><span>{goalProgress}%</span></div>
        <div className="progress-track goal-progress-track"><span style={{ width: `${goalProgress}%` }} /></div>
        <p className="planner-caption">{goalProgress >= 100 ? 'Weekly target reached. Great work!' : `${plan.weeklyGoal - completedThisWeek} more to reach your weekly target.`}</p>
      </article>

      <article className="surface study-reminders-card">
        <div className="study-planner-heading">
          <span className="planner-icon planner-icon-amber"><CalendarClock size={18} /></span>
          <div><p className="eyebrow">STAY ON TRACK</p><h2>Practical reminders</h2></div>
          <button
            type="button"
            className="icon-button reminder-notification-toggle"
            onClick={enableNotifications}
            aria-label={browserNotificationsEnabled ? 'Browser reminders are enabled' : 'Enable browser reminders'}
            title={browserNotificationsEnabled ? 'Browser reminders enabled' : 'Enable browser reminders'}
            disabled={browserNotificationsEnabled}
          >
            {browserNotificationsEnabled ? <Bell size={17} /> : <BellOff size={17} />}
          </button>
        </div>
        <form className="reminder-form" onSubmit={addReminder}>
          <label className="planner-select">
            <span className="sr-only">Practical</span>
            <select value={practicalId} onChange={(event) => setPracticalId(event.target.value)} required>
              <option value="">Select a practical</option>
              {practicalList.map((item) => {
                const id = String(item._id || item.id);
                return <option key={id} value={id}>{item.title}</option>;
              })}
            </select>
          </label>
          <label className="planner-date">
            <span className="sr-only">Due date</span>
            <input type="date" value={dueDate} min={today} onChange={(event) => setDueDate(event.target.value)} required />
          </label>
          <button className="button button-secondary planner-add-button" type="submit" aria-label="Add reminder"><Plus size={16} />Add</button>
        </form>
        {reminderError && <p className="planner-error" role="alert">{reminderError}</p>}
        {dueReminders.length > 0 && <p className="due-reminder-summary" role="status">{dueReminders.length} reminder{dueReminders.length === 1 ? '' : 's'} due today or overdue.</p>}
        {sortedReminders.length ? (
          <ul className="reminder-list">
            {sortedReminders.map((reminder) => {
              const practical = practicalList.find((item) => String(item._id || item.id) === reminder.practicalId);
              const overdue = reminder.dueDate < today;
              return (
                <li key={reminder.id}>
                  <span className={`reminder-date ${overdue ? 'reminder-overdue' : ''}`}>{overdue ? 'Overdue' : reminder.dueDate === today ? 'Today' : new Date(`${reminder.dueDate}T12:00:00`).toLocaleDateString()}</span>
                  <Link to={`/student/practicals/${reminder.practicalId}`}>{practical?.title || 'Practical'}</Link>
                  <button type="button" className="icon-button reminder-remove" onClick={() => removeReminder(reminder.id)} aria-label={`Remove reminder for ${practical?.title || 'practical'}`}><Trash2 size={15} /></button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="planner-empty"><CheckCircle2 size={16} /> No upcoming reminders. Add one to plan a practical.</p>
        )}
        <p className="planner-caption">Reminders are saved on this device. Desktop alerts work while the portal is open.</p>
      </article>
    </section>
  );
}

export default StudentPlanner;
