// See the Electron documentation for details on how to use preload scripts:
import { contextBridge } from "electron";
import path from "path";
import "electron-log/preload";
import "@shared/i18n/preload";
import "@shared/global-context/preload";
import "@shared/themepack/preload";
import "@shared/app-config/preload";
import "@shared/utils/preload";
import "@shared/window-drag/preload";

// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

// webpack 运行时引用了 __dirname，但在 contextIsolation=true 下
// __dirname 不会自动暴露给渲染进程，必须通过 contextBridge 手动桥接。
contextBridge.exposeInMainWorld("path", path);
contextBridge.exposeInMainWorld("__dirname", "/");
contextBridge.exposeInMainWorld("__filename", "/index.js");
