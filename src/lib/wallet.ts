import * as bip39 from 'bip39';
import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { HDKey } from 'micro-ed25519-hdkey';
import { saveEncryptedData, loadEncryptedData, deleteCookie, encrypt, decrypt } from './encryption';

export interface WalletData {
  publicKey: string;
  encryptedSeedPhrase: string; // Actually encrypted with AES-GCM
  secretKey: string;
  createdAt: number;
  passkeyEnabled: boolean;
  passkeyCredentialId?: string;
}

const WALLET_COOKIE_KEY = 'royal_wallet_data';

// Standard Solana derivation path (used by Phantom, Solflare, etc.)
const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'";

export function generateSeedPhrase(): string {
  return bip39.generateMnemonic(256); // 24 words (256 bits)
}

export function generate12WordSeedPhrase(): string {
  return bip39.generateMnemonic(128); // 12 words (128 bits)
}

export function validateSeedPhrase(phrase: string): boolean {
  return bip39.validateMnemonic(phrase.trim().toLowerCase());
}

export function deriveKeypair(seedPhrase: string): Keypair {
  const seed = bip39.mnemonicToSeedSync(seedPhrase.trim().toLowerCase(), "");
  const hd = HDKey.fromMasterSeed(seed.toString('hex'));
  const derived = hd.derive(SOLANA_DERIVATION_PATH);
  return Keypair.fromSeed(derived.privateKey);
}

export async function createWallet(seedPhrase: string): Promise<WalletData> {
  // Use proper BIP44 derivation for compatibility with Phantom, Solflare, etc.
  const keypair = deriveKeypair(seedPhrase);
  const normalizedSeedPhrase = seedPhrase.trim().toLowerCase();
  
  // Actually encrypt the seed phrase before storing
  const encryptedSeed = await encrypt(normalizedSeedPhrase);
  
  const walletData: WalletData = {
    publicKey: keypair.publicKey.toBase58(),
    secretKey: bs58.encode(keypair.secretKey),
    encryptedSeedPhrase: encryptedSeed,
    createdAt: Date.now(),
    passkeyEnabled: false,
  };
  
  await saveEncryptedData(WALLET_COOKIE_KEY, walletData);
  
  // Return wallet data with decrypted seed phrase for immediate use
  return {
    ...walletData,
    encryptedSeedPhrase: normalizedSeedPhrase, // Return plaintext for current session
  };
}

// Decrypt the seed phrase from wallet data
export async function decryptSeedPhrase(encryptedSeedPhrase: string): Promise<string> {
  try {
    return await decrypt(encryptedSeedPhrase);
  } catch {
    // If decryption fails, it might already be plaintext (legacy data)
    return encryptedSeedPhrase;
  }
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
