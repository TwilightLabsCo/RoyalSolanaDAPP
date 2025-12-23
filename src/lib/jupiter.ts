import { VersionedTransaction, Keypair } from '@solana/web3.js';
import { getConnection, getCurrentNetwork } from './solana';

const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6/quote';
const JUPITER_SWAP_API = 'https://quote-api.jup.ag/v6/swap';
const JUPITER_TOKEN_LIST = 'https://token.jup.ag/all';
const JUPITER_PRICE_API = 'https://price.jup.ag/v6/price';

export interface JupiterToken {
  address: string;
  chainId: number;
  decimals: number;
  name: string;
  symbol: string;
  logoURI?: string;
  tags?: string[];
}

export interface QuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: RoutePlan[];
  contextSlot?: number;
  timeTaken?: number;
}

export interface RoutePlan {
  swapInfo: {
    ammKey: string;
    label: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    feeAmount: string;
    feeMint: string;
  };
  percent: number;
}

export interface TokenPrice {
  id: string;
  mintSymbol: string;
  vsToken: string;
  vsTokenSymbol: string;
  price: number;
}

// Common token mints
export const COMMON_TOKENS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  PYTH: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
  RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  ORCA: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
  MSOL: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  JITOSOL: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
} as const;

// Popular tokens for UI display
export const POPULAR_TOKENS: JupiterToken[] = [
  { address: COMMON_TOKENS.SOL, chainId: 101, decimals: 9, name: 'Solana', symbol: 'SOL', logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png' },
  { address: COMMON_TOKENS.USDC, chainId: 101, decimals: 6, name: 'USD Coin', symbol: 'USDC', logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png' },
  { address: COMMON_TOKENS.USDT, chainId: 101, decimals: 6, name: 'Tether USD', symbol: 'USDT', logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg' },
  { address: COMMON_TOKENS.BONK, chainId: 101, decimals: 5, name: 'Bonk', symbol: 'BONK', logoURI: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I' },
  { address: COMMON_TOKENS.JUP, chainId: 101, decimals: 6, name: 'Jupiter', symbol: 'JUP', logoURI: 'https://static.jup.ag/jup/icon.png' },
  { address: COMMON_TOKENS.WIF, chainId: 101, decimals: 6, name: 'dogwifhat', symbol: 'WIF', logoURI: 'https://bafkreibk3covs5ltyqxa272uodhculbr6kea6betiez6v5vqqlz5n6t5bm.ipfs.nftstorage.link' },
  { address: COMMON_TOKENS.RAY, chainId: 101, decimals: 6, name: 'Raydium', symbol: 'RAY', logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png' },
  { address: COMMON_TOKENS.ORCA, chainId: 101, decimals: 6, name: 'Orca', symbol: 'ORCA', logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png' },
  { address: COMMON_TOKENS.MSOL, chainId: 101, decimals: 9, name: 'Marinade Staked SOL', symbol: 'mSOL', logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png' },
  { address: COMMON_TOKENS.JITOSOL, chainId: 101, decimals: 9, name: 'Jito Staked SOL', symbol: 'JitoSOL', logoURI: 'https://storage.googleapis.com/token-metadata/JitoSOL-256.png' },
];

let cachedTokens: JupiterToken[] | null = null;
let tokenCacheTime = 0;
const TOKEN_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function getTokenList(): Promise<JupiterToken[]> {
  const now = Date.now();
  if (cachedTokens && now - tokenCacheTime < TOKEN_CACHE_DURATION) {
    return cachedTokens;
  }
  
  try {
    const response = await fetch(JUPITER_TOKEN_LIST, {
      signal: AbortSignal.timeout(10000),
    });
    const tokens = await response.json();
    cachedTokens = tokens;
    tokenCacheTime = now;
    return tokens;
  } catch (error) {
    console.error('Failed to fetch token list:', error);
    return cachedTokens || POPULAR_TOKENS;
  }
}

export async function searchTokens(query: string): Promise<JupiterToken[]> {
  if (!query || query.length < 2) {
    return POPULAR_TOKENS;
  }
  
  const tokens = await getTokenList();
  const searchLower = query.toLowerCase().trim();
  
  // Exact match first, then partial matches
  const exactMatches = tokens.filter(
    t => t.symbol.toLowerCase() === searchLower || t.address.toLowerCase() === searchLower
  );
  
  const partialMatches = tokens.filter(
    t =>
      (t.symbol.toLowerCase().includes(searchLower) ||
       t.name.toLowerCase().includes(searchLower)) &&
      !exactMatches.includes(t)
  );
  
  return [...exactMatches, ...partialMatches].slice(0, 30);
}

export async function getTokenByAddress(address: string): Promise<JupiterToken | null> {
  const tokens = await getTokenList();
  return tokens.find(t => t.address === address) || null;
}

export async function getTokenPrice(mint: string): Promise<number | null> {
  try {
    const response = await fetch(`${JUPITER_PRICE_API}?ids=${mint}`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await response.json();
    return data.data?.[mint]?.price || null;
  } catch {
    return null;
  }
}

export async function getQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 50
): Promise<QuoteResponse | null> {
  // Jupiter only works on mainnet
  if (getCurrentNetwork() !== 'mainnet') {
    console.warn('Jupiter swap only available on mainnet');
    return null;
  }
  
  if (amount <= 0) return null;
  
  try {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amount.toString(),
      slippageBps: slippageBps.toString(),
      onlyDirectRoutes: 'false',
      asLegacyTransaction: 'false',
    });
    
    const response = await fetch(`${JUPITER_QUOTE_API}?${params}`, {
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Quote API error:', errorText);
      return null;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to get quote:', error);
    return null;
  }
}

export async function executeSwap(
  quoteResponse: QuoteResponse,
  userPublicKey: string,
  keypair: Keypair
): Promise<string> {
  const connection = getConnection();
  
  // Get swap transaction
  const swapResponse = await fetch(JUPITER_SWAP_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto',
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!swapResponse.ok) {
    const errorText = await swapResponse.text();
    throw new Error(`Swap API error: ${errorText}`);
  }

  const { swapTransaction } = await swapResponse.json();

  // Deserialize and sign transaction
  const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
  const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
  
  // Sign with keypair
  transaction.sign([keypair]);

  // Send transaction with retries
  const rawTransaction = transaction.serialize();
  const signature = await connection.sendRawTransaction(rawTransaction, {
    skipPreflight: true,
    maxRetries: 5,
  });

  // Confirm transaction
  const latestBlockhash = await connection.getLatestBlockhash('confirmed');
  await connection.confirmTransaction({
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    signature,
  }, 'confirmed');

  return signature;
}

export function formatTokenAmount(amount: string | number, decimals: number): string {
  const num = typeof amount === 'string' ? parseInt(amount) : amount;
  const value = num / Math.pow(10, decimals);
  
  if (value >= 1000000000) {
    return (value / 1000000000).toFixed(2) + 'B';
  } else if (value >= 1000000) {
    return (value / 1000000).toFixed(2) + 'M';
  } else if (value >= 1000) {
    return (value / 1000).toFixed(2) + 'K';
  } else if (value >= 1) {
    return value.toFixed(4);
  } else if (value >= 0.0001) {
    return value.toFixed(6);
  } else {
    return value.toExponential(2);
  }
}

export function parseTokenAmount(amount: string, decimals: number): number {
  const parsed = parseFloat(amount);
  if (isNaN(parsed)) return 0;
  return Math.floor(parsed * Math.pow(10, decimals));
}
