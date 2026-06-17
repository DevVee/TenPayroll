"use strict";
const electron = require("electron");
const kioskAPI = {
  // Check in/out via PIN
  pinCheckin: (pin) => electron.ipcRenderer.invoke("kiosk:pin-checkin", pin),
  // Check in/out via RFID
  rfidCheckin: (rfid) => electron.ipcRenderer.invoke("kiosk:rfid-checkin", rfid),
  // Get recent check-ins for idle screen
  recentCheckins: () => electron.ipcRenderer.invoke("kiosk:recent-checkins"),
  // Get sync status
  syncStatus: () => electron.ipcRenderer.invoke("kiosk:sync-status"),
  // Get today's BLOCKING holiday (null if not a blocking holiday)
  todayHoliday: () => electron.ipcRenderer.invoke("kiosk:today-holiday"),
  // M6: Get today's special-working holiday (non-blocking, yellow notice only)
  todaySpecialHoliday: () => electron.ipcRenderer.invoke("kiosk:today-special-holiday"),
  // Refresh employee + shift + holiday caches from Supabase
  refreshEmployees: () => electron.ipcRenderer.invoke("kiosk:refresh-employees"),
  // Force an immediate sync cycle
  forceSync: () => electron.ipcRenderer.invoke("kiosk:force-sync"),
  // Exit kiosk mode — requires admin PIN (set via ADMIN_PIN in kiosk/.env)
  exit: (pin) => electron.ipcRenderer.invoke("kiosk:exit", pin),
  // Listen for RFID scan events pushed from main process
  onRfidScan: (cb) => {
    electron.ipcRenderer.on("rfid:scan", (_event, rfid) => cb(rfid));
    return () => electron.ipcRenderer.removeAllListeners("rfid:scan");
  }
};
electron.contextBridge.exposeInMainWorld("kiosk", kioskAPI);
