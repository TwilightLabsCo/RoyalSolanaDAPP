import { Connection, VersionedTransaction, Keypair } from '@solana/web3.js';
import { getConnection } from './solana';

const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6/quote';
const JUPITER_SWAP_API = 'https://quote-api.jup.ag/v6/swap';
const JUPITER_TOKEN_LIST = 'https://token.jup.ag/strict';

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
  routePlan: any[];
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
} as const;

let cachedTokens: JupiterToken[] | null = null;

export async function getTokenList(): Promise<JupiterToken[]> {
  if (cachedTokens) return cachedTokens;
  
  try {
    const response = await fetch(JUPITER_TOKEN_LIST);
    const tokens = await response.json();
    cachedTokens = tokens;
    return tokens;
  } catch (error) {
    console.error('Failed to fetch token list:', error);
    return [];
  }
}

export async function searchTokens(query: string): Promise<JupiterToken[]> {
  const tokens = await getTokenList();
  const searchLower = query.toLowerCase();
  
  return tokens
    .filter(
      (t) =>
        t.symbol.toLowerCase().includes(searchLower) ||
        t.name.toLowerCase().includes(searchLower) ||
        t.address.toLowerCase() === searchLower
    )
    .slice(0, 20);
}

export async function getQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 50
): Promise<QuoteResponse | null> {
  try {
    const url = `${JUPITER_QUOTE_API}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Quote API error: ${response.statusText}`);
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

  // Send transaction
  const rawTransaction = transaction.serialize();
  const signature = await connection.sendRawTransaction(rawTransaction, {
    skipPreflight: true,
    maxRetries: 3,
  });

  // Confirm transaction
  const latestBlockhash = await connection.getLatestBlockhash();
  await connection.confirmTransaction({
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    signature,
  });

  return signature;
}

export function formatTokenAmount(amount: string | number, decimals: number): string {
  const num = typeof amount === 'string' ? parseInt(amount) : amount;
  const value = num / Math.pow(10, decimals);
  
  if (value >= 1000000) {
    return (value / 1000000).toFixed(2) + 'M';
  } else if (value >= 1000) {
    return (value / 1000).toFixed(2) + 'K';
  } else if (value >= 1) {
    return value.toFixed(4);
  } else {
    return value.toFixed(6);
  }
}
