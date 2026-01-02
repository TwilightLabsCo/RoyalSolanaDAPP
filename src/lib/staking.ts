import {
  Connection,
  PublicKey,
  Transaction,
  StakeProgram,
  Authorized,
  Lockup,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { getConnection, getCurrentNetwork, NetworkType } from './solana';

export interface ValidatorInfo {
  votePubkey: string;
  nodePubkey: string;
  activatedStake: number;
  commission: number;
  lastVote: number;
  epochCredits: number;
  name?: string;
  website?: string;
  apy?: number;
}

export interface StakeAccountInfo {
  pubkey: string;
  lamports: number;
  validator: string;
  state: 'activating' | 'active' | 'deactivating' | 'inactive';
  activationEpoch?: number;
  deactivationEpoch?: number;
}

// RPC endpoints specifically for validator fetching (heavy operation)
const VALIDATOR_RPC_ENDPOINTS: Record<NetworkType, string[]> = {
  mainnet: [
    'https://api.mainnet-beta.solana.com',
    'https://rpc.ankr.com/solana',
    'https://solana-mainnet.g.alchemy.com/v2/demo',
  ],
  devnet: [
    'https://api.devnet.solana.com',
  ],
  testnet: [
    'https://api.testnet.solana.com',
  ],
};

// Fetch validators with simple retry across endpoints
export async function fetchValidators(): Promise<ValidatorInfo[]> {
  const network = getCurrentNetwork();
  const endpoints = VALIDATOR_RPC_ENDPOINTS[network];
  
  console.log(`Fetching validators for ${network}...`);
  
  for (const endpoint of endpoints) {
    try {
      console.log(`Trying endpoint: ${endpoint}`);
      
      const conn = new Connection(endpoint, {
        commitment: 'confirmed',
      });
      
      // Fetch vote accounts with 30s timeout
      const voteAccountsPromise = conn.getVoteAccounts('confirmed');
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 30000)
      );
      
      const voteAccounts = await Promise.race([voteAccountsPromise, timeoutPromise]);
      
      const currentValidators = voteAccounts.current || [];
      console.log(`Found ${currentValidators.length} current validators`);
      
      if (currentValidators.length === 0) {
        console.log('No validators found, trying next endpoint...');
        continue;
      }
      
      // Sort by stake and take top 100
      const sorted = currentValidators
        .filter(v => v.activatedStake > 0)
        .sort((a, b) => b.activatedStake - a.activatedStake)
        .slice(0, 100);
      
      const validators: ValidatorInfo[] = sorted.map((v) => {
        // Calculate APY based on commission
        const baseApy = network === 'mainnet' ? 7.0 : 8.0;
        const estimatedApy = baseApy * (1 - v.commission / 100);
        
        // Get epoch credits
        const lastCredits = v.epochCredits[v.epochCredits.length - 1];
        const prevCredits = v.epochCredits[v.epochCredits.length - 2];
        const creditsPerEpoch = lastCredits && prevCredits 
          ? lastCredits[1] - prevCredits[1] 
          : 0;
        
        return {
          votePubkey: v.votePubkey,
          nodePubkey: v.nodePubkey,
          activatedStake: v.activatedStake,
          commission: v.commission,
          lastVote: v.lastVote,
          epochCredits: creditsPerEpoch,
          apy: estimatedApy,
        };
      });
      
      console.log(`Returning ${validators.length} validators`);
      return validators;
      
    } catch (error) {
      console.warn(`Endpoint ${endpoint} failed:`, error);
      continue;
    }
  }
  
  console.error('All endpoints failed for validator fetch');
  return [];
}

