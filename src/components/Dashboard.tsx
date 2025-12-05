import { useState } from "react";
import { WalletData, formatPublicKey, formatBalance, deleteWallet } from "@/lib/wallet";
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
  Shield,
  QrCode,
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { SendModal } from "./SendModal";
import { ReceiveModal } from "./ReceiveModal";
import { StakingPanel } from "./StakingPanel";
import { SettingsPanel } from "./SettingsPanel";

interface DashboardProps {
  wallet: WalletData;
  onLogout: () => void;
}

type Tab = "wallet" | "staking" | "settings";

export function Dashboard({ wallet, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>("wallet");
  const [copied, setCopied] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showReceive, setShowReceive] = useState(false);

  // Mock balance data
  const balance = 12.45678;
  const usdValue = balance * 145.32;
  const stakedAmount = 5.5;
  const rewards = 0.0234;

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

  const transactions = [
    { type: "received", amount: 2.5, from: "9xK2...4mPq", time: "2 hours ago" },
    { type: "sent", amount: 1.2, to: "7hJ3...8nRs", time: "5 hours ago" },
    { type: "staked", amount: 5.5, time: "1 day ago" },
    { type: "received", amount: 0.5, from: "3pL9...2kWx", time: "2 days ago" },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-royal-navy via-background to-royal-navy-light" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-4xl mx-auto p-4 md:p-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
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

          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="w-5 h-5" />
          </Button>
        </header>

        {/* Navigation Tabs */}
        <nav className="flex gap-2 mb-6">
          {[
            { id: "wallet", icon: Wallet, label: "Wallet" },
            { id: "staking", icon: Landmark, label: "Staking" },
            { id: "settings", icon: Settings, label: "Settings" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 ${
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
            {/* Balance Card */}
            <div className="glass-card p-6 glow-soft">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">Total Balance</span>
                <div className="flex items-center gap-1 text-green-500 text-sm">
                  <TrendingUp className="w-4 h-4" />
                  +5.2%
                </div>
              </div>

              <div className="mb-6">
                <h2 className="text-4xl font-bold text-foreground mb-1">
                  {formatBalance(balance * 1_000_000_000)} <span className="text-xl text-muted-foreground">SOL</span>
                </h2>
                <p className="text-lg text-muted-foreground">
                  ≈ ${usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="royal"
                  className="flex-1"
                  onClick={() => setShowSend(true)}
                >
                  <Send className="w-4 h-4" />
                  Send
                </Button>
                <Button
                  variant="glass"
                  className="flex-1"
                  onClick={() => setShowReceive(true)}
                >
                  <Download className="w-4 h-4" />
                  Receive
                </Button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Landmark className="w-4 h-4 text-accent" />
                  <span className="text-sm text-muted-foreground">Staked</span>
                </div>
                <p className="text-xl font-bold text-foreground">{stakedAmount} SOL</p>
              </div>
              <div className="glass-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">Rewards</span>
                </div>
                <p className="text-xl font-bold text-foreground">{rewards} SOL</p>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-display font-semibold text-foreground mb-4">
                Recent Activity
              </h3>
              <div className="space-y-3">
                {transactions.map((tx, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          tx.type === "received"
                            ? "bg-green-500/20 text-green-500"
                            : tx.type === "sent"
                            ? "bg-red-500/20 text-red-500"
                            : "bg-accent/20 text-accent"
                        }`}
                      >
                        {tx.type === "received" ? (
                          <ArrowDownLeft className="w-5 h-5" />
                        ) : tx.type === "sent" ? (
                          <ArrowUpRight className="w-5 h-5" />
                        ) : (
                          <Landmark className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-foreground capitalize">
                          {tx.type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {tx.from || tx.to || "Staking Pool"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-medium ${
                          tx.type === "received"
                            ? "text-green-500"
                            : tx.type === "sent"
                            ? "text-red-500"
                            : "text-accent"
                        }`}
                      >
                        {tx.type === "received" ? "+" : "-"}{tx.amount} SOL
                      </p>
                      <p className="text-xs text-muted-foreground">{tx.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "staking" && (
          <StakingPanel balance={balance} stakedAmount={stakedAmount} rewards={rewards} />
        )}

        {activeTab === "settings" && (
          <SettingsPanel wallet={wallet} onLogout={handleLogout} />
        )}
      </div>

      {/* Modals */}
      {showSend && <SendModal onClose={() => setShowSend(false)} balance={balance} />}
      {showReceive && <ReceiveModal onClose={() => setShowReceive(false)} publicKey={wallet.publicKey} />}
    </div>
  );
}
