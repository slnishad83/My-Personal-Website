import { useEffect, useRef, useState, useCallback } from "react";
import { Call } from "@/types/call";
import { useWebRTC } from "@/hooks/useWebRTC";
import { endCall, addCallMessageToChat } from "@/services/callService";
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CallScreenProps {
  call: Call;
  role: "caller" | "callee";
  onEnd: () => void;
}

export function CallScreen({ call, role, onEnd }: CallScreenProps) {
  const { startCall, answerCall, toggleMute, toggleCamera, cleanup, getLocalStream, getRemoteStream } = useWebRTC();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const startTimeRef = useRef<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const handleRemoteStream = useCallback((stream: MediaStream) => {
    setRemoteStream(stream);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
    }
    setConnected(true);
    startTimeRef.current = Date.now();
  }, []);

  useEffect(() => {
    async function init() {
      if (role === "caller") {
        await startCall(call.id, call.type, handleRemoteStream);
      } else {
        if (call.offer) {
          await answerCall(call.id, call.type, call.offer, handleRemoteStream);
        }
      }
      // Set local video
      const local = getLocalStream();
      if (local && localVideoRef.current) {
        localVideoRef.current.srcObject = local;
      }
    }
    init().catch(console.error);
    return cleanup;
  }, []);

  // Attach remote stream if it's set after the ref mounts
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Timer
  useEffect(() => {
    if (!connected) return;
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [connected]);

  function formatElapsed(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  async function handleEnd() {
    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    cleanup();
    await endCall(call.id, connected ? duration : 0);
    await addCallMessageToChat(
      call.conversationId,
      call.callerId,
      call.callerName,
      call.type,
      connected ? "ended" : "missed",
      connected ? duration : null
    );
    onEnd();
  }

  function handleToggleMute() {
    const nowMuted = toggleMute();
    setMuted(nowMuted);
  }

  function handleToggleCamera() {
    const nowOff = toggleCamera();
    setCameraOff(nowOff);
  }

  const isVideo = call.type === "video";
  const otherName = role === "caller" ? call.calleeName : call.callerName;

  return (
    <div className={cn(
      "fixed inset-0 z-[100] flex flex-col",
      isVideo ? "bg-black" : "bg-[#1f2c34]"
    )}>
      {/* Video streams */}
      {isVideo && (
        <>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute bottom-28 right-4 w-32 h-44 object-cover rounded-2xl border-2 border-white/30 z-10"
          />
        </>
      )}

      {/* Voice call - avatar */}
      {!isVideo && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-28 h-28 rounded-full bg-[#00a884] flex items-center justify-center text-white text-5xl font-semibold mb-2">
            {otherName.charAt(0).toUpperCase()}
          </div>
          <p className="text-white text-2xl font-light">{otherName}</p>
          <p className="text-[#8696a0] text-sm">
            {connected ? formatElapsed(elapsed) : "Calling…"}
          </p>
        </div>
      )}

      {/* Video overlay info */}
      {isVideo && (
        <div className="relative z-10 px-6 pt-12">
          <p className="text-white text-xl font-light drop-shadow">{otherName}</p>
          <p className="text-white/70 text-sm drop-shadow">
            {connected ? formatElapsed(elapsed) : "Connecting…"}
          </p>
        </div>
      )}

      {/* Controls */}
      <div className={cn(
        "relative z-10 flex items-center justify-center gap-6 pb-14 pt-6",
        isVideo && "bg-gradient-to-t from-black/70 to-transparent"
      )}>
        <ControlButton
          icon={muted ? MicOff : Mic}
          label={muted ? "Unmute" : "Mute"}
          onClick={handleToggleMute}
          active={muted}
        />

        {isVideo && (
          <ControlButton
            icon={cameraOff ? VideoOff : Video}
            label={cameraOff ? "Show" : "Camera"}
            onClick={handleToggleCamera}
            active={cameraOff}
          />
        )}

        {!isVideo && (
          <ControlButton
            icon={Volume2}
            label="Speaker"
            onClick={() => {}}
          />
        )}

        <button
          onClick={handleEnd}
          className="w-16 h-16 rounded-full bg-[#f15c6d] flex items-center justify-center hover:bg-[#d94f5f] transition-colors"
        >
          <PhoneOff size={26} className="text-white" />
        </button>
      </div>
    </div>
  );
}

function ControlButton({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        onClick={onClick}
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
          active ? "bg-white text-gray-900" : "bg-white/20 text-white hover:bg-white/30"
        )}
      >
        <Icon size={22} />
      </button>
      <span className="text-white/70 text-[11px]">{label}</span>
    </div>
  );
}
