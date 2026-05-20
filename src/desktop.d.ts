export {};

declare global {
  interface Window {
    minimaxDesktop?: {
      getConfig: () => Promise<{
        apiToken?: string;
        shortcut: string;
        activeShortcut: string;
        defaultShortcut: string;
        generationRoot: string;
        defaultGenerationRoot: string;
        configPath: string;
        platform: string;
      }>;
      setApiToken: (token: string) => Promise<{
        ok: boolean;
        hasApiToken: boolean;
      }>;
      chooseGenerationRoot: () => Promise<{
        ok: boolean;
        generationRoot: string;
      }>;
      setShortcut: (shortcut: string) => Promise<{
        ok: boolean;
        shortcut: string;
        error?: string;
      }>;
    };
  }
}
