const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('todoStore', {
  loadTasks: () => ipcRenderer.invoke('tasks:load'),
  saveTasks: (tasksByDate) => ipcRenderer.invoke('tasks:save', tasksByDate),
  loadDiaries: () => ipcRenderer.invoke('diary:load'),
  saveDiaries: (diariesByDate) => ipcRenderer.invoke('diary:save', diariesByDate),
  getAutoLaunch: () => ipcRenderer.invoke('settings:autoLaunch:get'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('settings:autoLaunch:set', enabled),
  setDockBadge: (count) => ipcRenderer.invoke('dock:set-badge', count),
});
