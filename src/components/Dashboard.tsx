import { useState, useEffect } from "react";
import { WalletData, formatPublicKey, formatBalance, deleteWallet, getKeypairFromWallet } from "@/lib/wallet";
import { getBalance, getSolPrice, getCurrentNetwork, switchNetwork, NetworkType, requestAirdrop } from "@/lib/solana";
import { CrownIcon } from "./CrownIcon";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  Send,
  Download,
  Landmark,
  Settings,
  Copy,
  Check,
  LogOut,
  QrCode,
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp,
  Shield,
  PieChart,
  RefreshCw,
  Droplets,
  Globe,
  ArrowLeftRight,
  Image,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { SendModal } from "./SendModal";
import { ReceiveModal } from "./ReceiveModal";
import { StakingPanel } from "./StakingPanel";
import { SettingsPanel } from "./SettingsPanel";
import { CreditScoreVisualizer } from "./CreditScoreVisualizer";
import { PortfolioDashboard } from "./PortfolioDashboard";
import { SwapPanel } from "./SwapPanel";
import { NFTGallery } from "./NFTGallery";

interface DashboardProps {
  wallet: WalletData;
  onLogout: () => void;
}

type Tab = "wallet" | "swap" | "portfolio" | "credit" | "nfts" | "staking" | "settings";

