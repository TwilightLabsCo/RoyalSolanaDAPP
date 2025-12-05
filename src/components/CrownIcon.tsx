import { cn } from "@/lib/utils";

interface CrownIconProps {
  className?: string;
  size?: number;
}

export function CrownIcon({ className, size = 48 }: CrownIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("crown-shadow", className)}
    >
      <defs>
        <linearGradient id="crownGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(45 93% 47%)" />
          <stop offset="50%" stopColor="hsl(45 100% 65%)" />
          <stop offset="100%" stopColor="hsl(45 93% 47%)" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d="M24 4L28 16L40 12L34 28H14L8 12L20 16L24 4Z"
        fill="url(#crownGradient)"
        filter="url(#glow)"
      />
      <path
        d="M14 28H34V32C34 33.1046 33.1046 34 32 34H16C14.8954 34 14 33.1046 14 32V28Z"
        fill="url(#crownGradient)"
      />
      <circle cx="24" cy="10" r="2" fill="hsl(217 91% 60%)" />
      <circle cx="16" cy="14" r="1.5" fill="hsl(217 91% 60%)" />
      <circle cx="32" cy="14" r="1.5" fill="hsl(217 91% 60%)" />
    </svg>
  );
}
