import { PublicKey } from '@solana/web3.js';
import { getConnection, getCurrentNetwork, tryNextEndpoint, NetworkType } from './solana';

export interface NFTMetadata {
  name: string;
  symbol: string;
  image: string;
  description?: string;
  attributes?: Array<{ trait_type: string; value: string }>;
  collection?: { name: string; family?: string };
}

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

// Network-specific DAS API endpoints for better NFT fetching
const DAS_ENDPOINTS: Record<NetworkType, string | null> = {
  mainnet: 'https://mainnet.helius-rpc.com/?api-key=1d8740dc-e5f4-421c-b823-e1bad1889eff',
  devnet: 'https://devnet.helius-rpc.com/?api-key=1d8740dc-e5f4-421c-b823-e1bad1889eff',
  testnet: 'https://testnet.helius-rpc.com/?api-key=1d8740dc-e5f4-421c-b823-e1bad1889eff',
};

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
    // Skip the first byte (key) and 32 bytes (update authority)
    let offset = 1 + 32;
    
    // Read mint (32 bytes)
    offset += 32;
    
    // Read name length and name
    const nameLength = data.readUInt32LE(offset);
    offset += 4;
    const name = data.slice(offset, offset + nameLength).toString('utf8').replace(/\0/g, '').trim();
    offset += nameLength;
    
    // Read symbol length and symbol
    const symbolLength = data.readUInt32LE(offset);
    offset += 4;
    const symbol = data.slice(offset, offset + symbolLength).toString('utf8').replace(/\0/g, '').trim();
    offset += symbolLength;
    
    // Read uri length and uri
    const uriLength = data.readUInt32LE(offset);
    offset += 4;
    const uri = data.slice(offset, offset + uriLength).toString('utf8').replace(/\0/g, '').trim();
    
    return { name, symbol, uri };
  } catch (e) {
    return null;
  }
}

// IPFS gateways to try in order
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://dweb.link/ipfs/',
  'https://nftstorage.link/ipfs/',
];

// Arweave gateway
const ARWEAVE_GATEWAY = 'https://arweave.net/';

// Transform URI to use proper gateways
function transformUri(uri: string): string {
  if (!uri) return '';
  
  // Handle IPFS
  if (uri.startsWith('ipfs://')) {
    return IPFS_GATEWAYS[0] + uri.replace('ipfs://', '');
  }
  
  // Handle Arweave
  if (uri.startsWith('ar://')) {
    return ARWEAVE_GATEWAY + uri.replace('ar://', '');
  }
  
  return uri;
}

// Fetch JSON metadata from URI with fallback gateways
async function fetchMetadataJSON(uri: string): Promise<NFTMetadata | null> {
  try {
    let fetchUri = transformUri(uri);
    
    // Handle IPFS URIs with gateway fallbacks
    if (uri.startsWith('ipfs://')) {
      const ipfsHash = uri.replace('ipfs://', '');
      
      // Try each gateway
      for (const gateway of IPFS_GATEWAYS) {
        try {
          const response = await fetch(gateway + ipfsHash, { 
            signal: AbortSignal.timeout(8000) 
          });
          if (response.ok) {
            const json = await response.json();
            return {
              name: json.name || 'Unknown',
              symbol: json.symbol || '',
              image: transformUri(json.image || ''),
              description: json.description,
              attributes: json.attributes,
              collection: json.collection,
            };
          }
        } catch {
          continue;
        }
      }
      return null;
    }
    
    // Regular HTTP URIs
    const response = await fetch(fetchUri, { 
      signal: AbortSignal.timeout(8000) 
    });
    
    if (!response.ok) return null;
    
    const json = await response.json();
    
    return {
      name: json.name || 'Unknown',
      symbol: json.symbol || '',
      image: transformUri(json.image || ''),
      description: json.description,
      attributes: json.attributes,
      collection: json.collection,
    };
  } catch {
    return null;
  }
}

