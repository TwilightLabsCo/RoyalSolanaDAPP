import { Buffer } from 'buffer';

// Polyfill Buffer for browser compatibility (required by bip39 and other crypto libs)
if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
}

// Polyfill global
if (typeof globalThis !== 'undefined' && typeof (globalThis as any).global === 'undefined') {
  (globalThis as any).global = globalThis;
}

export {};
