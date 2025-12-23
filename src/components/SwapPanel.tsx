import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowDownUp, Search, Loader2, AlertCircle, ExternalLink, ChevronDown, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { WalletData, getKeypairFromWallet } from "@/lib/wallet";
import {
  getQuote,
  executeSwap,
  searchTokens,
  COMMON_TOKENS,
  JupiterToken,
  QuoteResponse,
  formatTokenAmount,
} from "@/lib/jupiter";
import { getBalance, getCurrentNetwork } from "@/lib/solana";

interface SwapPanelProps {
  wallet: WalletData;
  onSuccess?: () => void;
}

const DEFAULT_TOKENS: { symbol: string; address: string; decimals: number; logoURI?: string }[] = [
  { symbol: 'SOL', address: COMMON_TOKENS.SOL, decimals: 9, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png' },
  { symbol: 'USDC', address: COMMON_TOKENS.USDC, decimals: 6, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png' },
  { symbol: 'USDT', address: COMMON_TOKENS.USDT, decimals: 6, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg' },
  { symbol: 'BONK', address: COMMON_TOKENS.BONK, decimals: 5, logoURI: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I' },
  { symbol: 'JUP', address: COMMON_TOKENS.JUP, decimals: 6, logoURI: 'https://static.jup.ag/jup/icon.png' },
  { symbol: 'WIF', address: COMMON_TOKENS.WIF, decimals: 6, logoURI: 'https://bafkreibk3covs5ltyqxa272uodhculbr6kea6betiez7uzivtkbpbtlrxm.ipfs.cf-ipfs.com' },
];

export function SwapPanel({ wallet, onSuccess }: SwapPanelProps) {
  const [inputToken, setInputToken] = useState(DEFAULT_TOKENS[0]);
  const [outputToken, setOutputToken] = useState(DEFAULT_TOKENS[1]);
  const [inputAmount, setInputAmount] = useState("");
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [slippage, setSlippage] = useState(50); // 0.5%
  const [showTokenSelect, setShowTokenSelect] = useState<'input' | 'output' | null>(null);
  const [tokenSearch, setTokenSearch] = useState("");
  const [searchResults, setSearchResults] = useState<JupiterToken[]>([]);
  const [balance, setBalance] = useState(0);
  
  const network = getCurrentNetwork();
  const isMainnet = network === 'mainnet';

  useEffect(() => {
    getBalance(wallet.publicKey).then(b => setBalance(b / 1e9));
  }, [wallet.publicKey]);

  const fetchQuote = useCallback(async () => {
    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      setQuote(null);
      return;
    }

    setIsLoadingQuote(true);
    try {
      const amountIn = Math.round(parseFloat(inputAmount) * Math.pow(10, inputToken.decimals));
      const quoteResult = await getQuote(
        inputToken.address,
        outputToken.address,
        amountIn,
        slippage
      );
      setQuote(quoteResult);
    } catch (error) {
      console.error('Quote error:', error);
      setQuote(null);
    } finally {
      setIsLoadingQuote(false);
    }
  }, [inputAmount, inputToken, outputToken, slippage]);

  useEffect(() => {
    const debounce = setTimeout(fetchQuote, 500);
    return () => clearTimeout(debounce);
  }, [fetchQuote]);

  const handleSearchTokens = async (query: string) => {
    setTokenSearch(query);
    if (query.length >= 2) {
      const results = await searchTokens(query);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const handleSelectToken = (token: JupiterToken, type: 'input' | 'output') => {
    const tokenData = {
      symbol: token.symbol,
      address: token.address,
      decimals: token.decimals,
      logoURI: token.logoURI,
    };
    
    if (type === 'input') {
      setInputToken(tokenData);
    } else {
      setOutputToken(tokenData);
    }
    setShowTokenSelect(null);
    setTokenSearch("");
    setSearchResults([]);
  };

  const handleSwapTokens = () => {
    const temp = inputToken;
    setInputToken(outputToken);
    setOutputToken(temp);
    setInputAmount("");
    setQuote(null);
  };

  const handleSwap = async () => {
    if (!quote) return;

    setIsSwapping(true);
    try {
      const keypair = getKeypairFromWallet(wallet);
      const signature = await executeSwap(quote, wallet.publicKey, keypair);
      
      toast({
        title: "Swap successful!",
        description: (
          <a 
            href={`https://solscan.io/tx/${signature}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline"
          >
            View on Solscan <ExternalLink className="w-3 h-3" />
          </a>
        ),
      });
      
      setInputAmount("");
      setQuote(null);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Swap failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSwapping(false);
    }
  };

  const outputAmount = quote 
    ? formatTokenAmount(quote.outAmount, outputToken.decimals)
    : "0";

  const priceImpact = quote ? parseFloat(quote.priceImpactPct) : 0;
  const isHighPriceImpact = priceImpact > 1;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Mainnet Warning */}
      {!isMainnet && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-500">Mainnet Only</p>
            <p className="text-sm text-muted-foreground">
              Jupiter swap is only available on mainnet. Switch to mainnet in settings to use this feature.
            </p>
          </div>
        </div>
      )}

      <div className={`glass-card p-6 glow-soft ${!isMainnet ? 'opacity-60 pointer-events-none' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display font-semibold text-foreground">
            Jupiter Swap
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Slippage:</span>
            <select
              value={slippage}
              onChange={(e) => setSlippage(parseInt(e.target.value))}
              className="bg-secondary/50 border border-border rounded-lg px-2 py-1 text-xs text-foreground"
            >
              <option value={10}>0.1%</option>
              <option value={50}>0.5%</option>
              <option value={100}>1%</option>
              <option value={300}>3%</option>
            </select>
          </div>
        </div>

        {/* Input Token */}
        <div className="bg-secondary/30 rounded-xl p-4 mb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">You pay</span>
            {inputToken.symbol === 'SOL' && (
              <span className="text-xs text-muted-foreground">
                Balance: {balance.toFixed(4)} SOL
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 bg-transparent text-2xl font-bold text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button
              onClick={() => setShowTokenSelect('input')}
              className="flex items-center gap-2 bg-secondary/50 hover:bg-secondary/80 px-3 py-2 rounded-xl transition-colors"
            >
              {inputToken.logoURI && (
                <img src={inputToken.logoURI} alt={inputToken.symbol} className="w-6 h-6 rounded-full" />
              )}
              <span className="font-medium text-foreground">{inputToken.symbol}</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Swap Arrow */}
        <div className="flex justify-center -my-2 relative z-10">
          <button
            onClick={handleSwapTokens}
            className="bg-primary p-2 rounded-full hover:bg-primary/80 transition-colors shadow-lg"
          >
            <ArrowDownUp className="w-4 h-4 text-primary-foreground" />
          </button>
        </div>

        {/* Output Token */}
        <div className="bg-secondary/30 rounded-xl p-4 mt-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">You receive</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 text-2xl font-bold text-foreground">
              {isLoadingQuote ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                outputAmount
              )}
            </div>
            <button
              onClick={() => setShowTokenSelect('output')}
              className="flex items-center gap-2 bg-secondary/50 hover:bg-secondary/80 px-3 py-2 rounded-xl transition-colors"
            >
              {outputToken.logoURI && (
                <img src={outputToken.logoURI} alt={outputToken.symbol} className="w-6 h-6 rounded-full" />
              )}
              <span className="font-medium text-foreground">{outputToken.symbol}</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Quote Details */}
        {quote && (
          <div className="mt-4 p-3 bg-secondary/20 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Price Impact</span>
              <span className={isHighPriceImpact ? "text-destructive" : "text-foreground"}>
                {priceImpact.toFixed(2)}%
                {isHighPriceImpact && <AlertCircle className="w-3 h-3 inline ml-1" />}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Route</span>
              <span className="text-foreground text-xs">
                {quote.routePlan?.length || 1} hop(s)
              </span>
            </div>
          </div>
        )}

        {/* Swap Button */}
        <Button
          variant="royal"
          size="lg"
          className="w-full mt-4"
          onClick={handleSwap}
          disabled={!quote || isSwapping || isLoadingQuote}
        >
          {isSwapping ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Swapping...
            </>
          ) : !inputAmount ? (
            "Enter an amount"
          ) : !quote ? (
            "Fetching quote..."
          ) : (
            "Swap"
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground mt-3">
          Powered by Jupiter Aggregator
        </p>
      </div>

      {/* Token Select Modal */}
      {showTokenSelect && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-6 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-display font-semibold text-foreground">
                Select Token
              </h3>
              <button
                onClick={() => {
                  setShowTokenSelect(null);
                  setTokenSearch("");
                  setSearchResults([]);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={tokenSearch}
                onChange={(e) => handleSearchTokens(e.target.value)}
                placeholder="Search by name or paste address"
                className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1">
              {/* Popular Tokens */}
              {!tokenSearch && (
                <>
                  <p className="text-xs text-muted-foreground mb-2">Popular tokens</p>
                  {DEFAULT_TOKENS.map((token) => (
                    <button
                      key={token.address}
                      onClick={() => handleSelectToken(token as JupiterToken, showTokenSelect)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors"
                    >
                      {token.logoURI && (
                        <img src={token.logoURI} alt={token.symbol} className="w-8 h-8 rounded-full" />
                      )}
                      <div className="text-left">
                        <p className="font-medium text-foreground">{token.symbol}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {token.address.slice(0, 8)}...{token.address.slice(-8)}
                        </p>
                      </div>
                    </button>
                  ))}
                </>
              )}

              {/* Search Results */}
              {searchResults.map((token) => (
                <button
                  key={token.address}
                  onClick={() => handleSelectToken(token, showTokenSelect)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors"
                >
                  {token.logoURI && (
                    <img 
                      src={token.logoURI} 
                      alt={token.symbol} 
                      className="w-8 h-8 rounded-full"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div className="text-left flex-1">
                    <p className="font-medium text-foreground">{token.symbol}</p>
                    <p className="text-xs text-muted-foreground">{token.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
