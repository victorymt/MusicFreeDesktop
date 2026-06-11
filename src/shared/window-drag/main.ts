/**
 * https://github.com/electron/electron/issues/1354#issuecomment-1356330873
 */

import { BrowserWindow, ipcMain } from "electron";
import debounce from "@/common/debounce";

interface IDragOptions {
    width: number;
    height: number;
    getWindowSize?: () => ICommon.ISize;
    onDragEnd: (position: ICommon.IPoint | null) => void;
}

class WindowDrag {
    private registeredWindows = new Map<BrowserWindow, IDragOptions>();

    setup(): void {
        ipcMain.on("set-window-draggable", (_evt, position) => {
            const window = BrowserWindow.fromWebContents(_evt.sender);
            if (this.registeredWindows.has(window)) {
                const metadata = this.registeredWindows.get(window);
                let width = metadata.width;
                let height = metadata.height;
                if (metadata.getWindowSize) {
                    const size = metadata.getWindowSize();
                    width = size.width;
                    height = size.height;
                }
                window.setBounds({
                    x: position.x,
                    y: position.y,
                    height: height,
                    width: width,
                });
                metadata.onDragEnd?.(position);
            }
        });
    }

    setWindowDraggable(window: BrowserWindow, options: IDragOptions): void {
        const originalDragEnd = options.onDragEnd;
        options.onDragEnd = debounce((position: ICommon.IPoint | null) => {
            originalDragEnd?.(position);
        }, 300, {
            leading: false,
            trailing: true,
        });
        this.registeredWindows.set(window, options);
        window.on("closed", () => {
            this.registeredWindows.delete(window);
        });
    }
}

export default new WindowDrag();
