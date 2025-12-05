import * as bip39 from 'bip39';
import { saveEncryptedData, loadEncryptedData, deleteCookie } from './encryption';

export interface WalletData {
  publicKey: string;
  encryptedSeedPhrase: string;
  createdAt: number;
  passkeyEnabled: boolean;
  passkeyCredentialId?: string;
}

const WALLET_COOKIE_KEY = 'royal_wallet_data';

export function generateSeedPhrase(): string {
  return bip39.generateMnemonic(256); // 24 words
}

export function validateSeedPhrase(phrase: string): boolean {
  return bip39.validateMnemonic(phrase.trim().toLowerCase());
}

export function derivePublicKey(seedPhrase: string): string {
  // In a real implementation, this would derive the actual Solana keypair
  // For demo purposes, we create a deterministic "public key" from the seed
  const seed = bip39.mnemonicToSeedSync(seedPhrase);
  const keyBytes = seed.slice(0, 32);
  return Array.from(keyBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 44);
}

export async function createWallet(seedPhrase: string): Promise<WalletData> {
  const publicKey = derivePublicKey(seedPhrase);
  const walletData: WalletData = {
    publicKey,
    encryptedSeedPhrase: seedPhrase, // Will be encrypted when saved
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

export function formatPublicKey(key: string): string {
  if (key.length <= 12) return key;
  return `${key.slice(0, 6)}...${key.slice(-6)}`;
}

export function formatBalance(lamports: number): string {
  const sol = lamports / 1_000_000_000;
  return sol.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}
