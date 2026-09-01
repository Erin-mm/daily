const { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, Notification } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const appName = 'daily';
const legacyAppName = 'neumorphic-todo';

app.setName(appName);
const hasSingleInstanceLock = app.requestSingleInstanceLock();

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const userDataPath = app.getPath('userData');
const legacyUserDataPath = path.join(app.getPath('appData'), legacyAppName);
const storePath = path.join(userDataPath, 'tasks.json');
const diaryStorePath = path.join(userDataPath, 'diaries.json');
const iconPath = path.join(__dirname, '../build/icon.png');
const defaultFeatureSettings = {
  calendarEnabled: false,
  diaryEnabled: false,
};
let mainWindow = null;
let tray = null;
let pendingBadgeCount = 0;
let reminderTimer = null;
const deliveredReminderKeys = new Set();

async function copyLegacyStoreFile(filename) {
  const sourcePath = path.join(legacyUserDataPath, filename);
  const targetPath = path.join(userDataPath, filename);

  try {
    await fs.access(targetPath);
    return;
  } catch {
    // Continue only when the new file does not exist yet.
  }

  try {
    await fs.access(sourcePath);
    await fs.mkdir(userDataPath, { recursive: true });
    await fs.copyFile(sourcePath, targetPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.error(`Failed to migrate ${filename} from legacy store:`, error);
    }
  }
}

async function migrateLegacyStores() {
  if (legacyUserDataPath === userDataPath) {
    return;
  }

  await Promise.all([copyLegacyStoreFile('tasks.json'), copyLegacyStoreFile('diaries.json')]);
}

async function ensureStore() {
  await migrateLegacyStores();

  try {
    await fs.access(storePath);
  } catch {
    await fs.mkdir(path.dirname(storePath), { recursive: true });
    await fs.writeFile(storePath, JSON.stringify({}, null, 2), 'utf8');
  }
}

function normalizeStore(raw) {
  if (raw && typeof raw === 'object' && raw.tasksByDate) {
    return {
      tasksByDate: raw.tasksByDate ?? {},
      recurringRules: normalizeRecurringRules(raw.recurringRules),
      featureSettings: normalizeFeatureSettings(raw.featureSettings),
    };
  }

  if (raw && typeof raw === 'object') {
    return {
      tasksByDate: raw,
      recurringRules: [],
      featureSettings: defaultFeatureSettings,
    };
  }

  return {
    tasksByDate: {},
    recurringRules: [],
    featureSettings: defaultFeatureSettings,
  };
}

function normalizeRecurringRules(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter(
      (rule) =>
        rule &&
        typeof rule === 'object' &&
        typeof rule.id === 'string' &&
        typeof rule.taskId === 'string' &&
        typeof rule.text === 'string' &&
        Array.isArray(rule.weekdays),
    )
    .map((rule) => ({
      id: rule.id,
      taskId: rule.taskId,
      text: rule.text,
      weekdays: rule.weekdays.filter((weekday) => Number.isInteger(weekday) && weekday >= 0 && weekday <= 6),
      ...(typeof rule.reminderTime === 'string' && /^\d{2}:\d{2}$/.test(rule.reminderTime)
        ? { reminderTime: rule.reminderTime }
        : {}),
    }));
}

function normalizeFeatureSettings(raw) {
  if (!raw || typeof raw !== 'object') {
    return defaultFeatureSettings;
  }

  return {
    calendarEnabled:
      typeof raw.calendarEnabled === 'boolean'
        ? raw.calendarEnabled
        : defaultFeatureSettings.calendarEnabled,
    diaryEnabled:
      typeof raw.diaryEnabled === 'boolean' ? raw.diaryEnabled : defaultFeatureSettings.diaryEnabled,
  };
}

async function readTasks() {
  await ensureStore();

  try {
    const raw = await fs.readFile(storePath, 'utf8');
    if (!raw.trim()) {
      return normalizeStore(null);
    }
    return normalizeStore(JSON.parse(raw));
  } catch (error) {
    console.error('Failed to read tasks store:', error);
    return normalizeStore(null);
  }
}

async function writeTasks(data) {
  const normalized = normalizeStore(data);
  normalized.tasksByDate = pruneExpiredRecurringTasks(normalized.tasksByDate);
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

function pruneExpiredRecurringTasks(tasksByDate) {
  const todayKey = toDateKey(new Date());
  return Object.fromEntries(
    Object.entries(tasksByDate)
      .map(([dateKey, tasks]) => [
        dateKey,
        dateKey < todayKey ? tasks.filter((task) => !task.recurringRuleId) : tasks,
      ])
      .filter(([, tasks]) => tasks.length > 0),
  );
}

function normalizeDiaryEntries(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.entries) {
    return normalizeDiaryEntries(raw.entries);
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(raw).filter(
      ([dateKey, content]) =>
        /^\d{4}-\d{2}-\d{2}$/.test(dateKey) && typeof content === 'string',
    ),
  );
}

function normalizeTimestampMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(raw).filter(
      ([dateKey, timestamp]) =>
        /^\d{4}-\d{2}-\d{2}$/.test(dateKey) &&
        typeof timestamp === 'string' &&
        !Number.isNaN(Date.parse(timestamp)),
    ),
  );
}

function normalizeDiarySyncData(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.entries) {
    return {
      entries: normalizeDiaryEntries(raw.entries),
      updatedAtByDate: normalizeTimestampMap(raw.updatedAtByDate),
      deletedAtByDate: normalizeTimestampMap(raw.deletedAtByDate),
    };
  }

  const entries = normalizeDiaryEntries(raw);
  const now = new Date().toISOString();

  return {
    entries,
    updatedAtByDate: Object.fromEntries(Object.keys(entries).map((dateKey) => [dateKey, now])),
    deletedAtByDate: {},
  };
}

async function ensureDiaryStore() {
  await migrateLegacyStores();

  try {
    await fs.access(diaryStorePath);
  } catch {
    await fs.mkdir(path.dirname(diaryStorePath), { recursive: true });
    await fs.writeFile(diaryStorePath, JSON.stringify({}, null, 2), 'utf8');
  }
}

async function readDiaries() {
  await ensureDiaryStore();

  try {
    const raw = await fs.readFile(diaryStorePath, 'utf8');
    if (!raw.trim()) {
      return normalizeDiarySyncData(null);
    }
    return normalizeDiarySyncData(JSON.parse(raw));
  } catch (error) {
    console.error('Failed to read diary store:', error);
    return normalizeDiarySyncData(null);
  }
}

