import { getBalance, getTransactionHistory, getTokenAccounts, getStakeAccounts } from './solana';

export interface CreditScoreMetrics {
  walletAge: number; // days
  transactionCount: number;
  averageBalance: number;
  hasStaking: boolean;
  tokenDiversity: number;
  failedTransactionRatio: number;
  activityScore: number;
}

export interface CreditScore {
  score: number; // 300-850
  grade: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Very Poor';
  color: string;
  metrics: CreditScoreMetrics;
  breakdown: {
    category: string;
    score: number;
    maxScore: number;
    description: string;
  }[];
}

export async function calculateCreditScore(
  publicKey: string,
  walletCreatedAt: number
): Promise<CreditScore> {
  // Fetch on-chain data
  const [balance, transactions, tokens, stakeAccounts] = await Promise.all([
    getBalance(publicKey),
    getTransactionHistory(publicKey, 50),
    getTokenAccounts(publicKey),
    getStakeAccounts(publicKey),
  ]);

  // Calculate wallet age in days
  const walletAge = Math.floor((Date.now() - walletCreatedAt) / (1000 * 60 * 60 * 24));
  
  // Calculate metrics
  const transactionCount = transactions.length;
  const failedTransactions = transactions.filter((t) => t.status === 'failed').length;
  const failedTransactionRatio = transactionCount > 0 ? failedTransactions / transactionCount : 0;
  const hasStaking = stakeAccounts.length > 0;
  const tokenDiversity = tokens.length;
  const averageBalance = balance / 1_000_000_000; // Convert to SOL

  // Calculate activity score (transactions per day, capped at 1)
  const activityScore = walletAge > 0 ? Math.min(transactionCount / walletAge, 1) : 0;

  const metrics: CreditScoreMetrics = {
    walletAge,
    transactionCount,
    averageBalance,
    hasStaking,
    tokenDiversity,
    failedTransactionRatio,
    activityScore,
  };

  // Calculate component scores
  const breakdown = [
    {
      category: 'Wallet History',
      score: Math.min(walletAge * 2, 150),
      maxScore: 150,
      description: `${walletAge} days old`,
    },
    {
      category: 'Transaction Activity',
      score: Math.min(transactionCount * 3, 200),
      maxScore: 200,
      description: `${transactionCount} transactions`,
    },
    {
      category: 'Balance Health',
      score: Math.min(averageBalance * 10, 150),
      maxScore: 150,
      description: `${averageBalance.toFixed(2)} SOL average`,
    },
    {
      category: 'Staking Participation',
      score: hasStaking ? 100 : 0,
      maxScore: 100,
      description: hasStaking ? 'Active staker' : 'No staking',
    },
    {
      category: 'Token Portfolio',
      score: Math.min(tokenDiversity * 15, 100),
      maxScore: 100,
      description: `${tokenDiversity} different tokens`,
    },
    {
      category: 'Reliability',
      score: Math.round((1 - failedTransactionRatio) * 150),
      maxScore: 150,
      description: `${((1 - failedTransactionRatio) * 100).toFixed(1)}% success rate`,
    },
  ];

  // Calculate total score (300-850 range)
  const rawScore = breakdown.reduce((sum, b) => sum + b.score, 0);
  const maxPossible = breakdown.reduce((sum, b) => sum + b.maxScore, 0);
  const normalizedScore = Math.round(300 + (rawScore / maxPossible) * 550);
  const score = Math.max(300, Math.min(850, normalizedScore));

  // Determine grade
  let grade: CreditScore['grade'];
  let color: string;

  if (score >= 750) {
    grade = 'Excellent';
    color = '#22c55e';
  } else if (score >= 670) {
    grade = 'Good';
    color = '#84cc16';
  } else if (score >= 580) {
    grade = 'Fair';
    color = '#eab308';
  } else if (score >= 500) {
    grade = 'Poor';
    color = '#f97316';
  } else {
    grade = 'Very Poor';
    color = '#ef4444';
  }

  return {
    score,
    grade,
    color,
    metrics,
    breakdown,
  };
}

export function getScoreRecommendations(creditScore: CreditScore): string[] {
  const recommendations: string[] = [];
  const { metrics, breakdown } = creditScore;

  if (metrics.walletAge < 30) {
    recommendations.push('Keep your wallet active over time to build history');
  }
  if (metrics.transactionCount < 10) {
    recommendations.push('Increase transaction activity to improve your score');
  }
  if (metrics.averageBalance < 1) {
    recommendations.push('Maintain a higher SOL balance for better score');
  }
  if (!metrics.hasStaking) {
    recommendations.push('Start staking SOL to boost your credit score');
  }
  if (metrics.tokenDiversity < 3) {
    recommendations.push('Diversify your portfolio with different tokens');
  }
  if (metrics.failedTransactionRatio > 0.1) {
    recommendations.push('Reduce failed transactions by checking fees and balances');
  }

  return recommendations.slice(0, 4);
}
