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

// Fetch JSON metadata from URI
async function fetchMetadataJSON(uri: string): Promise<NFTMetadata | null> {
  try {
    // Handle IPFS URIs
    let fetchUri = uri;
    if (uri.startsWith('ipfs://')) {
      fetchUri = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }
    
    const response = await fetch(fetchUri, { 
      signal: AbortSignal.timeout(5000) 
    });
    
    if (!response.ok) return null;
    
    const json = await response.json();
    
    // Handle IPFS image URLs
    let image = json.image || '';
    if (image.startsWith('ipfs://')) {
      image = image.replace('ipfs://', 'https://ipfs.io/ipfs/');
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

// Fetch all NFTs for a wallet
export async function fetchNFTs(walletAddress: string): Promise<NFT[]> {
  try {
    const connection = getConnection();
    const walletPubkey = new PublicKey(walletAddress);
    
    // Get all token accounts
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPubkey,
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );
    
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
    
    // Fetch metadata for each NFT
    const nfts: NFT[] = [];
    
    for (const mint of nftMints.slice(0, 50)) { // Limit to 50 NFTs
      try {
        const mintPubkey = new PublicKey(mint);
        const metadataPDA = getMetadataPDA(mintPubkey);
        
        const accountInfo = await connection.getAccountInfo(metadataPDA);
        if (!accountInfo) continue;
        
        const onChainMeta = parseMetadata(accountInfo.data);
        if (!onChainMeta) continue;
        
        // Fetch off-chain metadata
        const jsonMeta = await fetchMetadataJSON(onChainMeta.uri);
        
        nfts.push({
          mint,
          name: jsonMeta?.name || onChainMeta.name || 'Unknown NFT',
          symbol: jsonMeta?.symbol || onChainMeta.symbol || '',
          image: jsonMeta?.image || '',
          description: jsonMeta?.description,
          attributes: jsonMeta?.attributes,
          collection: jsonMeta?.collection?.name,
        });
      } catch (e) {
        console.error('Failed to fetch NFT metadata:', e);
      }
    }
    
    return nfts;
  } catch (error) {
    console.error('Failed to fetch NFTs:', error);
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
