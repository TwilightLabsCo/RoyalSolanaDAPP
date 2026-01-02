import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  Keypair,
  ParsedAccountData,
} from '@solana/web3.js';

// Network configuration
export type NetworkType = 'mainnet' | 'devnet' | 'testnet';

// RPC endpoints per network - ordered by reliability
const RPC_ENDPOINTS: Record<NetworkType, string[]> = {
  mainnet: [
    'https://api.mainnet-beta.solana.com',
    'https://rpc.ankr.com/solana',
    'https://solana-mainnet.g.alchemy.com/v2/demo',
  ],
  devnet: [
    'https://api.devnet.solana.com',
    'https://rpc.ankr.com/solana_devnet',
  ],
  testnet: [
    'https://api.testnet.solana.com',
  ],
};

// State
let currentNetwork: NetworkType = 'mainnet';
let currentEndpointIndex = 0;
let connectionCache: Connection | null = null;

// Get current network
export function getCurrentNetwork(): NetworkType {
  return currentNetwork;
}

// Get all endpoints for current network
function getEndpoints(): string[] {
  return RPC_ENDPOINTS[currentNetwork];
}

// Get current endpoint URL
function getCurrentEndpoint(): string {
  const endpoints = getEndpoints();
  return endpoints[currentEndpointIndex % endpoints.length];
}

// Create a new connection with timeout
function createConnection(endpoint: string): Connection {
  return new Connection(endpoint, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
  });
}

// Get connection (cached)
export function getConnection(): Connection {
  if (!connectionCache) {
    connectionCache = createConnection(getCurrentEndpoint());
  }
  return connectionCache;
}

// Switch to next endpoint
export function tryNextEndpoint(): Connection {
  const endpoints = getEndpoints();
  currentEndpointIndex = (currentEndpointIndex + 1) % endpoints.length;
  connectionCache = createConnection(getCurrentEndpoint());
  console.log(`Switched to endpoint: ${getCurrentEndpoint()}`);
  return connectionCache;
}

// Switch network
export function switchNetwork(network: NetworkType): void {
  if (network !== currentNetwork) {
    currentNetwork = network;
    currentEndpointIndex = 0;
    connectionCache = null;
    console.log(`Switched to network: ${network}`);
  }
}

// Fetch with timeout helper
async function fetchWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 15000
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    ),
  ]);
}

// Get SOL balance with retry
export async function getBalance(publicKey: string): Promise<number> {
  const endpoints = getEndpoints();
  
  for (let i = 0; i < endpoints.length; i++) {
    try {
      const conn = createConnection(endpoints[i]);
      const pubKey = new PublicKey(publicKey);
      const balance = await fetchWithTimeout(conn.getBalance(pubKey), 10000);
      return balance;
    } catch (error) {
      console.warn(`Balance fetch failed on ${endpoints[i]}:`, error);
      if (i === endpoints.length - 1) {
        return 0;
      }
    }
  }
  return 0;
}

// Get SOL price from CoinGecko
export async function getSolPrice(): Promise<number> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await response.json();
    return data.solana?.usd || 145;
  } catch {
    return 145;
  }
}

// Token account interface
export interface TokenAccount {
  mint: string;
  amount: number;
  decimals: number;
  symbol?: string;
  name?: string;
  uiAmount: number;
}

// Get token accounts
export async function getTokenAccounts(publicKey: string): Promise<TokenAccount[]> {
  const endpoints = getEndpoints();
  
  for (let i = 0; i < endpoints.length; i++) {
    try {
      const conn = createConnection(endpoints[i]);
      const pubKey = new PublicKey(publicKey);
      
      const tokenAccounts = await fetchWithTimeout(
        conn.getParsedTokenAccountsByOwner(pubKey, {
          programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        }),
        20000
      );

      return tokenAccounts.value.map((account) => {
        const parsedInfo = account.account.data as ParsedAccountData;
        const info = parsedInfo.parsed.info;
        return {
          mint: info.mint,
          amount: parseInt(info.tokenAmount.amount),
          decimals: info.tokenAmount.decimals,
          uiAmount: info.tokenAmount.uiAmount || 0,
        };
      });
    } catch (error) {
      console.warn(`Token accounts fetch failed on ${endpoints[i]}:`, error);
      if (i === endpoints.length - 1) {
        return [];
      }
    }
  }
  return [];
}

// Transaction history interface
export interface TransactionHistory {
  signature: string;
  slot: number;
  blockTime: number | null;
  status: 'success' | 'failed';
  type: 'sent' | 'received' | 'unknown';
  amount?: number;
  from?: string;
  to?: string;
}

// Get transaction history
export async function getTransactionHistory(
  publicKey: string,
  limit: number = 10
): Promise<TransactionHistory[]> {
  try {
    const conn = getConnection();
    const pubKey = new PublicKey(publicKey);
    const signatures = await fetchWithTimeout(
      conn.getSignaturesForAddress(pubKey, { limit }),
      15000
    );

    return signatures.map((sig) => ({
      signature: sig.signature,
      slot: sig.slot,
      blockTime: sig.blockTime,
      status: sig.err ? 'failed' : 'success',
      type: 'unknown' as const,
    }));
  } catch (error) {
    console.error('Failed to get transaction history:', error);
    return [];
  }
}

// Send SOL
export async function sendSol(
  fromKeypair: Keypair,
  toAddress: string,
  amountSol: number
): Promise<string> {
  const conn = getConnection();
  const toPublicKey = new PublicKey(toAddress);
  const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey: toPublicKey,
      lamports,
    })
  );

  const signature = await sendAndConfirmTransaction(conn, transaction, [fromKeypair]);
  return signature;
}

// Request airdrop (devnet/testnet only)
export async function requestAirdrop(publicKey: string, amount: number = 1): Promise<string> {
  const conn = getConnection();
  const pubKey = new PublicKey(publicKey);
  
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
  const signature = await conn.requestAirdrop(pubKey, amount * LAMPORTS_PER_SOL);
  
  await conn.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  }, 'confirmed');
  
  return signature;
}

// Stake account interface
export interface StakeAccount {
  pubkey: string;
  lamports: number;
  validator?: string;
  state: 'activating' | 'active' | 'deactivating' | 'inactive';
}

// Get stake accounts for a wallet
export async function getStakeAccounts(publicKey: string): Promise<StakeAccount[]> {
  const endpoints = getEndpoints();
  
  for (let i = 0; i < endpoints.length; i++) {
    try {
      const conn = createConnection(endpoints[i]);
      const pubKey = new PublicKey(publicKey);
      
      const stakeAccounts = await fetchWithTimeout(
        conn.getParsedProgramAccounts(
          new PublicKey('Stake11111111111111111111111111111111111111'),
          {
            filters: [
              {
                memcmp: {
                  offset: 12,
                  bytes: pubKey.toBase58(),
                },
              },
            ],
          }
        ),
        20000
      );

      return stakeAccounts.map((account) => ({
        pubkey: account.pubkey.toBase58(),
        lamports: account.account.lamports,
        state: 'active' as const,
      }));
    } catch (error) {
      console.warn(`Stake accounts fetch failed on ${endpoints[i]}:`, error);
      if (i === endpoints.length - 1) {
        return [];
      }
    }
  }
  return [];
}

// Legacy exports for compatibility
export const NETWORKS = {
  mainnet: RPC_ENDPOINTS.mainnet[0],
  devnet: RPC_ENDPOINTS.devnet[0],
  testnet: RPC_ENDPOINTS.testnet[0],
} as const;