// Fetch stake accounts for a wallet
export async function fetchStakeAccounts(walletPublicKey: string): Promise<StakeAccountInfo[]> {
  try {
    const connection = getConnection();
    const walletPubkey = new PublicKey(walletPublicKey);
    
    const stakeAccounts = await connection.getParsedProgramAccounts(
      StakeProgram.programId,
      {
        filters: [
          { dataSize: 200 },
          {
            memcmp: {
              offset: 12,
              bytes: walletPubkey.toBase58(),
            },
          },
        ],
      }
    );

    const epochInfo = await connection.getEpochInfo();
    
    return stakeAccounts.map((account) => {
      const parsed = (account.account.data as any).parsed;
      const info = parsed?.info;
      const stake = info?.stake;
      const delegation = stake?.delegation;
      
      let state: StakeAccountInfo['state'] = 'inactive';
      
      if (delegation) {
        const activationEpoch = parseInt(delegation.activationEpoch);
        const deactivationEpoch = parseInt(delegation.deactivationEpoch);
        
        if (deactivationEpoch < epochInfo.epoch) {
          state = 'inactive';
        } else if (activationEpoch >= epochInfo.epoch) {
          state = 'activating';
        } else if (deactivationEpoch !== 18446744073709551615) {
          state = 'deactivating';
        } else {
          state = 'active';
        }
      }

      return {
        pubkey: account.pubkey.toBase58(),
        lamports: account.account.lamports,
        validator: delegation?.voter || '',
        state,
        activationEpoch: delegation ? parseInt(delegation.activationEpoch) : undefined,
        deactivationEpoch: delegation ? parseInt(delegation.deactivationEpoch) : undefined,
      };
    });
  } catch (error) {
    console.error('Failed to fetch stake accounts:', error);
    return [];
  }
}

// Create and delegate stake
export async function createStakeAccount(
  fromKeypair: Keypair,
  validatorVotePubkey: string,
  amountSol: number
): Promise<string> {
  const connection = getConnection();
  const stakeKeypair = Keypair.generate();
  const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
  
  const minimumRent = await connection.getMinimumBalanceForRentExemption(200);
  const totalLamports = lamports + minimumRent;

  const transaction = new Transaction();

  transaction.add(
    SystemProgram.createAccount({
      fromPubkey: fromKeypair.publicKey,
      newAccountPubkey: stakeKeypair.publicKey,
      lamports: totalLamports,
      space: 200,
      programId: StakeProgram.programId,
    })
  );

  transaction.add(
    StakeProgram.initialize({
      stakePubkey: stakeKeypair.publicKey,
      authorized: new Authorized(
        fromKeypair.publicKey,
        fromKeypair.publicKey
      ),
      lockup: new Lockup(0, 0, fromKeypair.publicKey),
    })
  );

  transaction.add(
    StakeProgram.delegate({
      stakePubkey: stakeKeypair.publicKey,
      authorizedPubkey: fromKeypair.publicKey,
      votePubkey: new PublicKey(validatorVotePubkey),
    })
  );

  const signature = await sendAndConfirmTransaction(connection, transaction, [
    fromKeypair,
    stakeKeypair,
  ]);

  return signature;
}

// Deactivate stake
export async function deactivateStake(
  fromKeypair: Keypair,
  stakeAccountPubkey: string
): Promise<string> {
  const connection = getConnection();
  
  const transaction = new Transaction().add(
    StakeProgram.deactivate({
      stakePubkey: new PublicKey(stakeAccountPubkey),
      authorizedPubkey: fromKeypair.publicKey,
    })
  );

  const signature = await sendAndConfirmTransaction(connection, transaction, [fromKeypair]);
  return signature;
}

// Withdraw stake
export async function withdrawStake(
  fromKeypair: Keypair,
  stakeAccountPubkey: string
): Promise<string> {
  const connection = getConnection();
  const stakePubkey = new PublicKey(stakeAccountPubkey);
  
  const stakeBalance = await connection.getBalance(stakePubkey);

  const transaction = new Transaction().add(
    StakeProgram.withdraw({
      stakePubkey,
      authorizedPubkey: fromKeypair.publicKey,
      toPubkey: fromKeypair.publicKey,
      lamports: stakeBalance,
    })
  );

  const signature = await sendAndConfirmTransaction(connection, transaction, [fromKeypair]);
  return signature;
}

// Format stake amount
export function formatStake(lamports: number): string {
  const sol = lamports / LAMPORTS_PER_SOL;
  if (sol >= 1000000) {
    return (sol / 1000000).toFixed(2) + 'M';
  } else if (sol >= 1000) {
    return (sol / 1000).toFixed(1) + 'K';
  }
  return sol.toFixed(2);
}
