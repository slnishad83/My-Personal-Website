import { Conversation } from "@/types/chat";
import { formatTime } from "@/lib/utils";
import { MessageTicks } from "./MessageTicks";
import { computeMessageStatus } from "@/services/chatService";
import { cn } from "@/lib/utils";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  currentUid: string;
  onSelect: (id: string) => void;
}

export function ConversationList({
  conversations,
  selectedId,
  currentUid,
  onSelect,
}: ConversationListProps) {
  function getDisplayName(conv: Conversation): string {
    if (conv.type === "group") return conv.name ?? "Group";
    const otherUid = conv.participants.find((p) => p !== currentUid);
    if (!otherUid) return "Chat";
    return conv.participantDetails[otherUid]?.displayName ?? "Unknown";
  }

  function getAvatarLetter(conv: Conversation): string {
    return getDisplayName(conv).charAt(0).toUpperCase();
  }

  function isOtherOnline(conv: Conversation): boolean {
    if (conv.type === "group") return false;
    const otherUid = conv.participants.find((p) => p !== currentUid);
    return otherUid ? (conv.participantDetails[otherUid]?.isOnline ?? false) : false;
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400">
        <p className="text-sm">No conversations yet</p>
        <p className="text-xs mt-1">Start a new chat below</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {conversations.map((conv) => {
        const unread = conv.unreadCount[currentUid] ?? 0;
        const isMine = conv.lastMessageSenderId === currentUid;
        const isSelected = conv.id === selectedId;

        return (
          <button
            key={conv.id}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 hover:bg-[#f0f2f5] transition-colors text-left",
              isSelected && "bg-[#f0f2f5]"
            )}
            onClick={() => onSelect(conv.id)}
          >
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-[#00a884] flex items-center justify-center text-white font-semibold text-lg">
                {getAvatarLetter(conv)}
              </div>
              {isOtherOnline(conv) && (
                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#00a884] rounded-full border-2 border-white" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-sm font-semibold text-gray-900 truncate">{getDisplayName(conv)}</p>
                <span className={cn("text-[11px] flex-shrink-0 ml-1", unread > 0 ? "text-[#00a884]" : "text-gray-400")}>
                  {conv.lastMessageTime ? formatTime(conv.lastMessageTime) : ""}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 min-w-0">
                  {isMine && conv.lastMessageStatus && (
                    <MessageTicks
                      status={(() => {
                        if (!conv.lastMessageSenderId) return "sent";
                        const others = conv.participants.filter((p) => p !== currentUid);
                        const allRead = others.every((uid) => {
                          const lastMsg = conv.lastMessage;
                          return conv.lastMessageStatus === "read";
                        });
                        return conv.lastMessageStatus as "sent" | "delivered" | "read";
                      })()}
                      className="flex-shrink-0"
                    />
                  )}
                  <p className="text-sm text-gray-500 truncate">
                    {conv.lastMessage ?? "No messages yet"}
                  </p>
                </div>
                {unread > 0 && (
                  <span className="flex-shrink-0 ml-2 bg-[#00a884] text-white text-[11px] font-medium rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
