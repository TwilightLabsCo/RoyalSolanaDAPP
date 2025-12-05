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
  return bip39.generateMnemonic(256);
}

export function validateSeedPhrase(phrase: string): boolean {
  return bip39.validateMnemonic(phrase.trim().toLowerCase());
}

export function deriveKeypair(seedPhrase: string): Keypair {
  const seed = bip39.mnemonicToSeedSync(seedPhrase.trim().toLowerCase());
  // Use first 32 bytes of seed for keypair (simplified derivation)
  const keypairSeed = seed.slice(0, 32);
  return Keypair.fromSeed(new Uint8Array(keypairSeed));
}

export async function createWallet(seedPhrase: string): Promise<WalletData> {
  const keypair = deriveKeypair(seedPhrase);
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
