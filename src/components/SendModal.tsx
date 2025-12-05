import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Send, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatBalance, WalletData, getKeypairFromWallet, isValidSolanaAddress } from "@/lib/wallet";
import { sendSol, getCurrentNetwork } from "@/lib/solana";

interface SendModalProps {
  onClose: () => void;
  balance: number;
  wallet: WalletData;
  onSuccess?: () => void;
}

export function SendModal({ onClose, balance, wallet, onSuccess }: SendModalProps) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const handleSend = async () => {
    if (!recipient.trim()) {
      toast({
        title: "Error",
        description: "Please enter a recipient address",
        variant: "destructive",
      });
      return;
    }

    if (!isValidSolanaAddress(recipient.trim())) {
      toast({
        title: "Invalid address",
        description: "Please enter a valid Solana address",
        variant: "destructive",
      });
      return;
    }

    const sendAmount = parseFloat(amount);
    if (isNaN(sendAmount) || sendAmount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    if (sendAmount > balance) {
      toast({
        title: "Insufficient balance",
        description: "You don't have enough SOL",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const keypair = getKeypairFromWallet(wallet);
      const signature = await sendSol(keypair, recipient.trim(), sendAmount);
      setTxSignature(signature);
      toast({
        title: "Transaction sent!",
        description: `${sendAmount} SOL sent successfully`,
      });
      onSuccess?.();
    } catch (error: any) {
      console.error("Transaction failed:", error);
      toast({
        title: "Transaction failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const network = getCurrentNetwork();
  const explorerUrl = network === 'mainnet'
    ? `https://explorer.solana.com/tx/${txSignature}`
    : `https://explorer.solana.com/tx/${txSignature}?cluster=${network}`;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-md p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-display font-bold text-foreground">
            Send SOL
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {txSignature ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Transaction Successful!
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Your transaction has been confirmed on the blockchain.
            </p>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline text-sm"
            >
              View on Solana Explorer →
            </a>
            <Button
              variant="royal"
              className="w-full mt-6"
              onClick={onClose}
            >
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Recipient Address
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Enter Solana address..."
                className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              {recipient && !isValidSolanaAddress(recipient) && (
                <p className="text-xs text-destructive mt-1">Invalid Solana address</p>
              )}
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Amount (SOL)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.001"
                  min="0"
                  className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <button
                  onClick={() => setAmount((balance - 0.001).toFixed(6))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary hover:text-primary/80 font-medium"
                >
                  MAX
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Available: {formatBalance(balance * 1_000_000_000)} SOL
              </p>
            </div>

            <div className="bg-secondary/30 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Network fee: ~0.000005 SOL. Transaction cannot be reversed once confirmed.
                {network !== 'mainnet' && (
                  <span className="block mt-1 text-yellow-500">
                    You are on {network} - not real SOL!
                  </span>
                )}
              </p>
            </div>

            <Button
              variant="royal"
              size="lg"
              className="w-full"
              onClick={handleSend}
              disabled={isLoading || !recipient || !amount}
            >
              {isLoading ? (
                "Processing..."
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Transaction
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
