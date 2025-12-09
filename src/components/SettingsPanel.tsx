import { useState } from "react";
import { Button } from "@/components/ui/button";
import { WalletData, updateWallet } from "@/lib/wallet";
import { 
  isPasskeySupported, 
  createPasskeyWallet, 
  encryptWalletKey,
  encryptWithWalletKey,
  savePasskeyWallet,
  arrayBufferToBase64,
  StoredPasskeyWallet,
  deletePasskeyWallet,
} from "@/lib/passkey";
import {
  Key,
  Shield,
  Fingerprint,
  Eye,
  EyeOff,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
  Smartphone,
  Lock,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface SettingsPanelProps {
  wallet: WalletData;
  onLogout: () => void;
}

export function SettingsPanel({ wallet, onLogout }: SettingsPanelProps) {
  const [showSeedPhrase, setShowSeedPhrase] = useState(false);
  const [seedPhraseRevealed, setSeedPhraseRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [passkeyEnabled, setPasskeyEnabled] = useState(wallet.passkeyEnabled);
  const [isSettingUpPasskey, setIsSettingUpPasskey] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleRevealSeedPhrase = () => {
    if (!seedPhraseRevealed) {
      toast({
        title: "Security Warning",
        description: "Never share your seed phrase with anyone!",
        variant: "destructive",
      });
    }
    setSeedPhraseRevealed(true);
    setShowSeedPhrase(!showSeedPhrase);
  };

  const handleCopySeedPhrase = async () => {
    await navigator.clipboard.writeText(wallet.encryptedSeedPhrase);
    setCopied(true);
    toast({ title: "Copied!", description: "Seed phrase copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSetupPasskey = async () => {
    const supported = await isPasskeySupported();
    if (!supported) {
      toast({
        title: "Not supported",
        description: "Your device doesn't support passkeys",
        variant: "destructive",
      });
      return;
    }

    setIsSettingUpPasskey(true);
    try {
      // Create a new passkey credential with wallet key
      const result = await createPasskeyWallet();
      if (!result) {
        toast({
          title: "Setup cancelled",
          description: "Passkey setup was cancelled",
          variant: "destructive",
        });
        return;
      }

      const { credential, walletKey, salt } = result;

      // Encrypt the wallet key with credential-derived key
      const encryptedWalletKey = await encryptWalletKey(
        walletKey,
        credential.rawId,
        salt
      );

      // Encrypt wallet data with wallet key
      const encryptedSecretKey = await encryptWithWalletKey(wallet.secretKey, walletKey);
      const encryptedSeedPhrase = wallet.encryptedSeedPhrase 
        ? await encryptWithWalletKey(wallet.encryptedSeedPhrase, walletKey)
        : undefined;

      // Save passkey wallet data
      const passkeyWallet: StoredPasskeyWallet = {
        credentialId: credential.id,
        publicKey: wallet.publicKey,
        encryptedWalletKey,
        encryptedSecretKey,
        encryptedSeedPhrase,
        salt: arrayBufferToBase64(salt.buffer),
        createdAt: Date.now(),
      };
      savePasskeyWallet(passkeyWallet);

      const credentialId = credential.id;
      await updateWallet({
        passkeyEnabled: true,
        passkeyCredentialId: credentialId,
      });
      setPasskeyEnabled(true);
      toast({
        title: "Passkey enabled!",
        description: "You can now use biometrics to authenticate",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to set up passkey",
        variant: "destructive",
      });
    } finally {
      setIsSettingUpPasskey(false);
    }
  };

  const handleDeleteWallet = () => {
    deletePasskeyWallet();
    onLogout();
    toast({
      title: "Wallet deleted",
      description: "Your wallet has been removed from this device",
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Security Settings */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-display font-semibold text-foreground">
            Security
          </h2>
        </div>

        <div className="space-y-4">
          {/* Passkey Setup */}
          <div className="bg-secondary/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Fingerprint className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Passkey Authentication</p>
                  <p className="text-xs text-muted-foreground">
                    Use Face ID, Touch ID, or security key
                  </p>
                </div>
              </div>
              {passkeyEnabled ? (
                <span className="px-3 py-1 bg-green-500/20 text-green-500 text-xs font-medium rounded-full">
                  Enabled
                </span>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSetupPasskey}
                  disabled={isSettingUpPasskey}
                >
                  {isSettingUpPasskey ? "Setting up..." : "Enable"}
                </Button>
              )}
            </div>
            <div className="flex gap-2 mt-3">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Smartphone className="w-3 h-3" />
                iOS/Android
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="w-3 h-3" />
                Hardware keys
              </div>
            </div>
          </div>

          {/* Seed Phrase */}
          {wallet.encryptedSeedPhrase && (
            <div className="bg-secondary/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                    <Key className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Recovery Phrase</p>
                    <p className="text-xs text-muted-foreground">
                      Export your seed phrase
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRevealSeedPhrase}
                  >
                    {showSeedPhrase ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                  {showSeedPhrase && (
                    <Button variant="ghost" size="sm" onClick={handleCopySeedPhrase}>
                      {copied ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {showSeedPhrase && (
                <div className="bg-background/50 rounded-xl p-3 mt-3">
                  <div className="grid grid-cols-3 gap-2">
                    {wallet.encryptedSeedPhrase.split(" ").map((word, index) => (
                      <div
                        key={index}
                        className="bg-secondary/50 rounded-lg px-2 py-1.5 text-sm flex items-center gap-1"
                      >
                        <span className="text-muted-foreground text-xs w-5">
                          {index + 1}.
                        </span>
                        <span className="text-foreground">{word}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Passkey-only wallet notice */}
          {!wallet.encryptedSeedPhrase && (
            <div className="bg-primary/10 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Fingerprint className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Passkey-Only Wallet</p>
                  <p className="text-xs text-muted-foreground">
                    This wallet was created with a passkey and has no seed phrase.
                    Your passkey is tied to this device.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="glass-card p-6 border-destructive/30">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <h2 className="text-lg font-display font-semibold text-destructive">
            Danger Zone
          </h2>
        </div>

        {!showDeleteConfirm ? (
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="w-4 h-4" />
            Delete Wallet
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Are you sure? This will remove your wallet from this device.
              {wallet.encryptedSeedPhrase && " Make sure you have saved your seed phrase!"}
            </p>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDeleteWallet}
              >
                Yes, Delete
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-display font-semibold text-foreground mb-4">
          About Royal Wallet
        </h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Version 1.0.0</p>
          <p>Built with encryption and security in mind.</p>
          <p className="text-xs">
            Your wallet data is encrypted and stored locally.
            We never have access to your private keys.
          </p>
        </div>
      </div>
    </div>
  );
}