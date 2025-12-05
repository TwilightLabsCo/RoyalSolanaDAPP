import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CrownIcon } from "./CrownIcon";
import { generateSeedPhrase, validateSeedPhrase, createWallet, WalletData } from "@/lib/wallet";
import { Shield, Key, Import, Eye, EyeOff, Copy, Check, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface WalletSetupProps {
  onWalletCreated: (wallet: WalletData) => void;
}

type SetupStep = "welcome" | "create" | "import" | "confirm" | "complete";

export function WalletSetup({ onWalletCreated }: WalletSetupProps) {
  const [step, setStep] = useState<SetupStep>("welcome");
  const [seedPhrase, setSeedPhrase] = useState("");
  const [importPhrase, setImportPhrase] = useState("");
  const [showPhrase, setShowPhrase] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateWallet = () => {
    const phrase = generateSeedPhrase();
    setSeedPhrase(phrase);
    setStep("create");
  };

  const handleCopyPhrase = async () => {
    await navigator.clipboard.writeText(seedPhrase);
    setCopied(true);
    toast({ title: "Copied!", description: "Seed phrase copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
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
    try {
      const wallet = await createWallet(seedPhrase);
      onWalletCreated(wallet);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create wallet",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportWallet = async () => {
    const trimmed = importPhrase.trim().toLowerCase();
    if (!validateSeedPhrase(trimmed)) {
      toast({
        title: "Invalid seed phrase",
        description: "Please enter a valid 12 or 24 word seed phrase",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    try {
      const wallet = await createWallet(trimmed);
      onWalletCreated(wallet);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to import wallet",
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
            <p className="text-muted-foreground mb-8">
              Your secure gateway to the Solana kingdom
            </p>

            <div className="space-y-4">
              <Button
                variant="royal"
                size="xl"
                className="w-full"
                onClick={handleCreateWallet}
              >
                <Key className="w-5 h-5" />
                Create New Wallet
              </Button>

              <Button
                variant="glass"
                size="lg"
                className="w-full"
                onClick={() => setStep("import")}
              >
                <Import className="w-5 h-5" />
                Import Existing Wallet
              </Button>
            </div>

            <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Shield className="w-4 h-4 text-accent" />
              <span>Military-grade encryption</span>
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
                disabled={isLoading}
              >
                {isLoading ? "Creating..." : "Continue"}
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

            <div className="mb-6">
              <textarea
                value={importPhrase}
                onChange={(e) => setImportPhrase(e.target.value)}
                placeholder="Enter your seed phrase, separated by spaces..."
                className="w-full h-32 bg-secondary/50 border border-border rounded-xl p-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              />
            </div>

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
