import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Copy, Check, QrCode } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import QRCode from "react-qr-code";

interface ReceiveModalProps {
  onClose: () => void;
  publicKey: string;
}

export function ReceiveModal({ onClose, publicKey }: ReceiveModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(publicKey);
    setCopied(true);
    toast({ title: "Copied!", description: "Address copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-md p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-display font-bold text-foreground">
            Receive SOL
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex flex-col items-center">
          <div className="bg-white p-4 rounded-2xl mb-6">
            <QRCode
              value={`solana:${publicKey}`}
              size={200}
              level="H"
              style={{ height: "auto", maxWidth: "100%", width: "100%" }}
            />
          </div>

          <p className="text-sm text-muted-foreground mb-4 text-center">
            Scan the QR code or copy the address below to receive SOL
          </p>

          <div className="w-full bg-secondary/50 border border-border rounded-xl p-4 mb-4">
            <p className="text-sm text-foreground font-mono break-all text-center">
              {publicKey}
            </p>
          </div>

          <Button
            variant="royal"
            size="lg"
            className="w-full"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy Address
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
