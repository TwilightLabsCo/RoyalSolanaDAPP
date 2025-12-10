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

// Network endpoints - using reliable public RPCs with CORS support
export const NETWORKS = {
  mainnet: 'https://solana-mainnet.g.alchemy.com/v2/demo',
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
} as const;

// Fallback endpoints
const FALLBACK_ENDPOINTS = {
  mainnet: [
    'https://rpc.ankr.com/solana',
    'https://solana.public-rpc.com',
  ],
  devnet: ['https://rpc.ankr.com/solana_devnet'],
  testnet: [],
} as const;

export type NetworkType = keyof typeof NETWORKS;

let connection: Connection | null = null;
let currentNetwork: NetworkType = 'devnet';
let currentEndpointIndex = 0;

function getAllEndpoints(network: NetworkType): string[] {
  return [NETWORKS[network], ...(FALLBACK_ENDPOINTS[network] || [])];
}

export function getConnection(): Connection {
  if (!connection) {
    const endpoints = getAllEndpoints(currentNetwork);
    connection = new Connection(endpoints[currentEndpointIndex] || endpoints[0], {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });
  }
  return connection;
}

export async function tryNextEndpoint(): Promise<Connection> {
  const endpoints = getAllEndpoints(currentNetwork);
  currentEndpointIndex = (currentEndpointIndex + 1) % endpoints.length;
  connection = new Connection(endpoints[currentEndpointIndex], {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
  });
  return connection;
}

export function switchNetwork(network: NetworkType): void {
  currentNetwork = network;
  currentEndpointIndex = 0;
  const endpoints = getAllEndpoints(network);
  connection = new Connection(endpoints[0], {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
  });
}

export function getCurrentNetwork(): NetworkType {
  return currentNetwork;
}

export async function getBalance(publicKey: string): Promise<number> {
  try {
    const conn = getConnection();
    const pubKey = new PublicKey(publicKey);
    const balance = await conn.getBalance(pubKey);
    return balance;
  } catch (error) {
    console.error('Failed to get balance:', error);
    return 0;
  }
}

export async function getSolPrice(): Promise<number> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
    );
    const data = await response.json();
    return data.solana?.usd || 0;
  } catch {
    return 145; // Fallback price
  }
}

export interface TokenAccount {
  mint: string;
  amount: number;
  decimals: number;
  symbol?: string;
  name?: string;
  uiAmount: number;
}

export async function getTokenAccounts(publicKey: string): Promise<TokenAccount[]> {
  try {
    const conn = getConnection();
    const pubKey = new PublicKey(publicKey);
    const tokenAccounts = await conn.getParsedTokenAccountsByOwner(pubKey, {
      programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
    });

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
    console.error('Failed to get token accounts:', error);
    return [];
  }
}

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

export async function getTransactionHistory(
  publicKey: string,
  limit: number = 10
): Promise<TransactionHistory[]> {
  try {
    const conn = getConnection();
    const pubKey = new PublicKey(publicKey);
    const signatures = await conn.getSignaturesForAddress(pubKey, { limit });

    const transactions: TransactionHistory[] = [];
    
    for (const sig of signatures) {
      transactions.push({
        signature: sig.signature,
        slot: sig.slot,
        blockTime: sig.blockTime,
        status: sig.err ? 'failed' : 'success',
        type: 'unknown',
      });
    }

    return transactions;
  } catch (error) {
    console.error('Failed to get transaction history:', error);
    return [];
  }
}

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

export async function requestAirdrop(publicKey: string, amount: number = 1): Promise<string> {
  const conn = getConnection();
  const pubKey = new PublicKey(publicKey);
  const signature = await conn.requestAirdrop(pubKey, amount * LAMPORTS_PER_SOL);
  await conn.confirmTransaction(signature);
  return signature;
}

// Staking related functions
export interface StakeAccount {
  pubkey: string;
  lamports: number;
  validator?: string;
  state: 'activating' | 'active' | 'deactivating' | 'inactive';
}

export async function getStakeAccounts(publicKey: string): Promise<StakeAccount[]> {
  try {
    const conn = getConnection();
    const pubKey = new PublicKey(publicKey);
    const stakeAccounts = await conn.getParsedProgramAccounts(
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
    );

    return stakeAccounts.map((account) => ({
      pubkey: account.pubkey.toBase58(),
      lamports: account.account.lamports,
      state: 'active' as const,
    }));
  } catch (error) {
    console.error('Failed to get stake accounts:', error);
    return [];
  }
}

export interface ValidatorInfo {
  votePubkey: string;
  nodePubkey: string;
  activatedStake: number;
  commission: number;
  epochCredits: number;
}

export async function getValidators(): Promise<ValidatorInfo[]> {
  try {
    const conn = getConnection();
    const voteAccounts = await conn.getVoteAccounts();
    
    return voteAccounts.current.slice(0, 20).map((v) => ({
      votePubkey: v.votePubkey,
      nodePubkey: v.nodePubkey,
      activatedStake: v.activatedStake,
      commission: v.commission,
      epochCredits: v.epochCredits[v.epochCredits.length - 1]?.[1] || 0,
    }));
  } catch (error) {
    console.error('Failed to get validators:', error);
    return [];
  }
}
