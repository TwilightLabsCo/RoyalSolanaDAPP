import { useState, useEffect } from "react";
import { WalletData } from "@/lib/wallet";
import { NFT, fetchNFTs } from "@/lib/nft";
import { getCurrentNetwork } from "@/lib/solana";
import { Button } from "@/components/ui/button";
import { 
  Image, 
  Loader2, 
  RefreshCw, 
  ExternalLink, 
  Grid3X3, 
  LayoutGrid,
  X
} from "lucide-react";

interface NFTGalleryProps {
  wallet: WalletData;
}

export function NFTGallery({ wallet }: NFTGalleryProps) {
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'large'>('grid');
  
  const network = getCurrentNetwork();

  const loadNFTs = async () => {
    setIsLoading(true);
    try {
      const fetchedNFTs = await fetchNFTs(wallet.publicKey);
      setNfts(fetchedNFTs);
    } catch (error) {
      console.error('Failed to load NFTs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNFTs();
  }, [wallet.publicKey, network]);

  const getExplorerUrl = (mint: string) => {
    const cluster = network === 'mainnet' ? '' : `?cluster=${network}`;
    return `https://solscan.io/token/${mint}${cluster}`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="glass-card p-6 glow-soft">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Image className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-display font-semibold text-foreground">
              NFT Collection
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode(viewMode === 'grid' ? 'large' : 'grid')}
            >
              {viewMode === 'grid' ? (
                <LayoutGrid className="w-4 h-4" />
              ) : (
                <Grid3X3 className="w-4 h-4" />
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={loadNFTs} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-secondary/30 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{nfts.length}</p>
            <p className="text-xs text-muted-foreground">Total NFTs</p>
          </div>
          <div className="bg-secondary/30 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-accent">
              {new Set(nfts.map(n => n.collection).filter(Boolean)).size}
            </p>
            <p className="text-xs text-muted-foreground">Collections</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Connected to {network.charAt(0).toUpperCase() + network.slice(1)}
        </p>
      </div>

      {/* NFT Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading NFTs...</p>
        </div>
      ) : nfts.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Image className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-2">No NFTs Found</h3>
          <p className="text-muted-foreground text-sm">
            {network === 'mainnet' 
              ? "You don't own any NFTs on mainnet yet."
              : `No NFTs found on ${network}. Try switching to mainnet.`}
          </p>
        </div>
      ) : (
        <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
          {nfts.map((nft) => (
            <button
              key={nft.mint}
              onClick={() => setSelectedNFT(nft)}
              className="glass-card overflow-hidden hover:border-primary/50 transition-all group"
            >
              <div className={`relative ${viewMode === 'grid' ? 'aspect-square' : 'aspect-video'}`}>
                {nft.image ? (
                  <img
                    src={nft.image}
                    alt={nft.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder.svg';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-secondary/50 flex items-center justify-center">
                    <Image className="w-12 h-12 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="p-3">
                <p className="font-medium text-foreground truncate">{nft.name}</p>
                {nft.collection && (
                  <p className="text-xs text-muted-foreground truncate">{nft.collection}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* NFT Detail Modal */}
      {selectedNFT && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedNFT(null)}
        >
          <div 
            className="glass-card max-w-lg w-full max-h-[90vh] overflow-y-auto glow-soft"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <button
                onClick={() => setSelectedNFT(null)}
                className="absolute top-3 right-3 z-10 p-2 bg-background/80 rounded-full hover:bg-background transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              {selectedNFT.image ? (
                <img
                  src={selectedNFT.image}
                  alt={selectedNFT.name}
                  className="w-full aspect-square object-cover rounded-t-xl"
                />
              ) : (
                <div className="w-full aspect-square bg-secondary/50 flex items-center justify-center rounded-t-xl">
                  <Image className="w-24 h-24 text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-xl font-display font-bold text-foreground">
                  {selectedNFT.name}
                </h3>
                {selectedNFT.collection && (
                  <p className="text-sm text-primary">{selectedNFT.collection}</p>
                )}
              </div>

              {selectedNFT.description && (
                <p className="text-sm text-muted-foreground">
                  {selectedNFT.description}
                </p>
              )}

              {selectedNFT.attributes && selectedNFT.attributes.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Attributes</p>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedNFT.attributes.map((attr, idx) => (
                      <div key={idx} className="bg-secondary/30 rounded-lg p-2">
                        <p className="text-xs text-muted-foreground">{attr.trait_type}</p>
                        <p className="text-sm font-medium text-foreground truncate">
                          {attr.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <a
                  href={getExplorerUrl(selectedNFT.mint)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl transition-colors"
                >
                  View on Solscan <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              <p className="text-xs text-muted-foreground text-center break-all">
                {selectedNFT.mint}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
