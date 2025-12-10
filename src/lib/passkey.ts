// WebAuthn Passkey utilities for Royal Wallet
// Implements standalone passkey wallet like Trust Wallet / Coinbase Base Wallet
import { Keypair } from '@solana/web3.js';

export interface PasskeyCredential {
  id: string;
  rawId: ArrayBuffer;
  type: 'public-key';
  publicKey?: ArrayBuffer;
}

export interface StoredPasskeyWallet {
  credentialId: string;
  publicKey: string;
  // Wallet encryption key encrypted with a key derived from credential
  encryptedWalletKey: string;
  // The actual secret key encrypted with the wallet key
  encryptedSecretKey: string;
  encryptedSeedPhrase?: string;
  // Salt for key derivation
  salt: string;
  createdAt: number;
}

const RP_NAME = 'Royal Wallet';
const RP_ID = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const PASSKEY_WALLET_KEY = 'royal_passkey_wallet';

export async function isPasskeySupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    return !!(
      window.PublicKeyCredential &&
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    );
  } catch {
    return false;
  }
}

// Generate a deterministic key from credential ID and salt
async function deriveKeyFromCredential(
  credentialId: ArrayBuffer,
  salt: Uint8Array
): Promise<CryptoKey> {
  const combined = new Uint8Array([
    ...new Uint8Array(credentialId),
    ...salt,
  ]);
  const keyMaterial = await crypto.subtle.digest('SHA-256', combined);
  return crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

// Create a new passkey and derive a wallet from it
export async function createPasskeyWallet(): Promise<{
  credential: PasskeyCredential;
  keypair: Keypair;
  walletKey: CryptoKey;
  salt: Uint8Array;
} | null> {
  try {
    const userId = crypto.randomUUID();
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userIdBuffer = new TextEncoder().encode(userId);

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: RP_NAME,
          id: RP_ID,
        },
        user: {
          id: userIdBuffer,
          name: `wallet-${userId.slice(0, 8)}`,
          displayName: 'Royal Wallet User',
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },   // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
      },
    }) as PublicKeyCredential | null;

    if (!credential) return null;

    const response = credential.response as AuthenticatorAttestationResponse;
    
    // Generate a random salt for this wallet
    const salt = crypto.getRandomValues(new Uint8Array(32));
    
    // Derive wallet seed from credential ID + authenticator data + salt
    const seedMaterial = new Uint8Array([
      ...new Uint8Array(credential.rawId),
      ...new Uint8Array(response.getAuthenticatorData?.() || response.clientDataJSON),
      ...salt,
    ]);
    
    // Hash to get 32-byte seed for the keypair
    const seedHash = await crypto.subtle.digest('SHA-256', seedMaterial);
    const keypair = Keypair.fromSeed(new Uint8Array(seedHash));

    // Generate a random wallet encryption key
    const walletKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    return {
      credential: {
        id: credential.id,
        rawId: credential.rawId,
        type: 'public-key',
        publicKey: response.getPublicKey?.() || undefined,
      },
      keypair,
      walletKey,
      salt,
    };
  } catch (error) {
    console.error('Passkey wallet creation failed:', error);
    return null;
  }
}

// Convert base64url to standard base64
function base64UrlToBase64(base64url: string): string {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return base64;
}

// Convert standard base64 to base64url
function base64ToBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Authenticate with passkey - returns the credential for key derivation
export async function authenticatePasskey(credentialId?: string): Promise<{
  credential: PasskeyCredential;
} | null> {
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const options: PublicKeyCredentialRequestOptions = {
      challenge,
      rpId: RP_ID,
      userVerification: 'required',
      timeout: 60000,
    };

    if (credentialId) {
      // WebAuthn credential IDs are base64url encoded, convert properly
      const credentialIdBase64 = base64UrlToBase64(credentialId);
      options.allowCredentials = [
        {
          id: base64ToArrayBuffer(credentialIdBase64),
          type: 'public-key',
        },
      ];
    }

    const assertion = await navigator.credentials.get({
      publicKey: options,
    }) as PublicKeyCredential | null;

    if (!assertion) return null;

    return {
      credential: {
        id: assertion.id,
        rawId: assertion.rawId,
        type: 'public-key',
      },
    };
  } catch (error) {
    console.error('Passkey authentication failed:', error);
    return null;
  }
}

