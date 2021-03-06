'use strict';

import {
  app, protocol, BrowserWindow, ipcMain, globalShortcut
} from 'electron';
import {
  createProtocol,
  installVueDevtools,
} from 'vue-cli-plugin-electron-builder/lib';
import Database from './database/database';

const isDevelopment = process.env.NODE_ENV !== 'production';

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win: BrowserWindow | null;

// Standard scheme must be registered before the app is ready
protocol.registerStandardSchemes(['app'], { secure: true });
function createWindow() {
  // Create the browser window.
  win = new BrowserWindow({
    center: true,
    webPreferences: {
      nodeIntegration: true
    }
  });

  win.maximize();
  win.setMenu(null);

  if (process.env.WEBPACK_DEV_SERVER_URL) {
    // Load the url of the dev server if in development mode
    win.loadURL(process.env.WEBPACK_DEV_SERVER_URL as string);
    if (!process.env.IS_TEST) win.webContents.openDevTools();
  } else {
    createProtocol('app');
    // Load the index.html when not in development
    win.loadURL('app://./index.html');
  }

  win.on('closed', () => {
    win = null;
  });
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow();
  }
});

// Prevent the app from starting twice
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.center();
    win.focus();
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  globalShortcut.register("CommandOrControl+Shift+J", () => {
    win.webContents.openDevTools({ mode: "undocked" });
  });

  // Autolaunch app - Only run this if the app is on production
  if (!isDevelopment && !process.env.IS_TEST) {
    const AutoLaunch = require('auto-launch');
    new AutoLaunch({
      name: 'noHandsToggl',
    }).enable();
  }
  // --

  if (isDevelopment && !process.env.IS_TEST) {
    // Install Vue Devtools
    try {
      await installVueDevtools();
    } catch (e) {
      console.error('Vue Devtools failed to install:', e.toString());
    }
  }
  createWindow();
  
  Database.startListening();

  const electron = require('electron');
  const { powerMonitor }: any = electron;

  ipcMain.on('get-idle-time', (event: any) => {
    powerMonitor.querySystemIdleTime((idleTime: any) => {
      event.sender.send('get-idle-time', idleTime);
    });
  });

  app.on('window-all-closed', (event: any) => {
    event.preventDefault();
    ipcMain.emit('app-shut-down');
  });

  powerMonitor.on('shutdown', (event: any) => {
    event.preventDefault();
    ipcMain.emit('app-shut-down');
  });

  powerMonitor.on('suspend', () => {
    ipcMain.emit('app-close');
  });
});

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === 'win32') {
    process.on('message', (data) => {
      if (data === 'graceful-exit') {
        app.quit();
      }
    });
  } else {
    process.on('SIGTERM', () => {
      app.quit();
    });
  }
}
