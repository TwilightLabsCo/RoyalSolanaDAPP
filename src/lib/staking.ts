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
import { getConnection } from './solana';

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

// Fetch validators from on-chain with retry logic and network-specific handling
export async function fetchValidators(retries = 5): Promise<ValidatorInfo[]> {
  const { getCurrentNetwork, NETWORKS } = await import('./solana');
  const network = getCurrentNetwork();
  
  // Direct endpoints for validator fetching (more reliable than going through connection pool)
  const endpoints = [
    network === 'mainnet' 
      ? 'https://mainnet.helius-rpc.com/?api-key=1d8740dc-e5f4-421c-b823-e1bad1889eff'
      : network === 'devnet'
        ? 'https://api.devnet.solana.com'
        : 'https://api.testnet.solana.com',
    network === 'mainnet'
      ? 'https://api.mainnet-beta.solana.com'
      : network === 'devnet'
        ? 'https://devnet.helius-rpc.com/?api-key=1d8740dc-e5f4-421c-b823-e1bad1889eff'
        : 'https://testnet.helius-rpc.com/?api-key=1d8740dc-e5f4-421c-b823-e1bad1889eff',
    'https://rpc.ankr.com/solana' + (network === 'devnet' ? '_devnet' : network === 'testnet' ? '_testnet' : ''),
  ];

  for (let attempt = 0; attempt <= retries; attempt++) {
    const endpointIndex = attempt % endpoints.length;
    const endpoint = endpoints[endpointIndex];
    
    try {
      console.log(`Fetching validators for ${network} (attempt ${attempt + 1}) using ${endpoint.split('?')[0]}`);
      
      // Create a fresh connection for each attempt
      const conn = new Connection(endpoint, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000,
      });
      
      // Fetch vote accounts with longer timeout
      const voteAccounts = await Promise.race([
        conn.getVoteAccounts('confirmed'),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout fetching validators')), 45000)
        )
      ]);
      
      const currentValidators = voteAccounts.current || [];
      const delinquentValidators = voteAccounts.delinquent || [];
      const allValidators = [...currentValidators, ...delinquentValidators];
      
      console.log(`Raw validator counts - current: ${currentValidators.length}, delinquent: ${delinquentValidators.length}`);
      
      if (allValidators.length === 0) {
        console.warn('No validators returned, trying next endpoint...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      console.log(`Found ${allValidators.length} validators on ${network}`);
      
      // Filter and sort validators - include validators with stake
      const activeValidators = allValidators.filter(v => v.activatedStake > 0);
      console.log(`Active validators with stake: ${activeValidators.length}`);
      
      // If no active validators, use all validators
      const validatorsToUse = activeValidators.length > 0 ? activeValidators : allValidators;
      
      const sortedValidators = validatorsToUse
        .sort((a, b) => b.activatedStake - a.activatedStake)
        .slice(0, 100);
      
      const validators = sortedValidators.map((v) => {
        // Calculate estimated APY based on commission and epoch credits
        const lastCredits = v.epochCredits[v.epochCredits.length - 1];
        const prevCredits = v.epochCredits[v.epochCredits.length - 2];
        const creditsPerEpoch = lastCredits && prevCredits 
          ? lastCredits[1] - prevCredits[1] 
          : 0;
        
        // Base APY varies by network
        const baseApy = network === 'mainnet' ? 7.0 : 8.0;
        const estimatedApy = baseApy * (1 - v.commission / 100);
        
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

      console.log(`Returning ${validators.length} validators for staking`);
      return validators;
    } catch (error) {
      console.error(`Failed to fetch validators (attempt ${attempt + 1}):`, error);
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        continue;
      }
      return [];
    }
  }
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
  
  // Get minimum rent for stake account
  const minimumRent = await connection.getMinimumBalanceForRentExemption(200);
  const totalLamports = lamports + minimumRent;

  const transaction = new Transaction();

  // Create stake account
  transaction.add(
    SystemProgram.createAccount({
      fromPubkey: fromKeypair.publicKey,
      newAccountPubkey: stakeKeypair.publicKey,
      lamports: totalLamports,
      space: 200,
      programId: StakeProgram.programId,
    })
  );

  // Initialize stake account
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

  // Delegate to validator
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

// Deactivate stake (start unstaking)
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

// Withdraw stake (after deactivation is complete)
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

export function formatStake(lamports: number): string {
  const sol = lamports / LAMPORTS_PER_SOL;
  if (sol >= 1000000) {
    return (sol / 1000000).toFixed(2) + 'M';
  } else if (sol >= 1000) {
    return (sol / 1000).toFixed(1) + 'K';
  }
  return sol.toFixed(2);
}
