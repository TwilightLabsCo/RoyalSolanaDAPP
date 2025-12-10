import * as bip39 from 'bip39';
import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { saveEncryptedData, loadEncryptedData, deleteCookie } from './encryption';

export interface WalletData {
  publicKey: string;
  encryptedSeedPhrase: string;
  secretKey: string;
  createdAt: number;
  passkeyEnabled: boolean;
  passkeyCredentialId?: string;
}

const WALLET_COOKIE_KEY = 'royal_wallet_data';

export function generateSeedPhrase(): string {
  return bip39.generateMnemonic(128); // 12 words (128 bits) - more common
}

export function generate24WordSeedPhrase(): string {
  return bip39.generateMnemonic(256); // 24 words (256 bits)
}

export function validateSeedPhrase(phrase: string): boolean {
  return bip39.validateMnemonic(phrase.trim().toLowerCase());
}

// HMAC-SHA512 implementation for BIP32 derivation
async function hmacSha512(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
  return new Uint8Array(signature);
}

// Derive ed25519 key using SLIP-0010 (similar to BIP32 but for ed25519)
async function deriveEd25519Path(seed: Uint8Array, path: string): Promise<Uint8Array> {
  const ED25519_CURVE = new TextEncoder().encode('ed25519 seed');
  
  // Get master key
  let result = await hmacSha512(ED25519_CURVE, seed);
  let key = result.slice(0, 32);
  let chainCode = result.slice(32);
  
  // Parse path and derive
  const segments = path
    .split('/')
    .slice(1) // Remove 'm'
    .map(seg => {
      const hardened = seg.endsWith("'");
      const index = parseInt(hardened ? seg.slice(0, -1) : seg, 10);
      return hardened ? index + 0x80000000 : index;
    });
  
  for (const index of segments) {
    const indexBuffer = new Uint8Array(4);
    new DataView(indexBuffer.buffer).setUint32(0, index, false); // big-endian
    
    const data = new Uint8Array(1 + 32 + 4);
    data[0] = 0;
    data.set(key, 1);
    data.set(indexBuffer, 33);
    
    result = await hmacSha512(chainCode, data);
    key = result.slice(0, 32);
    chainCode = result.slice(32);
  }
  
  return key;
}

export async function deriveKeypairAsync(seedPhrase: string): Promise<Keypair> {
  const seed = bip39.mnemonicToSeedSync(seedPhrase.trim().toLowerCase());
  // Use standard Solana BIP44 derivation path (compatible with Phantom, Solflare, etc.)
  const derivedSeed = await deriveEd25519Path(new Uint8Array(seed), "m/44'/501'/0'/0'");
  return Keypair.fromSeed(derivedSeed);
}

// Synchronous version for backward compatibility (uses simplified derivation)
export function deriveKeypair(seedPhrase: string): Keypair {
  const seed = bip39.mnemonicToSeedSync(seedPhrase.trim().toLowerCase());
  // For sync version, use the first 32 bytes - this is the legacy behavior
  // Callers should prefer deriveKeypairAsync for proper BIP44 derivation
  return Keypair.fromSeed(new Uint8Array(seed.slice(0, 32)));
}

export async function createWallet(seedPhrase: string): Promise<WalletData> {
  // Use proper BIP44 derivation for compatibility with other wallets
  const keypair = await deriveKeypairAsync(seedPhrase);
  const walletData: WalletData = {
    publicKey: keypair.publicKey.toBase58(),
    secretKey: bs58.encode(keypair.secretKey),
    encryptedSeedPhrase: seedPhrase.trim().toLowerCase(),
    createdAt: Date.now(),
    passkeyEnabled: false,
  };
  
  await saveEncryptedData(WALLET_COOKIE_KEY, walletData);
  return walletData;
}

export async function loadWallet(): Promise<WalletData | null> {
  return loadEncryptedData<WalletData>(WALLET_COOKIE_KEY);
}

export async function updateWallet(data: Partial<WalletData>): Promise<void> {
  const existing = await loadWallet();
  if (existing) {
    await saveEncryptedData(WALLET_COOKIE_KEY, { ...existing, ...data });
  }
}

export function deleteWallet(): void {
  deleteCookie(WALLET_COOKIE_KEY);
  sessionStorage.clear();
}

export function getKeypairFromWallet(wallet: WalletData): Keypair {
  const secretKey = bs58.decode(wallet.secretKey);
  return Keypair.fromSecretKey(secretKey);
}

export function formatPublicKey(key: string): string {
  if (key.length <= 12) return key;
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export function formatBalance(lamports: number): string {
  const sol = lamports / 1_000_000_000;
  return sol.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}
