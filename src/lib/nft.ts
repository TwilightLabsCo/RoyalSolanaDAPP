import { Connection, PublicKey } from '@solana/web3.js';
import { getConnection, getCurrentNetwork } from './solana';

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
];

// Fetch JSON metadata from URI with fallback gateways
async function fetchMetadataJSON(uri: string): Promise<NFTMetadata | null> {
  try {
    let fetchUri = uri;
    
    // Handle IPFS URIs with gateway fallbacks
    if (uri.startsWith('ipfs://')) {
      const ipfsHash = uri.replace('ipfs://', '');
      
      // Try each gateway
      for (const gateway of IPFS_GATEWAYS) {
        try {
          const response = await fetch(gateway + ipfsHash, { 
            signal: AbortSignal.timeout(5000) 
          });
          if (response.ok) {
            const json = await response.json();
            let image = json.image || '';
            if (image.startsWith('ipfs://')) {
              image = IPFS_GATEWAYS[0] + image.replace('ipfs://', '');
            }
            return {
              name: json.name || 'Unknown',
              symbol: json.symbol || '',
              image,
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
      signal: AbortSignal.timeout(5000) 
    });
    
    if (!response.ok) return null;
    
    const json = await response.json();
    
    // Handle IPFS image URLs
    let image = json.image || '';
    if (image.startsWith('ipfs://')) {
      image = IPFS_GATEWAYS[0] + image.replace('ipfs://', '');
    }
    
    return {
      name: json.name || 'Unknown',
      symbol: json.symbol || '',
      image,
      description: json.description,
      attributes: json.attributes,
      collection: json.collection,
    };
  } catch {
    return null;
  }
}

// Fetch all NFTs for a wallet with retry logic
export async function fetchNFTs(walletAddress: string, retries = 2): Promise<NFT[]> {
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
          setTimeout(() => reject(new Error('Timeout')), 15000)
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
      
      // Batch fetch metadata PDAs
      const mintsToFetch = nftMints.slice(0, 50);
      const metadataPDAs = mintsToFetch.map(mint => getMetadataPDA(new PublicKey(mint)));
      
      // Fetch all account infos in one batch
      const accountInfos = await connection.getMultipleAccountsInfo(metadataPDAs);
      
      // Parse and fetch off-chain metadata in parallel
      const nftPromises = mintsToFetch.map(async (mint, index) => {
        try {
          const accountInfo = accountInfos[index];
          if (!accountInfo) return null;
          
          const onChainMeta = parseMetadata(accountInfo.data);
          if (!onChainMeta) return null;
          
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
      
      const results = await Promise.all(nftPromises);
      return results.filter((nft): nft is NFT => nft !== null);
      
    } catch (error) {
      console.error(`Failed to fetch NFTs (attempt ${attempt + 1}):`, error);
      if (attempt < retries) {
        const { tryNextEndpoint } = await import('./solana');
        await tryNextEndpoint();
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
      return [];
    }
  }
  return [];
}

// Get NFT floor price from Magic Eden API (mainnet only)
export async function getNFTCollectionInfo(collectionSymbol: string): Promise<{
  floorPrice?: number;
  listedCount?: number;
} | null> {
  if (getCurrentNetwork() !== 'mainnet') return null;
  
  try {
    const response = await fetch(
      `https://api-mainnet.magiceden.dev/v2/collections/${collectionSymbol}/stats`
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