export function Dashboard({ wallet, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>("wallet");
  const [copied, setCopied] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [balance, setBalance] = useState(0);
  const [solPrice, setSolPrice] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isAirdropping, setIsAirdropping] = useState(false);
  const [network, setNetwork] = useState<NetworkType>(getCurrentNetwork());

  const fetchBalance = async () => {
    setIsLoading(true);
    try {
      const [bal, price] = await Promise.all([
        getBalance(wallet.publicKey),
        getSolPrice(),
      ]);
      setBalance(bal);
      setSolPrice(price);
    } catch (error) {
      console.error("Failed to fetch balance:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [wallet.publicKey, network]);

  const handleCopyAddress = async () => {
    await navigator.clipboard.writeText(wallet.publicKey);
    setCopied(true);
    toast({ title: "Copied!", description: "Address copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = () => {
    deleteWallet();
    onLogout();
    toast({ title: "Logged out", description: "Wallet disconnected" });
  };

  const handleNetworkChange = (newNetwork: NetworkType) => {
    switchNetwork(newNetwork);
    setNetwork(newNetwork);
    toast({ title: "Network changed", description: `Switched to ${newNetwork}` });
    fetchBalance();
  };

  const handleAirdrop = async () => {
    if (network === "mainnet") {
      toast({
        title: "Not available",
        description: "Airdrops only available on devnet/testnet",
        variant: "destructive",
      });
      return;
    }

    setIsAirdropping(true);
    try {
      await requestAirdrop(wallet.publicKey, 1);
      toast({ title: "Airdrop successful!", description: "1 SOL has been added" });
      fetchBalance();
    } catch (error) {
      toast({
        title: "Airdrop failed",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsAirdropping(false);
    }
  };

  const solBalance = balance / 1_000_000_000;
  const usdValue = solBalance * solPrice;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-royal-navy via-background to-royal-navy-light" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-4xl mx-auto p-4 md:p-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <CrownIcon size={40} className="animate-float" />
            <div>
              <h1 className="text-xl font-display font-bold text-gradient-gold">
                Royal Wallet
              </h1>
              <button
                onClick={handleCopyAddress}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {formatPublicKey(wallet.publicKey)}
                {copied ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Network Selector */}
            <select
              value={network}
              onChange={(e) => handleNetworkChange(e.target.value as NetworkType)}
              className="bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="devnet">Devnet</option>
              <option value="testnet">Testnet</option>
              <option value="mainnet">Mainnet</option>
            </select>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </header>

        {/* Navigation Tabs */}
        <nav className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: "wallet", icon: Wallet, label: "Wallet" },
            { id: "swap", icon: ArrowLeftRight, label: "Swap" },
            { id: "portfolio", icon: PieChart, label: "Portfolio" },
            { id: "nfts", icon: Image, label: "NFTs" },
            { id: "credit", icon: Shield, label: "Credit Score" },
            { id: "staking", icon: Landmark, label: "Staking" },
            { id: "settings", icon: Settings, label: "Settings" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Main Content */}
        {activeTab === "wallet" && (
          <div className="space-y-6 animate-fade-in">
            {/* Network Status */}
            <div className="flex items-center gap-2 text-sm">
              <Globe className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">Connected to</span>
              <span className={`font-medium ${network === 'mainnet' ? 'text-green-500' : 'text-yellow-500'}`}>
                {network.charAt(0).toUpperCase() + network.slice(1)}
              </span>
            </div>

            {/* Balance Card */}
            <div className="glass-card p-6 glow-soft">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">Total Balance</span>
                <Button variant="ghost" size="sm" onClick={fetchBalance} disabled={isLoading}>
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              <div className="mb-6">
                <h2 className="text-4xl font-bold text-foreground mb-1">
                  {isLoading ? (
                    <span className="text-muted-foreground">Loading...</span>
                  ) : (
                    <>
                      {formatBalance(balance)} <span className="text-xl text-muted-foreground">SOL</span>
                    </>
                  )}
                </h2>
                <p className="text-lg text-muted-foreground">
                  ≈ ${usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  1 SOL = ${solPrice.toFixed(2)}
                </p>
              </div>

              <div className="flex gap-3 flex-wrap">
                <Button
                  variant="royal"
                  className="flex-1 min-w-[120px]"
                  onClick={() => setShowSend(true)}
                >
                  <Send className="w-4 h-4" />
                  Send
                </Button>
                <Button
                  variant="glass"
                  className="flex-1 min-w-[120px]"
                  onClick={() => setShowReceive(true)}
                >
                  <Download className="w-4 h-4" />
                  Receive
                </Button>
                {network !== "mainnet" && (
                  <Button
                    variant="gold"
                    className="flex-1 min-w-[120px]"
                    onClick={handleAirdrop}
                    disabled={isAirdropping}
                  >
                    <Droplets className="w-4 h-4" />
                    {isAirdropping ? "Requesting..." : "Airdrop"}
                  </Button>
                )}
              </div>
            </div>

            {/* Quick Actions Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setActiveTab("portfolio")}
                className="glass-card p-4 text-left hover:border-primary/50 transition-colors"
              >
                <PieChart className="w-5 h-5 text-primary mb-2" />
                <p className="font-medium text-foreground">Portfolio</p>
                <p className="text-xs text-muted-foreground">View assets & risk</p>
              </button>
              <button
                onClick={() => setActiveTab("credit")}
                className="glass-card p-4 text-left hover:border-primary/50 transition-colors"
              >
                <Shield className="w-5 h-5 text-accent mb-2" />
                <p className="font-medium text-foreground">Credit Score</p>
                <p className="text-xs text-muted-foreground">On-chain reputation</p>
              </button>
              <button
                onClick={() => setActiveTab("staking")}
                className="glass-card p-4 text-left hover:border-primary/50 transition-colors"
              >
                <TrendingUp className="w-5 h-5 text-green-500 mb-2" />
                <p className="font-medium text-foreground">Stake SOL</p>
                <p className="text-xs text-muted-foreground">Earn ~7% APY</p>
              </button>
            </div>
          </div>
        )}

        {activeTab === "swap" && <SwapPanel wallet={wallet} onSuccess={fetchBalance} />}

        {activeTab === "portfolio" && <PortfolioDashboard wallet={wallet} />}

        {activeTab === "nfts" && <NFTGallery wallet={wallet} />}

        {activeTab === "credit" && <CreditScoreVisualizer wallet={wallet} />}

        {activeTab === "staking" && (
          <StakingPanel wallet={wallet} balance={solBalance} onSuccess={fetchBalance} />
        )}

        {activeTab === "settings" && (
          <SettingsPanel wallet={wallet} onLogout={handleLogout} />
        )}
      </div>

      {/* Modals */}
      {showSend && (
        <SendModal
          onClose={() => setShowSend(false)}
          balance={solBalance}
          wallet={wallet}
          onSuccess={fetchBalance}
        />
      )}
      {showReceive && <ReceiveModal onClose={() => setShowReceive(false)} publicKey={wallet.publicKey} />}
    </div>
  );
}
