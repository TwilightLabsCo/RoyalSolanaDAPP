import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Send, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatBalance } from "@/lib/wallet";

interface SendModalProps {
  onClose: () => void;
  balance: number;
}

export function SendModal({ onClose, balance }: SendModalProps) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!recipient.trim()) {
      toast({
        title: "Error",
        description: "Please enter a recipient address",
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
    // Simulate transaction
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsLoading(false);

    toast({
      title: "Transaction sent!",
      description: `${sendAmount} SOL sent successfully`,
    });
    onClose();
  };

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
                step="0.01"
                className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <button
                onClick={() => setAmount(balance.toString())}
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
            </p>
          </div>

          <Button
            variant="royal"
            size="lg"
            className="w-full"
            onClick={handleSend}
            disabled={isLoading}
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
      </div>
    </div>
  );
}