// Fetch NFTs using Helius DAS API (Digital Asset Standard) - more reliable for all networks
async function fetchNFTsWithDAS(walletAddress: string): Promise<NFT[]> {
  const network = getCurrentNetwork();
  const endpoint = DAS_ENDPOINTS[network];
  
  if (!endpoint) {
    console.log('DAS not available for', network);
    return [];
  }
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'royal-wallet',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: walletAddress,
          page: 1,
          limit: 100,
          displayOptions: {
            showCollectionMetadata: true,
            showFungible: false,
            showNativeBalance: false,
          },
        },
      }),
      signal: AbortSignal.timeout(20000),
    });
    
    if (!response.ok) {
      throw new Error(`DAS API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }
    
    const items = data.result?.items || [];
    
    return items
      .filter((item: any) => item.interface === 'V1_NFT' || item.interface === 'ProgrammableNFT')
      .map((item: any) => ({
        mint: item.id,
        name: item.content?.metadata?.name || 'Unknown NFT',
        symbol: item.content?.metadata?.symbol || '',
        image: item.content?.links?.image || item.content?.files?.[0]?.uri || '',
        description: item.content?.metadata?.description,
        attributes: item.content?.metadata?.attributes,
        collection: item.grouping?.find((g: any) => g.group_key === 'collection')?.group_value 
          || item.content?.metadata?.collection?.name,
      }));
  } catch (error) {
    console.error('DAS fetch failed:', error);
    return [];
  }
}

// Fallback: Fetch NFTs using traditional RPC method
async function fetchNFTsWithRPC(walletAddress: string, retries = 3): Promise<NFT[]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const connection = getConnection();
      const walletPubkey = new PublicKey(walletAddress);
      
      // Get all token accounts with timeout
      const tokenAccounts = await Promise.race([
        connection.getParsedTokenAccountsByOwner(
          walletPubkey,
          { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
        ),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 20000)
        )
      ]);
      
      // Filter for NFTs (amount = 1, decimals = 0)
      const nftMints = tokenAccounts.value
        .filter((account) => {
          const info = account.account.data.parsed.info;
          return (
            info.tokenAmount.decimals === 0 &&
            info.tokenAmount.uiAmount === 1
          );
        })
        .map((account) => account.account.data.parsed.info.mint);
      
      if (nftMints.length === 0) return [];
      
      // Batch fetch metadata PDAs (limit to 50 for performance)
      const mintsToFetch = nftMints.slice(0, 50);
      const metadataPDAs = mintsToFetch.map(mint => getMetadataPDA(new PublicKey(mint)));
      
      // Fetch all account infos in batches of 100
      const batchSize = 100;
      const allAccountInfos: (any | null)[] = [];
      
      for (let i = 0; i < metadataPDAs.length; i += batchSize) {
        const batch = metadataPDAs.slice(i, i + batchSize);
        const infos = await connection.getMultipleAccountsInfo(batch);
        allAccountInfos.push(...infos);
      }
      
      // Parse on-chain metadata and get URIs
      const nftDataPromises = mintsToFetch.map(async (mint, index) => {
        try {
          const accountInfo = allAccountInfos[index];
          if (!accountInfo) return null;
          
          const onChainMeta = parseMetadata(accountInfo.data);
          if (!onChainMeta || !onChainMeta.uri) return null;
          
          // Fetch off-chain metadata
          const jsonMeta = await fetchMetadataJSON(onChainMeta.uri);
          
          return {
            mint,
            name: jsonMeta?.name || onChainMeta.name || 'Unknown NFT',
            symbol: jsonMeta?.symbol || onChainMeta.symbol || '',
            image: jsonMeta?.image || '',
            description: jsonMeta?.description,
            attributes: jsonMeta?.attributes,
            collection: jsonMeta?.collection?.name,
          } as NFT;
        } catch {
          return null;
        }
      });
      
      const results = await Promise.all(nftDataPromises);
      return results.filter((nft): nft is NFT => nft !== null);
      
    } catch (error) {
      console.error(`Failed to fetch NFTs (attempt ${attempt + 1}):`, error);
      if (attempt < retries) {
        await tryNextEndpoint();
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      return [];
    }
  }
  return [];
}

// Main fetch function - tries DAS first, falls back to RPC
export async function fetchNFTs(walletAddress: string): Promise<NFT[]> {
  const network = getCurrentNetwork();
  console.log(`Fetching NFTs for ${walletAddress} on ${network}`);
  
  // Try DAS API first (works on all networks with Helius)
  try {
    const dasNFTs = await fetchNFTsWithDAS(walletAddress);
    
    if (dasNFTs.length > 0) {
      console.log(`Found ${dasNFTs.length} NFTs via DAS`);
      return dasNFTs;
    }
  } catch (error) {
    console.warn('DAS API failed, falling back to RPC:', error);
  }
  
  // Fallback to RPC method for all networks
  console.log('Falling back to RPC method for NFTs');
  try {
    const rpcNFTs = await fetchNFTsWithRPC(walletAddress);
    console.log(`Found ${rpcNFTs.length} NFTs via RPC`);
    return rpcNFTs;
  } catch (error) {
    console.error('RPC NFT fetch also failed:', error);
    return [];
  }
}

// Get NFT floor price from Magic Eden API (mainnet only)
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
