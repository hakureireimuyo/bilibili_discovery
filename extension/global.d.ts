declare const chrome: {
  runtime: {
    sendMessage: (message: unknown, callback?: (response: unknown) => void) => void;
    onMessage: {
      addListener: (
        handler: (
          message: unknown,
          sender: unknown,
          sendResponse: (response?: unknown) => void
        ) => void
      ) => void;
    };
    lastError?: {
      message?: string;
    };
  };
  tabs?: {
    query?: (queryInfo: { url: string }) => Promise<{ id?: number }[]>;
    sendMessage?: (tabId: number, message: unknown) => Promise<unknown>;
  };
};
