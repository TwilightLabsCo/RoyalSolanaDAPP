// WebAuthn Passkey utilities for Royal Wallet
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
  encryptedSecretKey: string;
  encryptedSeedPhrase?: string;
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

// Create a new passkey and derive a wallet from it
export async function createPasskeyWallet(): Promise<{
  credential: PasskeyCredential;
  keypair: Keypair;
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
    
    // Derive wallet seed from credential ID + authenticator data
    const seedMaterial = new Uint8Array([
      ...new Uint8Array(credential.rawId),
      ...new Uint8Array(response.getAuthenticatorData?.() || response.clientDataJSON),
    ]);
    
    // Hash to get 32-byte seed
    const seedHash = await crypto.subtle.digest('SHA-256', seedMaterial);
    const keypair = Keypair.fromSeed(new Uint8Array(seedHash));

    return {
      credential: {
        id: credential.id,
        rawId: credential.rawId,
        type: 'public-key',
        publicKey: response.getPublicKey?.() || undefined,
      },
      keypair,
    };
  } catch (error) {
    console.error('Passkey wallet creation failed:', error);
    return null;
  }
}

// Authenticate with passkey and get signing material for decryption
export async function authenticatePasskey(credentialId?: string): Promise<{
  credential: PasskeyCredential;
  signature: ArrayBuffer;
} | null> {
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const options: PublicKeyCredentialRequestOptions = {
      challenge,
      rpId: RP_ID,
      userVerification: 'required',
      timeout: 60000,
    };

    // If we have a specific credential ID, use it
    if (credentialId) {
      options.allowCredentials = [
        {
          id: base64ToArrayBuffer(credentialId),
          type: 'public-key',
        },
      ];
    }

    const assertion = await navigator.credentials.get({
      publicKey: options,
    }) as PublicKeyCredential | null;

    if (!assertion) return null;

    const response = assertion.response as AuthenticatorAssertionResponse;

    return {
      credential: {
        id: assertion.id,
        rawId: assertion.rawId,
        type: 'public-key',
      },
      signature: response.signature,
    };
  } catch (error) {
    console.error('Passkey authentication failed:', error);
    return null;
  }
}

// Derive encryption key from passkey signature
async function deriveKeyFromSignature(signature: ArrayBuffer): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.digest('SHA-256', signature);
  return crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt data with passkey-derived key
export async function encryptWithPasskey(
  data: string,
  signature: ArrayBuffer
): Promise<string> {
  const key = await deriveKeyFromSignature(signature);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedData = new TextEncoder().encode(data);
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedData
  );

  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return arrayBufferToBase64(combined.buffer);
}

// Decrypt data with passkey-derived key
export async function decryptWithPasskey(
  encryptedData: string,
  signature: ArrayBuffer
): Promise<string> {
  const key = await deriveKeyFromSignature(signature);
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
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
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
