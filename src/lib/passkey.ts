// WebAuthn Passkey utilities
export interface PasskeyCredential {
  id: string;
  rawId: ArrayBuffer;
  type: 'public-key';
}

const RP_NAME = 'Royal Wallet';
const RP_ID = window.location.hostname;

export async function isPasskeySupported(): Promise<boolean> {
  return !!(
    window.PublicKeyCredential &&
    PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable &&
    (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
  );
}

export async function createPasskey(userId: string): Promise<PasskeyCredential | null> {
  try {
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
          { alg: -7, type: 'public-key' },  // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'required',
        },
        timeout: 60000,
        attestation: 'none',
      },
    }) as PublicKeyCredential;

    if (!credential) return null;

    return {
      id: credential.id,
      rawId: credential.rawId,
      type: 'public-key',
    };
  } catch (error) {
    console.error('Passkey creation failed:', error);
    return null;
  }
}

export async function verifyPasskey(credentialId: string): Promise<boolean> {
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: RP_ID,
        allowCredentials: [
          {
            id: Uint8Array.from(atob(credentialId), c => c.charCodeAt(0)),
            type: 'public-key',
          },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
    });

    return !!assertion;
  } catch (error) {
    console.error('Passkey verification failed:', error);
    return false;
  }
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
