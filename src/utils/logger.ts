export type LogType = 'info' | 'success' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  type: LogType;
  message: string;
  data?: any;
  timestamp: Date;
}

export type Subscriber = (log: LogEntry) => void;

export class Logger {
  private logs: LogEntry[] = [];
  private subscribers: Set<Subscriber> = new Set();
  
  // Singleton instance for global usage
  private static instance: Logger;
  
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  subscribe(subscriber: Subscriber): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  clear() {
    this.logs = [];
  }

  private addLog(type: LogType, message: string, data?: any) {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      message,
      data,
      timestamp: new Date()
    };
    this.logs.push(entry);
    this.subscribers.forEach(sub => sub(entry));
  }

  info(message: string, data?: any) {
    this.addLog('info', message, data);
  }

  success(message: string, data?: any) {
    this.addLog('success', message, data);
  }

  warn(message: string, data?: any) {
    this.addLog('warn', message, data);
  }

  error(message: string, data?: any) {
    this.addLog('error', message, data);
  }
}

export const logger = Logger.getInstance();
