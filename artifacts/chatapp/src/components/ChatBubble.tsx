import { useState } from "react";
import { Message, Conversation } from "@/types/chat";
import { MessageTicks } from "./MessageTicks";
import { MessageInfo } from "./MessageInfo";
import { MediaBubble } from "./MediaBubble";
import { formatMessageTime } from "@/lib/utils";
import { computeMessageStatus } from "@/services/chatService";
import { cn } from "@/lib/utils";
import { Phone } from "lucide-react";

interface ChatBubbleProps {
  message: Message;
  conversation: Conversation;
  isOwn: boolean;
  showSenderName: boolean;
}

export function ChatBubble({ message, conversation, isOwn, showSenderName }: ChatBubbleProps) {
  const [showInfo, setShowInfo] = useState(false);
  const status = isOwn ? computeMessageStatus(message, conversation.participants) : null;
  const hasMedia = !!message.mediaURL && !!message.mediaType;
  const isImageOnly = hasMedia && message.mediaType === "image" && !message.text;

  // Call log pill — centred, no bubble
  if (message.isCallLog) {
    return (
      <div className="flex justify-center my-2">
        <div className="flex items-center gap-1.5 bg-[#fdf3c8] text-[#8b6914] text-xs px-3 py-1.5 rounded-lg shadow-sm">
          <Phone size={12} />
          <span>{message.text}</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={cn("flex mb-1", isOwn ? "justify-end" : "justify-start")}>
        {!isOwn && conversation.type === "group" && (
          <div className="w-8 h-8 rounded-full bg-[#00a884] flex items-center justify-center text-white text-xs font-medium mr-2 mt-1 flex-shrink-0 self-end">
            {message.senderName.charAt(0).toUpperCase()}
          </div>
        )}

        <div
          className={cn(
            "max-w-[70%] rounded-2xl shadow-sm relative overflow-hidden",
            // Image-only: no padding so image fills edge-to-edge
            isImageOnly ? "" : "px-3 pt-2 pb-1.5",
            isOwn
              ? "bg-[#d9fdd3] rounded-tr-sm"
              : "bg-white rounded-tl-sm"
          )}
          onContextMenu={(e) => {
            if (isOwn) { e.preventDefault(); setShowInfo(true); }
          }}
        >
          {/* Sender name in group */}
          {showSenderName && !isOwn && conversation.type === "group" && !isImageOnly && (
            <p className="text-xs font-semibold text-[#00a884] mb-0.5">{message.senderName}</p>
          )}

          {/* Media */}
          {hasMedia && (
            <div className={isImageOnly ? "" : "mb-1"}>
              <MediaBubble message={message} isOwn={isOwn} />
            </div>
          )}

          {/* Text (only if not image-only) */}
          {message.text && !(isImageOnly) && (
            <p className={cn(
              "text-sm text-gray-900 leading-relaxed whitespace-pre-wrap break-words",
              !hasMedia && "pr-12"
            )}>
              {message.text}
            </p>
          )}

          {/* Timestamp + ticks */}
          <div className={cn(
            "flex items-center justify-end gap-1",
            isImageOnly
              ? "absolute bottom-1.5 right-2 bg-black/40 rounded-full px-1.5 py-0.5"
              : "mt-0.5 -mb-0.5"
          )}>
            <span className={cn(
              "text-[11px]",
              isImageOnly ? "text-white" : "text-gray-400"
            )}>
              {formatMessageTime(message.createdAt)}
            </span>
            {isOwn && status && <MessageTicks status={status} />}
          </div>

          {isOwn && !isImageOnly && (
            <button
              className="absolute top-1 right-1 opacity-0 hover:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity text-[10px] px-1"
              onClick={() => setShowInfo(true)}
              title="Message info"
            >
              ▼
            </button>
          )}
        </div>
      </div>

      {showInfo && (
        <MessageInfo
          message={message}
          conversation={conversation}
          onClose={() => setShowInfo(false)}
        />
      )}
    </>
  );
}
