import { useState, useRef, useEffect } from "react";
import { Conversation, Message } from "@/types/chat";
import { ChatBubble } from "./ChatBubble";
import { MessageInfo } from "./MessageInfo";
import { useMessages } from "@/hooks/useMessages";
import { sendMessage } from "@/services/chatService";
import { Send, ArrowLeft, Phone, Video } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatMessageTime } from "@/lib/utils";
import { CallType } from "@/types/call";

interface ChatWindowProps {
  conversation: Conversation;
  onBack?: () => void;
  onStartCall?: (type: CallType) => void;
}

export function ChatWindow({ conversation, onBack, onStartCall }: ChatWindowProps) {
  const { currentUser } = useAuth();
  const { messages, loading } = useMessages(conversation.id, currentUser?.uid);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const otherUid = conversation.type === "personal"
    ? conversation.participants.find((p) => p !== currentUser?.uid)
    : null;
  const otherParticipant = otherUid ? conversation.participantDetails[otherUid] : null;

  function getTitle(): string {
    if (conversation.type === "group") return conversation.name ?? "Group";
    return otherParticipant?.displayName ?? "Chat";
  }

  function getSubtitle(): string {
    if (conversation.type === "group") {
      return conversation.participants
        .map((uid) => conversation.participantDetails[uid]?.displayName ?? uid)
        .join(", ");
    }
    return otherParticipant?.isOnline ? "online" : "offline";
  }

  async function handleSend() {
    if (!text.trim() || !currentUser) return;
    const t = text.trim();
    setText("");
    setSending(true);
    try {
      await sendMessage(
        conversation.id,
        currentUser.uid,
        currentUser.displayName ?? "Unknown",
        currentUser.photoURL,
        t,
        conversation.participants
      );
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const grouped: { date: string; messages: Message[] }[] = [];
  for (const msg of messages) {
    const dateKey = msg.createdAt.toLocaleDateString([], {
      weekday: "long", month: "long", day: "numeric",
    });
    const last = grouped[grouped.length - 1];
    if (last && last.date === dateKey) {
      last.messages.push(msg);
    } else {
      grouped.push({ date: dateKey, messages: [msg] });
    }
  }

  const isPersonal = conversation.type === "personal";

  return (
    <div
      className="flex flex-col h-full bg-[#efeae2]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c9c0b3' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#008069] text-white shadow-sm flex-shrink-0">
        {onBack && (
          <button onClick={onBack} className="mr-1 hover:opacity-80">
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
          {getTitle().charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight">{getTitle()}</p>
          <p className={`text-xs leading-tight truncate ${otherParticipant?.isOnline ? "text-[#a8d5ca]" : "text-[#c5ddd8]"}`}>
            {getSubtitle()}
          </p>
        </div>
        {/* Call buttons — only for 1-on-1 chats */}
        {isPersonal && onStartCall && (
          <div className="flex items-center gap-1">
            <button
              className="w-9 h-9 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
              onClick={() => onStartCall("voice")}
              title="Voice call"
            >
              <Phone size={18} />
            </button>
            <button
              className="w-9 h-9 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
              onClick={() => onStartCall("video")}
              title="Video call"
            >
              <Video size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="bg-[#fdf3c8] text-[#8b6914] text-xs px-4 py-2 rounded-lg shadow-sm">
              No messages yet. Say hi!
            </div>
          </div>
        )}
        {grouped.map((group) => (
          <div key={group.date}>
            <div className="flex justify-center my-3">
              <span className="bg-[#fdf3c8] text-[#8b6914] text-[11px] px-3 py-1 rounded-lg shadow-sm">
                {group.date}
              </span>
            </div>
            {group.messages.map((msg, i) => {
              const isOwn = msg.senderId === currentUser?.uid;
              const prevMsg = group.messages[i - 1];
              const showSenderName = !prevMsg || prevMsg.senderId !== msg.senderId;
              return (
                <div
                  key={msg.id}
                  onDoubleClick={() => isOwn ? setSelectedMessage(msg) : undefined}
                >
                  <ChatBubble
                    message={msg}
                    conversation={conversation}
                    isOwn={isOwn}
                    showSenderName={showSenderName}
                  />
                </div>
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 px-3 py-3 bg-[#f0f2f5] flex-shrink-0">
        <div className="flex-1 bg-white rounded-3xl px-4 py-2 shadow-sm min-h-[44px] flex items-end">
          <textarea
            ref={inputRef}
            className="w-full bg-transparent text-sm outline-none resize-none max-h-32 leading-relaxed placeholder:text-gray-400"
            placeholder="Type a message"
            rows={1}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px";
            }}
            onKeyDown={handleKeyDown}
          />
        </div>
        <button
          className="w-11 h-11 rounded-full bg-[#00a884] flex items-center justify-center text-white shadow-sm disabled:opacity-50 hover:bg-[#008069] transition-colors flex-shrink-0"
          onClick={handleSend}
          disabled={!text.trim() || sending}
        >
          <Send size={18} className="translate-x-0.5" />
        </button>
      </div>

      {selectedMessage && (
        <MessageInfo
          message={selectedMessage}
          conversation={conversation}
          onClose={() => setSelectedMessage(null)}
        />
      )}
    </div>
  );
}
