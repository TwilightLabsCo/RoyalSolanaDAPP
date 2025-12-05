import { useState, useEffect } from "react";
import { WalletSetup } from "@/components/WalletSetup";
import { Dashboard } from "@/components/Dashboard";
import { loadWallet, WalletData } from "@/lib/wallet";
import { CrownIcon } from "@/components/CrownIcon";

const Index = () => {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initWallet = async () => {
      const savedWallet = await loadWallet();
      setWallet(savedWallet);
      setIsLoading(false);
    };
    initWallet();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-royal-navy via-background to-royal-navy-light" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <CrownIcon size={64} className="animate-float" />
          <div className="w-48 h-1 bg-secondary rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-gradient-to-r from-royal-blue to-royal-gold animate-shimmer" />
          </div>
          <p className="text-muted-foreground text-sm">Loading Royal Wallet...</p>
        </div>
      </div>
    );
  }

  if (!wallet) {
    return <WalletSetup onWalletCreated={setWallet} />;
  }

  return <Dashboard wallet={wallet} onLogout={() => setWallet(null)} />;
};

export default Index;
