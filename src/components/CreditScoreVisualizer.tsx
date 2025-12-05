import { useState, useEffect } from "react";
import { CreditScore, calculateCreditScore, getScoreRecommendations } from "@/lib/creditScore";
import { WalletData } from "@/lib/wallet";
import { TrendingUp, Shield, Activity, Coins, PiggyBank, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";

interface CreditScoreVisualizerProps {
  wallet: WalletData;
}

export function CreditScoreVisualizer({ wallet }: CreditScoreVisualizerProps) {
  const [creditScore, setCreditScore] = useState<CreditScore | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<string[]>([]);

  const fetchCreditScore = async () => {
    setIsLoading(true);
    try {
      const score = await calculateCreditScore(wallet.publicKey, wallet.createdAt);
      setCreditScore(score);
      setRecommendations(getScoreRecommendations(score));
    } catch (error) {
      console.error("Failed to calculate credit score:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCreditScore();
  }, [wallet.publicKey]);

  const getGaugeRotation = (score: number) => {
    // Convert score (300-850) to rotation (-90 to 90 degrees)
    const normalized = (score - 300) / 550;
    return -90 + normalized * 180;
  };

  if (isLoading) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
            <p className="text-muted-foreground">Analyzing on-chain data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!creditScore) {
    return (
      <div className="glass-card p-6">
        <p className="text-muted-foreground text-center">Unable to calculate credit score</p>
      </div>
    );
  }

  const iconMap: Record<string, React.ReactNode> = {
    "Wallet History": <Shield className="w-4 h-4" />,
    "Transaction Activity": <Activity className="w-4 h-4" />,
    "Balance Health": <Coins className="w-4 h-4" />,
    "Staking Participation": <PiggyBank className="w-4 h-4" />,
    "Token Portfolio": <TrendingUp className="w-4 h-4" />,
    "Reliability": <CheckCircle className="w-4 h-4" />,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Main Score Card */}
      <div className="glass-card p-6 glow-soft">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-display font-semibold text-foreground">
              On-Chain Credit Score
            </h2>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchCreditScore}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Gauge Visualization */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative w-48 h-24 overflow-hidden">
            {/* Gauge background */}
            <div className="absolute inset-0 flex items-end justify-center">
              <div className="w-48 h-24 rounded-t-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 opacity-20" />
            </div>
            {/* Gauge needle */}
            <div
              className="absolute bottom-0 left-1/2 w-1 h-20 bg-foreground origin-bottom transition-transform duration-1000"
              style={{ transform: `translateX(-50%) rotate(${getGaugeRotation(creditScore.score)}deg)` }}
            >
              <div className="w-3 h-3 rounded-full bg-foreground -ml-1 -mt-1" />
            </div>
            {/* Center point */}
            <div className="absolute bottom-0 left-1/2 w-4 h-4 rounded-full bg-card border-2 border-foreground -translate-x-1/2 translate-y-1/2" />
          </div>

          {/* Score Display */}
          <div className="text-center mt-4">
            <div className="text-5xl font-bold" style={{ color: creditScore.color }}>
              {creditScore.score}
            </div>
            <div
              className="text-lg font-semibold mt-1 px-4 py-1 rounded-full inline-block"
              style={{ backgroundColor: `${creditScore.color}20`, color: creditScore.color }}
            >
              {creditScore.grade}
            </div>
          </div>

          {/* Score range labels */}
          <div className="flex justify-between w-full mt-4 text-xs text-muted-foreground">
            <span>300</span>
            <span>500</span>
            <span>670</span>
            <span>750</span>
            <span>850</span>
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-display font-semibold text-foreground mb-4">
          Score Breakdown
        </h3>
        <div className="space-y-4">
          {creditScore.breakdown.map((item, index) => (
            <div key={index}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-primary">{iconMap[item.category]}</span>
                  <span className="text-foreground">{item.category}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {item.score}/{item.maxScore}
                </span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(item.score / item.maxScore) * 100}%`,
                    background: `linear-gradient(90deg, ${creditScore.color}80, ${creditScore.color})`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-display font-semibold text-foreground mb-4">
            Improve Your Score
          </h3>
          <div className="space-y-3">
            {recommendations.map((rec, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 bg-secondary/30 rounded-xl"
              >
                <AlertCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
