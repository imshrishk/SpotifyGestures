import '@testing-library/jest-dom';
import { beforeAll, afterAll, afterEach, vi } from 'vitest';

// Mock local storage
const mockStorage = new Map();

const localStorage = {
  getItem: (key: string) => mockStorage.has(key) ? mockStorage.get(key) : null,
  setItem: (key: string, value: string) => mockStorage.set(key, value),
  removeItem: (key: string) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
  length: mockStorage.size,
  key: (index: number) => Array.from(mockStorage.keys())[index],
};

Object.defineProperty(window, 'localStorage', { value: localStorage });

// Mock requestAnimationFrame since we don't have a real browser
if (!global.requestAnimationFrame) {
  global.requestAnimationFrame = (callback: FrameRequestCallback) => setTimeout(callback, 0);
}

// Clear mocks and storage after each test
afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

// Prevent console.error from cluttering test output
beforeAll(() => {
  console.error = vi.fn();
});

// Restore console.error after all tests
afterAll(() => {
  (console.error as unknown as { mockRestore: () => void }).mockRestore();
});