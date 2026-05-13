import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";
import type { ManzaiBotConfig } from "@cheesekit/manzai-bot";
import { AppService } from "./app-service";
import { IPC_CHANNELS } from "../shared/ipc";

let mainWindow: BrowserWindow | undefined;
let service: AppService | undefined;

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 640,
    title: "CheeseKit",
    backgroundColor: "#f6f4ef",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return window;
}

function registerIpc(appService: AppService): void {
  ipcMain.handle(IPC_CHANNELS.getSnapshot, () => appService.getSnapshot());
  ipcMain.handle(IPC_CHANNELS.setManzaiEnabled, (_event, enabled: boolean) =>
    appService.setManzaiEnabled(Boolean(enabled))
  );
  ipcMain.handle(IPC_CHANNELS.updateManzaiConfig, (_event, config: Partial<ManzaiBotConfig>) =>
    appService.updateManzaiConfig(config)
  );
  ipcMain.handle(IPC_CHANNELS.setSendingPaused, (_event, paused: boolean) =>
    appService.setSendingPaused(Boolean(paused))
  );
  ipcMain.handle(IPC_CHANNELS.clearQueue, () => appService.clearQueue());
  ipcMain.handle(IPC_CHANNELS.emergencyStop, () => appService.emergencyStop());
  ipcMain.handle(IPC_CHANNELS.resumeAfterEmergency, () => appService.resumeAfterEmergency());
}

app.whenReady().then(async () => {
  service = new AppService();
  registerIpc(service);
  mainWindow = createWindow();
  service.setSnapshotListener((snapshot) => {
    mainWindow?.webContents.send(IPC_CHANNELS.snapshotUpdated, snapshot);
  });
  await service.start();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async (event) => {
  if (!service) {
    return;
  }

  event.preventDefault();
  const shuttingDown = service;
  service = undefined;
  await shuttingDown.shutdown();
  app.quit();
});
