export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function readJsonStorage<T>(
  key: string,
  isValid: (value: unknown) => value is T,
): T | null {
  const saved = readStorage(key);
  if (!saved) return null;

  try {
    const parsed = JSON.parse(saved);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeJsonStorage(key: string, value: unknown): boolean {
  try {
    return writeStorage(key, JSON.stringify(value));
  } catch {
    return false;
  }
}
