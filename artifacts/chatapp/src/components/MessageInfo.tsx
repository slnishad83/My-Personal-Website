import { Message, Conversation } from "@/types/chat";
import { formatMessageTime } from "@/lib/utils";
import { X, Check, CheckCheck } from "lucide-react";

interface MessageInfoProps {
  message: Message;
  conversation: Conversation;
  onClose: () => void;
}

export function MessageInfo({ message, conversation, onClose }: MessageInfoProps) {
  const others = conversation.participants.filter((p) => p !== message.senderId);
  const details = conversation.participantDetails;

  const readEntries = Object.entries(message.readBy)
    .filter(([uid]) => uid !== message.senderId)
    .map(([uid, ts]) => ({
      uid,
      name: details[uid]?.displayName ?? uid,
      photoURL: details[uid]?.photoURL ?? null,
      timestamp: new Date(ts),
    }))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const deliveredEntries = Object.entries(message.deliveredTo)
    .filter(([uid]) => uid !== message.senderId && !message.readBy[uid])
    .map(([uid, ts]) => ({
      uid,
      name: details[uid]?.displayName ?? uid,
      photoURL: details[uid]?.photoURL ?? null,
      timestamp: new Date(ts),
    }))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const pendingUids = others.filter(
    (uid) => !message.deliveredTo[uid] && !message.readBy[uid]
  );

  function Avatar({ name, photoURL }: { name: string; photoURL: string | null }) {
    if (photoURL) {
      return <img src={photoURL} alt={name} className="w-10 h-10 rounded-full object-cover" />;
    }
    return (
      <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white font-medium text-sm">
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md rounded-t-2xl pb-8 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Message info</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Message preview */}
          <div className="px-4 py-3 bg-[#f0f2f5]">
            <div className="bg-white rounded-xl px-3 py-2 shadow-sm max-w-xs ml-auto">
              <p className="text-sm text-gray-800">{message.text}</p>
              <p className="text-[11px] text-gray-400 text-right mt-1">
                {formatMessageTime(message.createdAt)}
              </p>
            </div>
          </div>

          {/* Read by */}
          {readEntries.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100">
                <CheckCheck size={18} className="text-[#53bdeb]" />
                <span className="text-sm font-medium text-gray-600">Read</span>
              </div>
              {readEntries.map((e) => (
                <div key={e.uid} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
                  <Avatar name={e.name} photoURL={e.photoURL} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{e.name}</p>
                  </div>
                  <span className="text-xs text-gray-400">{formatMessageTime(e.timestamp)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Delivered */}
          {deliveredEntries.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100">
                <CheckCheck size={18} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-600">Delivered</span>
              </div>
              {deliveredEntries.map((e) => (
                <div key={e.uid} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
                  <Avatar name={e.name} photoURL={e.photoURL} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{e.name}</p>
                  </div>
                  <span className="text-xs text-gray-400">{formatMessageTime(e.timestamp)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Pending */}
          {pendingUids.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100">
                <Check size={18} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-600">Sent</span>
              </div>
              {pendingUids.map((uid) => (
                <div key={uid} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
                  <Avatar name={details[uid]?.displayName ?? uid} photoURL={details[uid]?.photoURL ?? null} />
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {details[uid]?.displayName ?? uid}
                  </p>
                </div>
              ))}
            </div>
          )}

          {others.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No other participants</p>
          )}
        </div>
      </div>
    </div>
  );
}