// Encrypt the wallet key with the credential-derived key
export async function encryptWalletKey(
  walletKey: CryptoKey,
  credentialId: ArrayBuffer,
  salt: Uint8Array
): Promise<string> {
  const wrapKey = await deriveKeyFromCredential(credentialId, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const wrappedKey = await crypto.subtle.wrapKey(
    'raw',
    walletKey,
    wrapKey,
    { name: 'AES-GCM', iv }
  );

  const combined = new Uint8Array(iv.length + wrappedKey.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(wrappedKey), iv.length);
  
  return arrayBufferToBase64(combined.buffer);
}

// Decrypt the wallet key with the credential-derived key
export async function decryptWalletKey(
  encryptedWalletKey: string,
  credentialId: ArrayBuffer,
  salt: Uint8Array
): Promise<CryptoKey> {
  const wrapKey = await deriveKeyFromCredential(credentialId, salt);
  const combined = base64ToArrayBuffer(encryptedWalletKey);
  const combinedArray = new Uint8Array(combined);
  
  const iv = combinedArray.slice(0, 12);
  const wrappedKey = combinedArray.slice(12);
  
  return crypto.subtle.unwrapKey(
    'raw',
    wrappedKey,
    wrapKey,
    { name: 'AES-GCM', iv },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// Encrypt data with the wallet key
export async function encryptWithWalletKey(
  data: string,
  walletKey: CryptoKey
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedData = new TextEncoder().encode(data);
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    walletKey,
    encodedData
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return arrayBufferToBase64(combined.buffer);
}

// Decrypt data with the wallet key
export async function decryptWithWalletKey(
  encryptedData: string,
  walletKey: CryptoKey
): Promise<string> {
  const combined = base64ToArrayBuffer(encryptedData);
  const combinedArray = new Uint8Array(combined);
  
  const iv = combinedArray.slice(0, 12);
  const data = combinedArray.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    walletKey,
    data
  );

  return new TextDecoder().decode(decrypted);
}

// Store passkey wallet data
export function savePasskeyWallet(wallet: StoredPasskeyWallet): void {
  localStorage.setItem(PASSKEY_WALLET_KEY, JSON.stringify(wallet));
}

// Load passkey wallet data
export function loadPasskeyWallet(): StoredPasskeyWallet | null {
  const data = localStorage.getItem(PASSKEY_WALLET_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// Delete passkey wallet
export function deletePasskeyWallet(): void {
  localStorage.removeItem(PASSKEY_WALLET_KEY);
}

// Check if passkey wallet exists
export function hasPasskeyWallet(): boolean {
  return !!localStorage.getItem(PASSKEY_WALLET_KEY);
}

// Helper functions
export function arrayBufferToBase64(buffer: ArrayBuffer | ArrayBufferLike): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Legacy compatibility - these are deprecated but kept for migration
export async function encryptWithPasskey(
  data: string,
  signature: ArrayBuffer
): Promise<string> {
  const keyMaterial = await crypto.subtle.digest('SHA-256', signature);
  const key = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedData = new TextEncoder().encode(data);
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedData
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return arrayBufferToBase64(combined.buffer);
}

export async function decryptWithPasskey(
  encryptedData: string,
  signature: ArrayBuffer
): Promise<string> {
  const keyMaterial = await crypto.subtle.digest('SHA-256', signature);
  const key = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
  const combined = base64ToArrayBuffer(encryptedData);
  const combinedArray = new Uint8Array(combined);
  
  const iv = combinedArray.slice(0, 12);
  const data = combinedArray.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  return new TextDecoder().decode(decrypted);
}
