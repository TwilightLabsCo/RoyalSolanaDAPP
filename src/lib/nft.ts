import { PublicKey, Connection } from '@solana/web3.js';
import { getConnection, getCurrentNetwork, NetworkType } from './solana';

export interface NFT {
  mint: string;
  name: string;
  symbol: string;
  image: string;
  description?: string;
  attributes?: Array<{ trait_type: string; value: string }>;
  collection?: string;
}

const METAPLEX_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

// RPC endpoints for NFT fetching
const NFT_RPC_ENDPOINTS: Record<NetworkType, string[]> = {
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

// IPFS gateways
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
];

// Get metadata PDA for a mint
function getMetadataPDA(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      METAPLEX_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    METAPLEX_PROGRAM_ID
  );
  return pda;
}

// Parse on-chain metadata
function parseMetadata(data: Buffer): { name: string; symbol: string; uri: string } | null {
  try {
    let offset = 1 + 32; // Skip key and update authority
    offset += 32; // Skip mint
    
    const nameLength = data.readUInt32LE(offset);
    offset += 4;
    const name = data.slice(offset, offset + nameLength).toString('utf8').replace(/\0/g, '').trim();
    offset += nameLength;
    
    const symbolLength = data.readUInt32LE(offset);
    offset += 4;
    const symbol = data.slice(offset, offset + symbolLength).toString('utf8').replace(/\0/g, '').trim();
    offset += symbolLength;
    
    const uriLength = data.readUInt32LE(offset);
    offset += 4;
    const uri = data.slice(offset, offset + uriLength).toString('utf8').replace(/\0/g, '').trim();
    
    return { name, symbol, uri };
  } catch {
    return null;
  }
}

// Transform URI for IPFS/Arweave
function transformUri(uri: string): string {
  if (!uri) return '';
  if (uri.startsWith('ipfs://')) {
    return IPFS_GATEWAYS[0] + uri.replace('ipfs://', '');
  }
  if (uri.startsWith('ar://')) {
    return 'https://arweave.net/' + uri.replace('ar://', '');
  }
  return uri;
}

// Fetch JSON metadata with timeout
async function fetchMetadataJSON(uri: string): Promise<any | null> {
  const fetchUri = transformUri(uri);
  
  // For IPFS, try multiple gateways
  if (uri.startsWith('ipfs://')) {
    const hash = uri.replace('ipfs://', '');
    for (const gateway of IPFS_GATEWAYS) {
      try {
        const response = await fetch(gateway + hash, { 
          signal: AbortSignal.timeout(8000) 
        });
        if (response.ok) return response.json();
      } catch {
        continue;
      }
    }
    return null;
  }
  
  try {
    const response = await fetch(fetchUri, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

// Main NFT fetch function
export async function fetchNFTs(walletAddress: string): Promise<NFT[]> {
  const network = getCurrentNetwork();
  const endpoints = NFT_RPC_ENDPOINTS[network];
  
  console.log(`Fetching NFTs for ${walletAddress} on ${network}`);
  
  for (const endpoint of endpoints) {
    try {
      console.log(`Trying NFT endpoint: ${endpoint}`);
      const conn = new Connection(endpoint, { commitment: 'confirmed' });
      
      // Get all token accounts
      const tokenAccounts = await Promise.race([
        conn.getParsedTokenAccountsByOwner(
          new PublicKey(walletAddress),
          { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
        ),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 20000)
        ),
      ]);
      
      console.log(`Found ${tokenAccounts.value.length} token accounts`);
      
      // Filter for NFTs (amount=1, decimals=0)
      const nftMints = tokenAccounts.value
        .filter((account) => {
          const info = account.account.data.parsed.info;
          return info.tokenAmount.decimals === 0 && info.tokenAmount.uiAmount === 1;
        })
        .map((account) => account.account.data.parsed.info.mint);
      
      console.log(`Found ${nftMints.length} potential NFT mints`);
      
      if (nftMints.length === 0) {
        return [];
      }
      
      // Limit to 30 NFTs for performance
      const mintsToFetch = nftMints.slice(0, 30);
      
      // Get metadata PDAs
      const metadataPDAs = mintsToFetch.map(mint => getMetadataPDA(new PublicKey(mint)));
      
      // Fetch all metadata accounts
      const metadataAccounts = await conn.getMultipleAccountsInfo(metadataPDAs);
      
      // Process each NFT
      const nftPromises = mintsToFetch.map(async (mint, index) => {
        try {
          const accountInfo = metadataAccounts[index];
          if (!accountInfo) return null;
          
          const onChainMeta = parseMetadata(accountInfo.data as Buffer);
          if (!onChainMeta || !onChainMeta.uri) return null;
          
          // Try to fetch off-chain metadata
          const jsonMeta = await fetchMetadataJSON(onChainMeta.uri);
          
          return {
            mint,
            name: jsonMeta?.name || onChainMeta.name || 'Unknown NFT',
            symbol: jsonMeta?.symbol || onChainMeta.symbol || '',
            image: transformUri(jsonMeta?.image || ''),
            description: jsonMeta?.description,
            attributes: jsonMeta?.attributes,
            collection: jsonMeta?.collection?.name,
          } as NFT;
        } catch {
          return null;
        }
      });
      
      const results = await Promise.all(nftPromises);
      const nfts = results.filter((nft): nft is NFT => nft !== null);
      
      console.log(`Successfully fetched ${nfts.length} NFTs`);
      return nfts;
      
    } catch (error) {
      console.warn(`Endpoint ${endpoint} failed:`, error);
      continue;
    }
  }
  
  console.error('All endpoints failed for NFT fetch');
  return [];
}

// Get NFT collection info from Magic Eden (mainnet only)
export async function getNFTCollectionInfo(collectionSymbol: string): Promise<{
  floorPrice?: number;
  listedCount?: number;
} | null> {
  if (getCurrentNetwork() !== 'mainnet') return null;
  
  try {
    const response = await fetch(
      `https://api-mainnet.magiceden.dev/v2/collections/${collectionSymbol}/stats`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      floorPrice: data.floorPrice ? data.floorPrice / 1e9 : undefined,
      listedCount: data.listedCount,
    };
  } catch {
    return null;
  }
}
