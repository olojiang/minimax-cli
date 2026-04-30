import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger } from './logger';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger();
  });

  it('should initialize with an empty log list', () => {
    expect(logger.getLogs().length).toBe(0);
  });

  it('should add an info log correctly', () => {
    logger.info('Test info message');
    const logs = logger.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].type).toBe('info');
    expect(logs[0].message).toBe('Test info message');
    expect(logs[0].timestamp).toBeInstanceOf(Date);
  });

  it('should add an error log with optional data', () => {
    const errorData = { code: 500 };
    logger.error('Test error message', errorData);
    const logs = logger.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].type).toBe('error');
    expect(logs[0].message).toBe('Test error message');
    expect(logs[0].data).toBe(errorData);
  });

  it('should notify subscribers when a log is added', () => {
    const subscriber = vi.fn();
    logger.subscribe(subscriber);
    
    logger.success('Action completed');
    
    expect(subscriber).toHaveBeenCalledTimes(1);
    const logArg = subscriber.mock.calls[0][0];
    expect(logArg.type).toBe('success');
    expect(logArg.message).toBe('Action completed');
  });

  it('should allow unsubscribing', () => {
    const subscriber = vi.fn();
    const unsubscribe = logger.subscribe(subscriber);
    
    unsubscribe();
    logger.warn('Warning message');
    
    expect(subscriber).not.toHaveBeenCalled();
  });

  it('should be able to clear logs', () => {
    logger.info('Msg 1');
    logger.info('Msg 2');
    logger.clear();
    expect(logger.getLogs().length).toBe(0);
  });
});