async function writeDiaries(diariesByDate) {
  const normalized = normalizeDiarySyncData(diariesByDate);
  await fs.mkdir(path.dirname(diaryStorePath), { recursive: true });
  await fs.writeFile(diaryStorePath, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

async function exportBackup(backup) {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出 Daily 备份',
    defaultPath: path.join(app.getPath('downloads'), `Daily-backup-${toDateKey(new Date())}.json`),
    filters: [{ name: 'JSON 备份', extensions: ['json'] }],
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  await fs.writeFile(result.filePath, JSON.stringify(backup, null, 2), 'utf8');
  return { canceled: false, filePath: result.filePath };
}

async function importBackup() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '导入 Daily 备份',
    properties: ['openFile'],
    filters: [{ name: 'JSON 备份', extensions: ['json'] }],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const filePath = result.filePaths[0];
  const content = await fs.readFile(filePath, 'utf8');
  return {
    canceled: false,
    filePath,
    data: JSON.parse(content),
  };
}

function getAutoLaunchEnabled() {
  return app.getLoginItemSettings().openAtLogin;
}

function setAutoLaunchEnabled(enabled) {
  app.setLoginItemSettings({
    openAtLogin: Boolean(enabled),
    openAsHidden: true,
  });

  return getAutoLaunchEnabled();
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function toTimeKey(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
}

function createTask(text, recurringRuleId) {
  return {
    id: randomUUID(),
    text,
    completed: false,
    createdAt: new Date().toISOString(),
    ...(recurringRuleId ? { recurringRuleId } : {}),
  };
}

function applyRecurringRulesForDate(tasksByDate, rules, date) {
  const dateKey = toDateKey(date);
  const weekday = date.getDay();
  const activeRules = rules.filter((rule) => rule.weekdays.includes(weekday));

  if (activeRules.length === 0) {
    return { tasksByDate, changed: false };
  }

  const dayTasks = [...(tasksByDate[dateKey] ?? [])];
  let changed = false;

  for (const rule of activeRules) {
    if (dayTasks.some((task) => task.recurringRuleId === rule.id)) {
      continue;
    }

    dayTasks.unshift(createTask(rule.text, rule.id));
    changed = true;
  }

  if (!changed) {
    return { tasksByDate, changed: false };
  }

  return {
    tasksByDate: {
      ...tasksByDate,
      [dateKey]: dayTasks,
    },
    changed: true,
  };
}

function notifyDueRules(tasksByDate, rules, date) {
  if (!Notification.isSupported()) {
    return;
  }

  const dateKey = toDateKey(date);
  const timeKey = toTimeKey(date);
  const weekday = date.getDay();
  const dayTasks = tasksByDate[dateKey] ?? [];

  for (const rule of rules) {
    if (!rule.reminderTime || rule.reminderTime !== timeKey || !rule.weekdays.includes(weekday)) {
      continue;
    }

    const reminderKey = `${dateKey}:${rule.id}:${timeKey}`;
    if (deliveredReminderKeys.has(reminderKey)) {
      continue;
    }

    const task = dayTasks.find((item) => item.recurringRuleId === rule.id);
    if (task?.completed) {
      deliveredReminderKeys.add(reminderKey);
      continue;
    }

    deliveredReminderKeys.add(reminderKey);
    new Notification({
      title: 'Daily 提醒',
      body: rule.text,
      silent: false,
    }).show();
  }
}

async function syncRecurringTasksAndReminders() {
  try {
    const now = new Date();
    const store = await readTasks();
    const { tasksByDate, changed } = applyRecurringRulesForDate(
      store.tasksByDate,
      store.recurringRules,
      now,
    );
    const nextStore = changed ? await writeTasks({ ...store, tasksByDate }) : { ...store, tasksByDate };
    const todayTasks = nextStore.tasksByDate[toDateKey(now)] ?? [];

    notifyDueRules(nextStore.tasksByDate, nextStore.recurringRules, now);
    updateBadgeIndicators(todayTasks.filter((task) => !task.completed).length);
  } catch (error) {
    console.error('Failed to sync recurring reminders:', error);
  }
}

function startReminderScheduler() {
  if (reminderTimer) {
    return;
  }

  void syncRecurringTasksAndReminders();
  reminderTimer = setInterval(syncRecurringTasksAndReminders, 60 * 1000);
}

function updateBadgeIndicators(count) {
  const nextCount = Number(count);
  pendingBadgeCount = Number.isFinite(nextCount) ? Math.max(0, Math.floor(nextCount)) : 0;

  if (process.platform === 'darwin' && app.dock) {
    app.dock.setBadge(pendingBadgeCount > 0 ? String(pendingBadgeCount) : '');
  }

  if (tray) {
    tray.setTitle(pendingBadgeCount > 0 ? String(pendingBadgeCount) : '');
    tray.setToolTip(
      pendingBadgeCount > 0 ? `Daily - ${pendingBadgeCount} 个待办` : 'Daily',
    );
  }
}

function setDockIcon() {
  if (process.platform === 'darwin' && app.dock && isDev) {
    app.dock.setIcon(iconPath);
  }
}

function showMainWindow() {
  const window = createWindow();

  if (window.isMinimized()) {
    window.restore();
  }

  window.show();
  window.focus();
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;

  return Math.hypot(px - closestX, py - closestY);
}

function createTrayIcon() {
  const size = 36;
  const scaleFactor = 2;
  const buffer = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const centerX = x + 0.5;
      const centerY = y + 0.5;
      const boxLeft = 6;
      const boxTop = 6;
      const boxRight = 30;
      const boxBottom = 30;
      const radius = 5;
      const cornerX = Math.max(boxLeft + radius, Math.min(centerX, boxRight - radius));
      const cornerY = Math.max(boxTop + radius, Math.min(centerY, boxBottom - radius));
      const isInRoundedBox =
        centerX >= boxLeft &&
        centerX <= boxRight &&
        centerY >= boxTop &&
        centerY <= boxBottom &&
        Math.hypot(centerX - cornerX, centerY - cornerY) <= radius;
      const isInCheck =
        distanceToSegment(centerX, centerY, 11, 18.5, 16, 23.5) <= 2.8 ||
        distanceToSegment(centerX, centerY, 16, 23.5, 26, 13.5) <= 2.8;

      buffer[index] = 0;
      buffer[index + 1] = 0;
      buffer[index + 2] = 0;
      buffer[index + 3] = isInRoundedBox && !isInCheck ? 255 : 0;
    }
  }

  const trayIcon = nativeImage.createFromBitmap(buffer, {
    width: size,
    height: size,
    scaleFactor,
  });
  trayIcon.setTemplateImage(true);

  return trayIcon;
}

function createTray() {
  if (process.platform !== 'darwin' || tray) {
    return;
  }

  tray = new Tray(createTrayIcon());
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '打开 Daily', click: showMainWindow },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() },
    ]),
  );
  tray.on('click', showMainWindow);
  updateBadgeIndicators(pendingBadgeCount);
}

function createWindow(shouldShow = true) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 380,
    height: 480,
    minWidth: 300,
    minHeight: 360,
    title: 'Daily',
    icon: iconPath,
    backgroundColor: '#f1f5f8',
    titleBarStyle: 'hiddenInset',
    show: shouldShow,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

ipcMain.handle('tasks:load', readTasks);
ipcMain.handle('tasks:save', (_event, tasksByDate) => writeTasks(tasksByDate));
ipcMain.handle('diary:load', readDiaries);
ipcMain.handle('diary:save', (_event, diariesByDate) => writeDiaries(diariesByDate));
ipcMain.handle('backup:export', (_event, backup) => exportBackup(backup));
ipcMain.handle('backup:import', importBackup);
ipcMain.handle('settings:autoLaunch:get', getAutoLaunchEnabled);
ipcMain.handle('settings:autoLaunch:set', (_event, enabled) => setAutoLaunchEnabled(enabled));
ipcMain.handle('dock:set-badge', (_event, count) => updateBadgeIndicators(count));

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (app.isReady()) {
      showMainWindow();
    }
  });

  app.whenReady().then(() => {
    setDockIcon();
    createTray();
    startReminderScheduler();

    createWindow(!app.getLoginItemSettings().wasOpenedAsHidden);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
