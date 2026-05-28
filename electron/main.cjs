const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const appName = 'daily';
const legacyAppName = 'neumorphic-todo';

app.setName(appName);

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
      recurringRules: Array.isArray(raw.recurringRules) ? raw.recurringRules : [],
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
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

function normalizeDiaries(raw) {
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
      return {};
    }
    return normalizeDiaries(JSON.parse(raw));
  } catch (error) {
    console.error('Failed to read diary store:', error);
    return {};
  }
}

async function writeDiaries(diariesByDate) {
  const normalized = normalizeDiaries(diariesByDate);
  await fs.mkdir(path.dirname(diaryStorePath), { recursive: true });
  await fs.writeFile(diaryStorePath, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

function getAutoLaunchEnabled() {
  return app.getLoginItemSettings().openAtLogin;
}

function setAutoLaunchEnabled(enabled) {
  app.setLoginItemSettings({
    openAtLogin: Boolean(enabled),
    openAsHidden: false,
  });

  return getAutoLaunchEnabled();
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

function createWindow() {
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
ipcMain.handle('settings:autoLaunch:get', getAutoLaunchEnabled);
ipcMain.handle('settings:autoLaunch:set', (_event, enabled) => setAutoLaunchEnabled(enabled));
ipcMain.handle('dock:set-badge', (_event, count) => updateBadgeIndicators(count));

app.whenReady().then(() => {
  setDockIcon();
  createTray();
  createWindow();

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
