import { contextBridge, ipcRenderer } from "electron";
import type { ManzaiBotConfig } from "@cheesekit/manzai-bot";
import { IPC_CHANNELS, type AppSnapshot, type RendererCheeseKitApi } from "../shared/ipc";

const api: RendererCheeseKitApi = {
  getSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.getSnapshot) as Promise<AppSnapshot>,
  setManzaiEnabled: (enabled: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.setManzaiEnabled, enabled) as Promise<AppSnapshot>,
  updateManzaiConfig: (config: Partial<ManzaiBotConfig>) =>
    ipcRenderer.invoke(IPC_CHANNELS.updateManzaiConfig, config) as Promise<AppSnapshot>,
  setSendingPaused: (paused: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.setSendingPaused, paused) as Promise<AppSnapshot>,
  clearQueue: () => ipcRenderer.invoke(IPC_CHANNELS.clearQueue) as Promise<AppSnapshot>,
  emergencyStop: () => ipcRenderer.invoke(IPC_CHANNELS.emergencyStop) as Promise<AppSnapshot>,
  resumeAfterEmergency: () =>
    ipcRenderer.invoke(IPC_CHANNELS.resumeAfterEmergency) as Promise<AppSnapshot>,
  onSnapshot: (callback: (snapshot: AppSnapshot) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: AppSnapshot) => callback(snapshot);
    ipcRenderer.on(IPC_CHANNELS.snapshotUpdated, listener);
    return () => ipcRenderer.off(IPC_CHANNELS.snapshotUpdated, listener);
  }
};

contextBridge.exposeInMainWorld("cheeseKit", api);
