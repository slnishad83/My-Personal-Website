import { useState } from "react";
import { Message, Conversation } from "@/types/chat";
import { MessageTicks } from "./MessageTicks";
import { MessageInfo } from "./MessageInfo";
import { formatMessageTime } from "@/lib/utils";
import { computeMessageStatus } from "@/services/chatService";
import { cn } from "@/lib/utils";

interface ChatBubbleProps {
  message: Message;
  conversation: Conversation;
  isOwn: boolean;
  showSenderName: boolean;
}

export function ChatBubble({ message, conversation, isOwn, showSenderName }: ChatBubbleProps) {
  const [showInfo, setShowInfo] = useState(false);
  const status = isOwn ? computeMessageStatus(message, conversation.participants) : null;

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
            "max-w-[70%] px-3 pt-2 pb-1.5 rounded-2xl shadow-sm relative",
            isOwn
              ? "bg-[#d9fdd3] rounded-tr-sm"
              : "bg-white rounded-tl-sm"
          )}
          onContextMenu={(e) => {
            if (isOwn) {
              e.preventDefault();
              setShowInfo(true);
            }
          }}
        >
          {showSenderName && !isOwn && conversation.type === "group" && (
            <p className="text-xs font-semibold text-[#00a884] mb-0.5">{message.senderName}</p>
          )}
          <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap break-words pr-12">
            {message.text}
          </p>
          <div className="flex items-center justify-end gap-1 mt-0.5 -mb-0.5">
            <span className="text-[11px] text-gray-400">{formatMessageTime(message.createdAt)}</span>
            {isOwn && status && (
              <MessageTicks status={status} />
            )}
          </div>
          {isOwn && (
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
