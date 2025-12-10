declare module 'ed25519-hd-key' {
  export function derivePath(path: string, seed: string): { key: Buffer };
  export function getMasterKeyFromSeed(seed: string): { key: Buffer; chainCode: Buffer };
  export function getPublicKey(privateKey: Buffer, withZeroByte?: boolean): Buffer;
}
