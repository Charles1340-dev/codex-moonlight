const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("moonlight", {
  launch: (mode, duration) => ipcRenderer.invoke("moonlight:launch", mode, duration),
  window: action => ipcRenderer.send("moonlight:window", action),
  petAction: (action, value) => ipcRenderer.invoke("moonlight:pet-action", action, value),
  onPetScene: listener => {
    const receive = (_event, scene) => listener(scene);
    ipcRenderer.on("moonlight:pet-scene", receive);
    return () => ipcRenderer.removeListener("moonlight:pet-scene", receive);
  },
  onPetPosition: listener => {
    const receive = (_event, offset) => listener(offset);
    ipcRenderer.on("moonlight:pet-position", receive);
    return () => ipcRenderer.removeListener("moonlight:pet-position", receive);
  },
  onPetDismiss: listener => {
    const receive = () => listener();
    ipcRenderer.on("moonlight:pet-dismiss", receive);
    return () => ipcRenderer.removeListener("moonlight:pet-dismiss", receive);
  },
  onPetContext: listener => {
    const receive = () => listener();
    ipcRenderer.on("moonlight:pet-context", receive);
    return () => ipcRenderer.removeListener("moonlight:pet-context", receive);
  },
  onPetRelease: listener => {
    const receive = (_event, moved) => listener(moved);
    ipcRenderer.on("moonlight:pet-release", receive);
    return () => ipcRenderer.removeListener("moonlight:pet-release", receive);
  },
});
