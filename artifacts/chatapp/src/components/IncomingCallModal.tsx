import { Call } from "@/types/call";
import { Phone, PhoneOff, Video } from "lucide-react";

interface IncomingCallModalProps {
  call: Call;
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallModal({ call, onAccept, onReject }: IncomingCallModalProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center">
      <div className="bg-[#1f2c34] rounded-3xl px-8 py-10 flex flex-col items-center gap-6 shadow-2xl w-72">
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-full bg-[#00a884] flex items-center justify-center text-white text-3xl font-semibold">
            {call.callerName.charAt(0).toUpperCase()}
          </div>
          <div className="text-center">
            <p className="text-white font-semibold text-lg">{call.callerName}</p>
            <p className="text-[#8696a0] text-sm mt-0.5">
              Incoming {call.type === "video" ? "video" : "voice"} call…
            </p>
          </div>
        </div>

        <div className="flex items-center gap-10">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onReject}
              className="w-16 h-16 rounded-full bg-[#f15c6d] flex items-center justify-center hover:bg-[#d94f5f] transition-colors"
            >
              <PhoneOff size={26} className="text-white" />
            </button>
            <span className="text-[#8696a0] text-xs">Decline</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onAccept}
              className="w-16 h-16 rounded-full bg-[#00a884] flex items-center justify-center hover:bg-[#008069] transition-colors"
            >
              {call.type === "video" ? (
                <Video size={26} className="text-white" />
              ) : (
                <Phone size={26} className="text-white" />
              )}
            </button>
            <span className="text-[#8696a0] text-xs">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
}
