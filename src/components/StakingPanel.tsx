import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Landmark, TrendingUp, Clock, Shield, Award, Plus, Minus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatBalance } from "@/lib/wallet";

interface StakingPanelProps {
  balance: number;
  stakedAmount: number;
  rewards: number;
}

const validators = [
  { name: "Royal Validator", apy: "7.2%", commission: "5%", stake: "2.5M SOL", status: "active" },
  { name: "Crown Stake Pool", apy: "6.8%", commission: "7%", stake: "1.8M SOL", status: "active" },
  { name: "Sovereign Node", apy: "7.0%", commission: "6%", stake: "3.2M SOL", status: "active" },
];

export function StakingPanel({ balance, stakedAmount, rewards }: StakingPanelProps) {
  const [stakeAmount, setStakeAmount] = useState("");
  const [selectedValidator, setSelectedValidator] = useState<number | null>(null);
  const [isStaking, setIsStaking] = useState(false);

  const handleStake = async () => {
    const amount = parseFloat(stakeAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount to stake",
        variant: "destructive",
      });
      return;
    }

    if (amount > balance - stakedAmount) {
      toast({
        title: "Insufficient balance",
        description: "You don't have enough unstaked SOL",
        variant: "destructive",
      });
      return;
    }

    if (selectedValidator === null) {
      toast({
        title: "Select a validator",
        description: "Please choose a validator to stake with",
        variant: "destructive",
      });
      return;
    }

    setIsStaking(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsStaking(false);

    toast({
      title: "Staked successfully!",
      description: `${amount} SOL staked with ${validators[selectedValidator].name}`,
    });
    setStakeAmount("");
    setSelectedValidator(null);
  };

  const handleClaimRewards = async () => {
    if (rewards <= 0) {
      toast({
        title: "No rewards",
        description: "You don't have any rewards to claim yet",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Rewards claimed!",
      description: `${rewards} SOL has been added to your balance`,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Staking Overview */}
      <div className="glass-card p-6 glow-soft">
        <div className="flex items-center gap-2 mb-4">
          <Landmark className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-display font-semibold text-foreground">
            Staking Overview
          </h2>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-secondary/30 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stakedAmount}</p>
            <p className="text-xs text-muted-foreground">SOL Staked</p>
          </div>
          <div className="bg-secondary/30 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-500">{rewards}</p>
            <p className="text-xs text-muted-foreground">SOL Rewards</p>
          </div>
          <div className="bg-secondary/30 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-accent">~7%</p>
            <p className="text-xs text-muted-foreground">Est. APY</p>
          </div>
        </div>

        <Button
          variant="gold"
          className="w-full"
          onClick={handleClaimRewards}
          disabled={rewards <= 0}
        >
          <Award className="w-4 h-4" />
          Claim {rewards} SOL Rewards
        </Button>
      </div>

      {/* Stake New SOL */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-display font-semibold text-foreground mb-4">
          Stake SOL
        </h3>

        <div className="mb-4">
          <label className="block text-sm text-muted-foreground mb-2">
            Amount to Stake
          </label>
          <div className="relative">
            <input
              type="number"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              placeholder="0.00"
              step="0.1"
              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <button
              onClick={() => setStakeAmount((balance - stakedAmount).toString())}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary hover:text-primary/80 font-medium"
            >
              MAX
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Available: {formatBalance((balance - stakedAmount) * 1_000_000_000)} SOL
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm text-muted-foreground mb-2">
            Select Validator
          </label>
          <div className="space-y-2">
            {validators.map((validator, index) => (
              <button
                key={index}
                onClick={() => setSelectedValidator(index)}
                className={`w-full p-4 rounded-xl text-left transition-all ${
                  selectedValidator === index
                    ? "bg-primary/20 border-2 border-primary"
                    : "bg-secondary/30 border-2 border-transparent hover:bg-secondary/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{validator.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Commission: {validator.commission} • Stake: {validator.stake}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-500">{validator.apy}</p>
                    <p className="text-xs text-muted-foreground">APY</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <Button
          variant="royal"
          size="lg"
          className="w-full"
          onClick={handleStake}
          disabled={isStaking}
        >
          {isStaking ? (
            "Processing..."
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Stake SOL
            </>
          )}
        </Button>
      </div>

      {/* Staking Info */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-display font-semibold text-foreground mb-4">
          Staking Information
        </h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-primary flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Secure & Decentralized</p>
              <p className="text-xs text-muted-foreground">
                Your SOL remains in your control while staked
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-green-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Earn Rewards</p>
              <p className="text-xs text-muted-foreground">
                Earn approximately 6-8% APY on staked SOL
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-accent flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Unstaking Period</p>
              <p className="text-xs text-muted-foreground">
                2-3 days cooldown period when unstaking
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
