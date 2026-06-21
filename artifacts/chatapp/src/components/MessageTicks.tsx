import { cn } from "@/lib/utils";

interface MessageTicksProps {
  status: "sending" | "sent" | "delivered" | "read";
  className?: string;
}

export function MessageTicks({ status, className }: MessageTicksProps) {
  if (status === "sending") {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <svg width="16" height="11" viewBox="0 0 16 11" className="text-[#92a3b1]">
          <path d="M11.071.653a.8.8 0 0 0-1.142 0L5.422 5.16 3.571 3.309a.8.8 0 1 0-1.142 1.12l2.422 2.453a.8.8 0 0 0 1.142 0l5.078-5.107a.8.8 0 0 0 0-1.122z" fill="currentColor"/>
        </svg>
      </span>
    );
  }

  if (status === "sent") {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <svg width="16" height="11" viewBox="0 0 16 11" className="text-[#92a3b1]">
          <path d="M11.071.653a.8.8 0 0 0-1.142 0L5.422 5.16 3.571 3.309a.8.8 0 1 0-1.142 1.12l2.422 2.453a.8.8 0 0 0 1.142 0l5.078-5.107a.8.8 0 0 0 0-1.122z" fill="currentColor"/>
        </svg>
      </span>
    );
  }

  // delivered or read — double ticks
  const isBlue = status === "read";
  const color = isBlue ? "#53bdeb" : "#92a3b1";

  return (
    <span className={cn("inline-flex items-center", className)}>
      <svg width="18" height="11" viewBox="0 0 18 11" fill="none">
        <path
          d="M1.5 5.5L5.5 9.5L14.5 1.5"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6 5.5L10 9.5L18.5 1"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          transform="translate(-3, 0)"
        />
      </svg>
    </span>
  );
}
