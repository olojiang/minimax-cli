export {};

declare global {
  interface Window {
    minimaxDesktop?: {
      getConfig: () => Promise<{
        shortcut: string;
        activeShortcut: string;
        defaultShortcut: string;
        platform: string;
      }>;
      setShortcut: (shortcut: string) => Promise<{
        ok: boolean;
        shortcut: string;
        error?: string;
      }>;
    };
  }
}
