import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Landmark, TrendingUp, Clock, Shield, Award, Plus, Loader2, ExternalLink, RefreshCw, XCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { WalletData, getKeypairFromWallet } from "@/lib/wallet";
import {
  ValidatorInfo,
  StakeAccountInfo,
  fetchValidators,
  fetchStakeAccounts,
  createStakeAccount,
  deactivateStake,
  withdrawStake,
  formatStake,
} from "@/lib/staking";
import { getCurrentNetwork } from "@/lib/solana";

interface StakingPanelProps {
  wallet: WalletData;
  balance: number;
  onSuccess?: () => void;
}

export function StakingPanel({ wallet, balance, onSuccess }: StakingPanelProps) {
  const [stakeAmount, setStakeAmount] = useState("");
  const [selectedValidator, setSelectedValidator] = useState<string | null>(null);
  const [isStaking, setIsStaking] = useState(false);
  const [validators, setValidators] = useState<ValidatorInfo[]>([]);
  const [stakeAccounts, setStakeAccounts] = useState<StakeAccountInfo[]>([]);
  const [isLoadingValidators, setIsLoadingValidators] = useState(true);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [processingAccount, setProcessingAccount] = useState<string | null>(null);

  const network = getCurrentNetwork();

  const loadData = async () => {
    setIsLoadingValidators(true);
    setIsLoadingAccounts(true);
    
    try {
      const [validatorList, accounts] = await Promise.all([
        fetchValidators(),
        fetchStakeAccounts(wallet.publicKey),
      ]);
      
      setValidators(validatorList);
      setStakeAccounts(accounts);
    } catch (error) {
      console.error('Failed to load staking data:', error);
    } finally {
      setIsLoadingValidators(false);
      setIsLoadingAccounts(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [wallet.publicKey, network]);

  const totalStaked = stakeAccounts.reduce((sum, acc) => sum + acc.lamports, 0) / 1e9;
  const activeStake = stakeAccounts
    .filter((a) => a.state === 'active' || a.state === 'activating')
    .reduce((sum, acc) => sum + acc.lamports, 0) / 1e9;

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

    if (amount > balance - 0.01) { // Keep some SOL for fees
      toast({
        title: "Insufficient balance",
        description: "Keep at least 0.01 SOL for transaction fees",
        variant: "destructive",
      });
      return;
    }

    if (!selectedValidator) {
      toast({
        title: "Select a validator",
        description: "Please choose a validator to stake with",
        variant: "destructive",
      });
      return;
    }

    setIsStaking(true);
    try {
      const keypair = getKeypairFromWallet(wallet);
      const signature = await createStakeAccount(keypair, selectedValidator, amount);
      
      toast({
        title: "Staked successfully!",
        description: (
          <a 
            href={`https://solscan.io/tx/${signature}?cluster=${network}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline"
          >
            View on Solscan <ExternalLink className="w-3 h-3" />
          </a>
        ),
      });
      
      setStakeAmount("");
      setSelectedValidator(null);
      onSuccess?.();
      loadData();
    } catch (error: any) {
      toast({
        title: "Staking failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsStaking(false);
    }
  };

  const handleDeactivate = async (accountPubkey: string) => {
    setProcessingAccount(accountPubkey);
    try {
      const keypair = getKeypairFromWallet(wallet);
      const signature = await deactivateStake(keypair, accountPubkey);
      
      toast({
        title: "Unstaking initiated",
        description: "Your stake will be available to withdraw after 2-3 days",
      });
      
      loadData();
    } catch (error: any) {
      toast({
        title: "Deactivation failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setProcessingAccount(null);
    }
  };

  const handleWithdraw = async (accountPubkey: string) => {
    setProcessingAccount(accountPubkey);
    try {
      const keypair = getKeypairFromWallet(wallet);
      const signature = await withdrawStake(keypair, accountPubkey);
      
      toast({
        title: "Stake withdrawn!",
        description: "SOL has been returned to your wallet",
      });
      
      onSuccess?.();
      loadData();
    } catch (error: any) {
      toast({
        title: "Withdrawal failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setProcessingAccount(null);
    }
  };

  const getValidatorName = (votePubkey: string) => {
    return `${votePubkey.slice(0, 4)}...${votePubkey.slice(-4)}`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Staking Overview */}
      <div className="glass-card p-6 glow-soft">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-display font-semibold text-foreground">
              Staking Overview
            </h2>
          </div>
          <Button variant="ghost" size="sm" onClick={loadData}>
            <RefreshCw className={`w-4 h-4 ${isLoadingAccounts ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-secondary/30 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{totalStaked.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">SOL Staked</p>
          </div>
          <div className="bg-secondary/30 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-500">{activeStake.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Active Stake</p>
          </div>
          <div className="bg-secondary/30 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-accent">~7%</p>
            <p className="text-xs text-muted-foreground">Est. APY</p>
          </div>
        </div>

        {/* Existing Stake Accounts */}
        {stakeAccounts.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-sm font-medium text-muted-foreground">Your Stake Accounts</p>
            {stakeAccounts.map((account) => (
              <div
                key={account.pubkey}
                className="bg-secondary/20 rounded-xl p-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {(account.lamports / 1e9).toFixed(4)} SOL
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      account.state === 'active' ? 'bg-green-500/20 text-green-500' :
                      account.state === 'activating' ? 'bg-yellow-500/20 text-yellow-500' :
                      account.state === 'deactivating' ? 'bg-orange-500/20 text-orange-500' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {account.state}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {getValidatorName(account.validator)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {account.state === 'active' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeactivate(account.pubkey)}
                      disabled={processingAccount === account.pubkey}
                    >
                      {processingAccount === account.pubkey ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        "Unstake"
                      )}
                    </Button>
                  )}
                  {account.state === 'inactive' && (
                    <Button
                      variant="gold"
                      size="sm"
                      onClick={() => handleWithdraw(account.pubkey)}
                      disabled={processingAccount === account.pubkey}
                    >
                      {processingAccount === account.pubkey ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        "Withdraw"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
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
              onClick={() => setStakeAmount(Math.max(0, balance - 0.01).toString())}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary hover:text-primary/80 font-medium"
            >
              MAX
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Available: {balance.toFixed(4)} SOL
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm text-muted-foreground mb-2">
            Select Validator ({validators.length} available)
          </label>
          
          {isLoadingValidators ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {validators.map((validator) => (
                <button
                  key={validator.votePubkey}
                  onClick={() => setSelectedValidator(validator.votePubkey)}
                  className={`w-full p-4 rounded-xl text-left transition-all ${
                    selectedValidator === validator.votePubkey
                      ? "bg-primary/20 border-2 border-primary"
                      : "bg-secondary/30 border-2 border-transparent hover:bg-secondary/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {getValidatorName(validator.votePubkey)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Commission: {validator.commission}% • Stake: {formatStake(validator.activatedStake)} SOL
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-lg font-bold text-green-500">
                        {validator.apy?.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground">APY</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          variant="royal"
          size="lg"
          className="w-full"
          onClick={handleStake}
          disabled={isStaking || !selectedValidator || !stakeAmount}
        >
          {isStaking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
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
