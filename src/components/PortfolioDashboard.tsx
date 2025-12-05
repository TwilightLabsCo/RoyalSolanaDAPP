import { useState, useEffect } from "react";
import { WalletData, formatBalance } from "@/lib/wallet";
import {
  getBalance,
  getSolPrice,
  getTokenAccounts,
  TokenAccount,
  getStakeAccounts,
  StakeAccount,
} from "@/lib/solana";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PieChart,
  AlertTriangle,
  RefreshCw,
  DollarSign,
  Percent,
  Activity,
} from "lucide-react";
import { Button } from "./ui/button";

interface PortfolioDashboardProps {
  wallet: WalletData;
}

interface PortfolioData {
  solBalance: number;
  solPrice: number;
  tokens: TokenAccount[];
  stakeAccounts: StakeAccount[];
  totalValueUsd: number;
  stakedValue: number;
}

interface RiskMetrics {
  diversificationScore: number;
  concentrationRisk: 'Low' | 'Medium' | 'High';
  liquidityRatio: number;
  stakingRatio: number;
  overallRisk: 'Low' | 'Medium' | 'High';
}

export function PortfolioDashboard({ wallet }: PortfolioDashboardProps) {
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [priceChange24h] = useState(2.5); // Mock 24h change

  const fetchPortfolio = async () => {
    setIsLoading(true);
    try {
      const [balance, price, tokens, stakeAccounts] = await Promise.all([
        getBalance(wallet.publicKey),
        getSolPrice(),
        getTokenAccounts(wallet.publicKey),
        getStakeAccounts(wallet.publicKey),
      ]);

      const solBalance = balance / 1_000_000_000;
      const stakedValue = stakeAccounts.reduce((sum, acc) => sum + acc.lamports, 0) / 1_000_000_000;
      const totalValueUsd = (solBalance + stakedValue) * price;

      const portfolioData: PortfolioData = {
        solBalance,
        solPrice: price,
        tokens,
        stakeAccounts,
        totalValueUsd,
        stakedValue,
      };

      setPortfolio(portfolioData);
      setRiskMetrics(calculateRiskMetrics(portfolioData));
    } catch (error) {
      console.error("Failed to fetch portfolio:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateRiskMetrics = (data: PortfolioData): RiskMetrics => {
    const totalAssets = data.solBalance + data.stakedValue;
    const tokenCount = data.tokens.length + 1; // +1 for SOL

    // Diversification score (0-100)
    const diversificationScore = Math.min(tokenCount * 15, 100);

    // Concentration risk (how much is in single asset)
    const solConcentration = totalAssets > 0 ? data.solBalance / totalAssets : 1;
    const concentrationRisk: 'Low' | 'Medium' | 'High' =
      solConcentration > 0.9 ? 'High' : solConcentration > 0.7 ? 'Medium' : 'Low';

    // Liquidity ratio (unstaked / total)
    const liquidityRatio = totalAssets > 0 ? data.solBalance / totalAssets : 1;

    // Staking ratio
    const stakingRatio = totalAssets > 0 ? data.stakedValue / totalAssets : 0;

    // Overall risk assessment
    let overallRisk: 'Low' | 'Medium' | 'High';
    if (diversificationScore > 60 && liquidityRatio > 0.3 && stakingRatio > 0.2) {
      overallRisk = 'Low';
    } else if (diversificationScore > 30 || stakingRatio > 0.1) {
      overallRisk = 'Medium';
    } else {
      overallRisk = 'High';
    }

    return {
      diversificationScore,
      concentrationRisk,
      liquidityRatio,
      stakingRatio,
      overallRisk,
    };
  };

  useEffect(() => {
    fetchPortfolio();
  }, [wallet.publicKey]);

  if (isLoading) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
            <p className="text-muted-foreground">Loading portfolio data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!portfolio || !riskMetrics) {
    return (
      <div className="glass-card p-6">
        <p className="text-muted-foreground text-center">Unable to load portfolio</p>
      </div>
    );
  }

  const getRiskColor = (risk: 'Low' | 'Medium' | 'High') => {
    switch (risk) {
      case 'Low':
        return 'text-green-500';
      case 'Medium':
        return 'text-yellow-500';
      case 'High':
        return 'text-red-500';
    }
  };

  const getRiskBg = (risk: 'Low' | 'Medium' | 'High') => {
    switch (risk) {
      case 'Low':
        return 'bg-green-500/20';
      case 'Medium':
        return 'bg-yellow-500/20';
      case 'High':
        return 'bg-red-500/20';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Portfolio Value Card */}
      <div className="glass-card p-6 glow-soft">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-display font-semibold text-foreground">
              Portfolio Overview
            </h2>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchPortfolio}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-secondary/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-accent" />
              <span className="text-sm text-muted-foreground">Total Value</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              ${portfolio.totalValueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
            <div className={`flex items-center gap-1 text-sm ${priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {priceChange24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {priceChange24h >= 0 ? '+' : ''}{priceChange24h}% 24h
            </div>
          </div>

          <div className="bg-secondary/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">SOL Price</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              ${portfolio.solPrice.toFixed(2)}
            </p>
            <p className="text-sm text-muted-foreground">per SOL</p>
          </div>
        </div>

        {/* Asset Breakdown */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Assets</h3>
          
          {/* SOL */}
          <div className="flex items-center justify-between p-3 bg-secondary/20 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center">
                <span className="text-foreground font-bold text-sm">SOL</span>
              </div>
              <div>
                <p className="font-medium text-foreground">Solana</p>
                <p className="text-xs text-muted-foreground">Available</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-medium text-foreground">
                {formatBalance(portfolio.solBalance * 1_000_000_000)} SOL
              </p>
              <p className="text-xs text-muted-foreground">
                ${(portfolio.solBalance * portfolio.solPrice).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Staked SOL */}
          {portfolio.stakedValue > 0 && (
            <div className="flex items-center justify-between p-3 bg-secondary/20 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-accent/50 flex items-center justify-center">
                  <span className="text-accent-foreground font-bold text-xs">STAKE</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Staked SOL</p>
                  <p className="text-xs text-muted-foreground">Earning rewards</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-foreground">
                  {formatBalance(portfolio.stakedValue * 1_000_000_000)} SOL
                </p>
                <p className="text-xs text-muted-foreground">
                  ${(portfolio.stakedValue * portfolio.solPrice).toFixed(2)}
                </p>
              </div>
            </div>
          )}

          {/* Tokens */}
          {portfolio.tokens.slice(0, 5).map((token, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-secondary/20 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  <span className="text-foreground font-bold text-xs">TKN</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {token.mint.slice(0, 4)}...{token.mint.slice(-4)}
                  </p>
                  <p className="text-xs text-muted-foreground">SPL Token</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-foreground">{token.uiAmount.toFixed(4)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Dashboard */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <PieChart className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-display font-semibold text-foreground">
            Risk Assessment
          </h2>
        </div>

        {/* Overall Risk */}
        <div className={`p-4 rounded-xl mb-4 ${getRiskBg(riskMetrics.overallRisk)}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-5 h-5 ${getRiskColor(riskMetrics.overallRisk)}`} />
              <span className="font-medium text-foreground">Overall Risk Level</span>
            </div>
            <span className={`font-bold ${getRiskColor(riskMetrics.overallRisk)}`}>
              {riskMetrics.overallRisk}
            </span>
          </div>
        </div>

        {/* Risk Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-secondary/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Percent className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">Diversification</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden mb-1">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${riskMetrics.diversificationScore}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{riskMetrics.diversificationScore}% score</p>
          </div>

          <div className="bg-secondary/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-accent" />
              <span className="text-sm text-muted-foreground">Concentration</span>
            </div>
            <p className={`font-bold ${getRiskColor(riskMetrics.concentrationRisk)}`}>
              {riskMetrics.concentrationRisk}
            </p>
            <p className="text-xs text-muted-foreground">Asset distribution</p>
          </div>

          <div className="bg-secondary/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Liquidity</span>
            </div>
            <p className="font-bold text-foreground">
              {(riskMetrics.liquidityRatio * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground">Available to trade</p>
          </div>

          <div className="bg-secondary/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-accent" />
              <span className="text-sm text-muted-foreground">Staking</span>
            </div>
            <p className="font-bold text-foreground">
              {(riskMetrics.stakingRatio * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground">Of portfolio staked</p>
          </div>
        </div>
      </div>
    </div>
  );
}
