export {};

declare global {
  interface Window {
    minimaxDesktop?: {
      getConfig: () => Promise<{
        apiToken?: string;
        shortcut: string;
        activeShortcut: string;
        defaultShortcut: string;
        platform: string;
      }>;
      setApiToken: (token: string) => Promise<{
        ok: boolean;
        hasApiToken: boolean;
      }>;
      setShortcut: (shortcut: string) => Promise<{
        ok: boolean;
        shortcut: string;
        error?: string;
      }>;
    };
  }
}
