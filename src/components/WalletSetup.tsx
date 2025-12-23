import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CrownIcon } from "./CrownIcon";
import { generateSeedPhrase, validateSeedPhrase, createWallet, WalletData, deriveKeypair } from "@/lib/wallet";
import { encrypt } from "@/lib/encryption";
import { 
  isPasskeySupported,
  isSecurityKeySupported,
  createPasskeyWallet,
  createSecurityKeyWallet,
  authenticatePasskey,
  encryptWalletKey,
  encryptWithWalletKey,
  decryptWalletKey,
  decryptWithWalletKey,
  savePasskeyWallet,
  loadPasskeyWallet,
  hasPasskeyWallet,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  StoredPasskeyWallet,
} from "@/lib/passkey";
import { Shield, Key, Import, Eye, EyeOff, Copy, Check, AlertTriangle, Globe, Fingerprint, Loader2, KeyRound } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import bs58 from "bs58";

interface WalletSetupProps {
  onWalletCreated: (wallet: WalletData) => void;
}

type SetupStep = "welcome" | "create" | "import" | "passkey-create" | "passkey-import" | "passkey-unlock" | "securitykey-create";

export function WalletSetup({ onWalletCreated }: WalletSetupProps) {
  const [step, setStep] = useState<SetupStep>("welcome");
  const [seedPhrase, setSeedPhrase] = useState("");
  const [importPhrase, setImportPhrase] = useState("");
  const [showPhrase, setShowPhrase] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [securityKeySupported, setSecurityKeySupported] = useState(false);
  const [existingPasskeyWallet, setExistingPasskeyWallet] = useState<StoredPasskeyWallet | null>(null);

  useEffect(() => {
    const checkPasskey = async () => {
      const [passkey, secKey] = await Promise.all([
        isPasskeySupported(),
        isSecurityKeySupported(),
      ]);
      setPasskeySupported(passkey);
      setSecurityKeySupported(secKey);
      
      if ((passkey || secKey) && hasPasskeyWallet()) {
        const wallet = loadPasskeyWallet();
        setExistingPasskeyWallet(wallet);
      }
    };
    checkPasskey();
  }, []);

  // Create wallet with YubiKey/security key
  const handleSecurityKeyCreate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await createSecurityKeyWallet();
      if (!result) {
        throw new Error("Failed to create with security key. Please try again.");
      }

      const { credential, keypair, walletKey, salt } = result;
      
      const encryptedWalletKey = await encryptWalletKey(walletKey, credential.rawId, salt);
      const secretKeyBase58 = bs58.encode(keypair.secretKey);
      const encryptedSecretKey = await encryptWithWalletKey(secretKeyBase58, walletKey);

      const passkeyWallet: StoredPasskeyWallet = {
        credentialId: credential.id,
        publicKey: keypair.publicKey.toBase58(),
        encryptedWalletKey,
        encryptedSecretKey,
        salt: arrayBufferToBase64(salt.buffer),
        createdAt: Date.now(),
        isSecurityKey: true,
      };
      savePasskeyWallet(passkeyWallet);

      const walletData: WalletData = {
        publicKey: keypair.publicKey.toBase58(),
        secretKey: secretKeyBase58,
        encryptedSeedPhrase: '',
        createdAt: Date.now(),
        passkeyEnabled: true,
        passkeyCredentialId: credential.id,
      };

      toast({
        title: "Security key wallet created!",
        description: `Address: ${keypair.publicKey.toBase58().slice(0, 8)}...`,
      });
      onWalletCreated(walletData);
    } catch (err: any) {
      console.error("Security key creation failed:", err);
      setError(err.message || "Failed to create security key wallet");
      toast({
        title: "Error",
        description: err.message || "Failed to create security key wallet",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateWallet = () => {
    try {
      const phrase = generateSeedPhrase();
      setSeedPhrase(phrase);
      setStep("create");
      setError(null);
    } catch (err: any) {
      setError("Failed to generate seed phrase. Please try again.");
      toast({
        title: "Error",
        description: "Failed to generate seed phrase",
        variant: "destructive",
      });
    }
  };

  const handleCopyPhrase = async () => {
    await navigator.clipboard.writeText(seedPhrase);
    setCopied(true);
    toast({ 
      title: "Copied!", 
      description: "Seed phrase copied. Clipboard will auto-clear in 30 seconds.",
    });
    setTimeout(() => setCopied(false), 2000);
    // Auto-clear clipboard after 30 seconds for security
    setTimeout(() => {
      navigator.clipboard.writeText('').catch(() => {});
    }, 30000);
  };

  const handleConfirmCreate = async () => {
    if (!confirmed) {
      toast({
        title: "Please confirm",
        description: "You must confirm you've saved your seed phrase",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const wallet = await createWallet(seedPhrase);
      toast({
        title: "Wallet created!",
        description: `Address: ${wallet.publicKey.slice(0, 8)}...`,
      });
      onWalletCreated(wallet);
    } catch (err: any) {
      console.error("Failed to create wallet:", err);
      setError(err.message || "Failed to create wallet");
      toast({
        title: "Error",
        description: err.message || "Failed to create wallet",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportWallet = async () => {
    const trimmed = importPhrase.trim().toLowerCase();
    
    if (!trimmed) {
      toast({
        title: "Error",
        description: "Please enter your seed phrase",
        variant: "destructive",
      });
      return;
    }

    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount !== 12 && wordCount !== 24) {
      toast({
        title: "Invalid seed phrase",
        description: "Please enter a 12 or 24 word seed phrase",
        variant: "destructive",
      });
      return;
    }

    if (!validateSeedPhrase(trimmed)) {
      toast({
        title: "Invalid seed phrase",
        description: "The seed phrase contains invalid words. Please check and try again.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const wallet = await createWallet(trimmed);
      toast({
        title: "Wallet imported!",
        description: `Address: ${wallet.publicKey.slice(0, 8)}...`,
      });
      onWalletCreated(wallet);
    } catch (err: any) {
      console.error("Failed to import wallet:", err);
      setError(err.message || "Failed to import wallet");
      toast({
        title: "Error",
        description: err.message || "Failed to import wallet",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Create wallet directly from passkey - standalone like Trust/Coinbase wallet
  const handlePasskeyCreate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await createPasskeyWallet();
      if (!result) {
        throw new Error("Failed to create passkey. Please try again.");
      }

      const { credential, keypair, walletKey, salt } = result;
      
      // Encrypt the wallet key with the credential-derived key
      const encryptedWalletKey = await encryptWalletKey(
        walletKey,
        credential.rawId,
        salt
      );

      // Encrypt the secret key with the wallet key
      const secretKeyBase58 = bs58.encode(keypair.secretKey);
      const encryptedSecretKey = await encryptWithWalletKey(secretKeyBase58, walletKey);

      // Save passkey wallet to localStorage
      const passkeyWallet: StoredPasskeyWallet = {
        credentialId: credential.id,
        publicKey: keypair.publicKey.toBase58(),
        encryptedWalletKey,
        encryptedSecretKey,
        salt: arrayBufferToBase64(salt.buffer),
        createdAt: Date.now(),
      };
      savePasskeyWallet(passkeyWallet);

      // Create wallet data for the app
      const walletData: WalletData = {
        publicKey: keypair.publicKey.toBase58(),
        secretKey: secretKeyBase58,
        encryptedSeedPhrase: '',
        createdAt: Date.now(),
        passkeyEnabled: true,
        passkeyCredentialId: credential.id,
      };

      toast({
        title: "Passkey wallet created!",
        description: `Address: ${keypair.publicKey.toBase58().slice(0, 8)}...`,
      });
      onWalletCreated(walletData);
    } catch (err: any) {
      console.error("Passkey creation failed:", err);
      setError(err.message || "Failed to create passkey wallet");
      toast({
        title: "Error",
        description: err.message || "Failed to create passkey wallet",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Import/load wallet with existing passkey (seedless) - like Trust/Coinbase wallet
  const handlePasskeyImport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Check if we have a stored wallet first
      const storedWallet = loadPasskeyWallet();
      
      if (!storedWallet) {
        throw new Error("No passkey wallet found on this device. Please create a new wallet.");
      }

      // Authenticate with the stored credential ID
      const auth = await authenticatePasskey(storedWallet.credentialId);
      if (!auth) {
        throw new Error("Passkey authentication failed or cancelled");
      }

      // Found matching stored wallet - decrypt it
      const salt = new Uint8Array(base64ToArrayBuffer(storedWallet.salt));
      
      const walletKey = await decryptWalletKey(
        storedWallet.encryptedWalletKey,
        auth.credential.rawId,
        salt
      );

      const secretKey = await decryptWithWalletKey(
        storedWallet.encryptedSecretKey,
        walletKey
      );

      let encryptedSeedPhrase = '';
      if (storedWallet.encryptedSeedPhrase) {
        // Decrypt from passkey storage, then re-encrypt with session AES for consistent handling
        const plaintextSeed = await decryptWithWalletKey(
          storedWallet.encryptedSeedPhrase,
          walletKey
        );
        encryptedSeedPhrase = await encrypt(plaintextSeed);
      }

      const walletData: WalletData = {
        publicKey: storedWallet.publicKey,
        secretKey,
        encryptedSeedPhrase,
        createdAt: storedWallet.createdAt,
        passkeyEnabled: true,
        passkeyCredentialId: storedWallet.credentialId,
      };

      toast({
        title: "Wallet loaded!",
        description: `Address: ${storedWallet.publicKey.slice(0, 8)}...`,
      });
      onWalletCreated(walletData);
    } catch (err: any) {
      console.error("Passkey import failed:", err);
      setError(err.message || "Failed to load wallet with passkey");
      toast({
        title: "Import failed",
        description: err.message || "No wallet found for this passkey",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Unlock existing passkey wallet
  const handlePasskeyUnlock = async () => {
    if (!existingPasskeyWallet) return;

    setIsLoading(true);
    setError(null);
    try {
      // Authenticate with passkey
      const auth = await authenticatePasskey(existingPasskeyWallet.credentialId);
      if (!auth) {
        throw new Error("Passkey authentication failed");
      }

      // Recover salt
      const salt = new Uint8Array(base64ToArrayBuffer(existingPasskeyWallet.salt));
      
      // Decrypt the wallet key using credential ID
      const walletKey = await decryptWalletKey(
        existingPasskeyWallet.encryptedWalletKey,
        auth.credential.rawId,
        salt
      );

      // Decrypt the secret key with wallet key
      const secretKey = await decryptWithWalletKey(
        existingPasskeyWallet.encryptedSecretKey,
        walletKey
      );

      let encryptedSeedPhrase = '';
      if (existingPasskeyWallet.encryptedSeedPhrase) {
        // Decrypt from passkey storage, then re-encrypt with session AES for consistent handling
        const plaintextSeed = await decryptWithWalletKey(
          existingPasskeyWallet.encryptedSeedPhrase,
          walletKey
        );
        encryptedSeedPhrase = await encrypt(plaintextSeed);
      }

      const walletData: WalletData = {
        publicKey: existingPasskeyWallet.publicKey,
        secretKey,
        encryptedSeedPhrase,
        createdAt: existingPasskeyWallet.createdAt,
        passkeyEnabled: true,
        passkeyCredentialId: existingPasskeyWallet.credentialId,
      };

      toast({
        title: "Wallet unlocked!",
        description: `Welcome back!`,
      });
      onWalletCreated(walletData);
    } catch (err: any) {
      console.error("Passkey unlock failed:", err);
      setError(err.message || "Failed to unlock wallet");
      toast({
        title: "Unlock failed",
        description: "Could not authenticate. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-royal-navy via-background to-royal-navy-light" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-float" style={{ animationDelay: "-3s" }} />

      <div className="relative z-10 w-full max-w-md">
        {step === "welcome" && (
          <div className="glass-card p-8 text-center animate-scale-in">
            <div className="flex justify-center mb-6 animate-float">
              <CrownIcon size={72} />
            </div>
            <h1 className="text-3xl font-display font-bold text-gradient-gold mb-2">
              Royal Wallet
            </h1>
            <p className="text-muted-foreground mb-2">
              Your secure gateway to the Solana kingdom
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-primary mb-6">
              <Globe className="w-4 h-4" />
              <span>Connected to Solana Network</span>
            </div>

            {/* Passkey unlock for existing wallet */}
            {existingPasskeyWallet && (
              <div className="mb-6">
                <Button
                  variant="royal"
                  size="xl"
                  className="w-full mb-3"
                  onClick={handlePasskeyUnlock}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Fingerprint className="w-5 h-5" />
                  )}
                  Unlock with Passkey
                </Button>
                <p className="text-xs text-muted-foreground">
                  {existingPasskeyWallet.publicKey.slice(0, 8)}...{existingPasskeyWallet.publicKey.slice(-4)}
                </p>
              </div>
            )}

            {existingPasskeyWallet && (
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-2 text-muted-foreground">or create new</span>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {/* Passkey options - only show if supported */}
              {passkeySupported && (
                <>
                  <Button
                    variant={existingPasskeyWallet ? "glass" : "royal"}
                    size="lg"
                    className="w-full"
                    onClick={() => setStep("passkey-create")}
                  >
                    <Fingerprint className="w-5 h-5" />
                    Create with Passkey
                  </Button>
                  <Button
                    variant="glass"
                    size="lg"
                    className="w-full"
                    onClick={() => setStep("passkey-import")}
                  >
                    <Fingerprint className="w-5 h-5" />
                    Load with Passkey
                  </Button>
                </>
              )}

              {/* Security Key (YubiKey) option - show if supported */}
              {securityKeySupported && (
                <Button
                  variant="glass"
                  size="lg"
                  className="w-full"
                  onClick={handleSecurityKeyCreate}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <KeyRound className="w-5 h-5" />
                  )}
                  Create with YubiKey
                </Button>
              )}
              
              {(passkeySupported || securityKeySupported) && (
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-background px-2 text-muted-foreground">or use seed phrase</span>
                  </div>
                </div>
              )}

              <Button
                variant={passkeySupported || securityKeySupported ? "outline" : "royal"}
                size="lg"
                className="w-full"
                onClick={handleCreateWallet}
              >
                <Key className="w-5 h-5" />
                Create with Seed Phrase
              </Button>

              <Button
                variant="ghost"
                size="lg"
                className="w-full"
                onClick={() => setStep("import")}
              >
                <Import className="w-5 h-5" />
                Import with Seed Phrase
              </Button>
            </div>

            <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Shield className="w-4 h-4 text-accent" />
              <span>Military-grade encryption</span>
            </div>
          </div>
        )}

        {step === "passkey-create" && (
          <div className="glass-card p-8 animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
              <Fingerprint className="w-10 h-10 text-primary" />
              <div>
                <h2 className="text-xl font-display font-bold text-foreground">
                  Create Passkey Wallet
                </h2>
                <p className="text-sm text-muted-foreground">
                  Use biometrics to secure your wallet
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-primary/10 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">No seed phrase needed</p>
                    <p className="text-sm text-muted-foreground">
                      Your wallet is secured by your device's biometrics (Face ID, Touch ID, or PIN)
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-secondary/30 rounded-xl p-4">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Important:</strong> Your passkey is tied to this device. 
                  If you lose access, you'll need to create a new wallet.
                </p>
              </div>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 mb-4">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setStep("welcome")}>
                Back
              </Button>
              <Button
                variant="royal"
                className="flex-1"
                onClick={handlePasskeyCreate}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-4 h-4" />
                    Create Wallet
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "passkey-import" && (
          <div className="glass-card p-8 animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
              <Fingerprint className="w-10 h-10 text-primary" />
              <div>
                <h2 className="text-xl font-display font-bold text-foreground">
                  Load with Passkey
                </h2>
                <p className="text-sm text-muted-foreground">
                  Access your wallet using biometrics
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-primary/10 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Seedless Access</p>
                    <p className="text-sm text-muted-foreground">
                      Use your synced passkey (iCloud Keychain, Google Password Manager) to access your wallet on this device.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-secondary/30 rounded-xl p-4">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Note:</strong> Your passkey must have been created on a device that syncs with this one.
                </p>
              </div>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 mb-4">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setStep("welcome");
                  setError(null);
                }}
              >
                Back
              </Button>
              <Button
                variant="royal"
                className="flex-1"
                onClick={handlePasskeyImport}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-4 h-4" />
                    Load Wallet
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "create" && (
          <div className="glass-card p-8 animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
              <CrownIcon size={36} />
              <div>
                <h2 className="text-xl font-display font-bold text-foreground">
                  Your Seed Phrase
                </h2>
                <p className="text-sm text-muted-foreground">
                  Write these words down and keep them safe
                </p>
              </div>
            </div>

            <div className="bg-secondary/50 rounded-xl p-4 mb-4 relative">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">
                  24-word recovery phrase
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPhrase(!showPhrase)}
                    className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                  >
                    {showPhrase ? (
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  <button
                    onClick={handleCopyPhrase}
                    className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {seedPhrase.split(" ").map((word, index) => (
                  <div
                    key={index}
                    className="bg-background/50 rounded-lg px-2 py-1.5 text-sm flex items-center gap-1"
                  >
                    <span className="text-muted-foreground text-xs w-5">
                      {index + 1}.
                    </span>
                    <span className={showPhrase ? "text-foreground" : "blur-sm select-none"}>
                      {word}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 mb-6">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-destructive mb-1">
                    Never share your seed phrase!
                  </p>
                  <p className="text-muted-foreground">
                    Anyone with this phrase can access your funds. Store it securely offline.
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 mb-4">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <label className="flex items-center gap-3 mb-6 cursor-pointer group">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="w-5 h-5 rounded border-border bg-secondary accent-primary"
              />
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                I have saved my seed phrase securely
              </span>
            </label>

            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => setStep("welcome")}
              >
                Back
              </Button>
              <Button
                variant="royal"
                className="flex-1"
                onClick={handleConfirmCreate}
                disabled={isLoading || !confirmed}
              >
                {isLoading ? "Creating Wallet..." : "Continue"}
              </Button>
            </div>
          </div>
        )}

        {step === "import" && (
          <div className="glass-card p-8 animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
              <CrownIcon size={36} />
              <div>
                <h2 className="text-xl font-display font-bold text-foreground">
                  Import Wallet
                </h2>
                <p className="text-sm text-muted-foreground">
                  Enter your 12 or 24 word seed phrase
                </p>
              </div>
            </div>

            <div className="mb-4">
              <textarea
                value={importPhrase}
                onChange={(e) => setImportPhrase(e.target.value)}
                placeholder="Enter your seed phrase, separated by spaces..."
                className="w-full h-32 bg-secondary/50 border border-border rounded-xl p-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Words: {importPhrase.trim() ? importPhrase.trim().split(/\s+/).length : 0} (12 or 24 required)
              </p>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 mb-4">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setStep("welcome");
                  setImportPhrase("");
                  setError(null);
                }}
              >
                Back
              </Button>
              <Button
                variant="royal"
                className="flex-1"
                onClick={handleImportWallet}
                disabled={isLoading || !importPhrase.trim()}
              >
                {isLoading ? "Importing..." : "Import Wallet"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
