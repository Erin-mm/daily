const { app, BrowserWindow, ipcMain } = require('electron');
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
    };
  }

  if (raw && typeof raw === 'object') {
    return {
      tasksByDate: raw,
      recurringRules: [],
    };
  }

  return {
    tasksByDate: {},
    recurringRules: [],
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

function createWindow() {
  const window = new BrowserWindow({
    width: 380,
    height: 480,
    minWidth: 300,
    minHeight: 360,
    title: 'Daily',
    backgroundColor: '#f1f5f8',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    window.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

ipcMain.handle('tasks:load', readTasks);
ipcMain.handle('tasks:save', (_event, tasksByDate) => writeTasks(tasksByDate));
ipcMain.handle('diary:load', readDiaries);
ipcMain.handle('diary:save', (_event, diariesByDate) => writeDiaries(diariesByDate));
ipcMain.handle('settings:autoLaunch:get', getAutoLaunchEnabled);
ipcMain.handle('settings:autoLaunch:set', (_event, enabled) => setAutoLaunchEnabled(enabled));

app.whenReady().then(() => {
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
