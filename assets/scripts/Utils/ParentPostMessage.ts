/**
 * 向父窗口 postMessage（仅用于地图编辑器等 iframe 嵌套场景）。
 * iOS / 原生壳等环境下 window.parent 可能无标准 postMessage，需先检测再调用。
 */
export function postMessageToParent(message: unknown, targetOrigin: string): void {
    if (typeof window === 'undefined') {
        return;
    }
    const w = window as Window & { parent?: Window };
    const parentWin = w.parent;
    if (!parentWin || typeof parentWin.postMessage !== 'function') {
        return;
    }
    try {
        parentWin.postMessage(message, targetOrigin);
    } catch {
        // 部分 WebView 实现 postMessage 仍可能抛错，忽略即可
    }
}
