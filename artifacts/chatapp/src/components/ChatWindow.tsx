import { useState, useRef, useEffect, useCallback } from "react";
import { Conversation, Message } from "@/types/chat";
import { ChatBubble } from "./ChatBubble";
import { MessageInfo } from "./MessageInfo";
import { useMessages } from "@/hooks/useMessages";
import { useUserPresence } from "@/hooks/useUserPresence";
import { useTyping } from "@/hooks/useTyping";
import { sendMessage, sendMediaMessage } from "@/services/chatService";
import { uploadFile, validateFile, getMediaType } from "@/services/uploadService";
import { Send, ArrowLeft, Phone, Video, Paperclip, X, Image } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatLastSeen } from "@/lib/utils";
import { CallType } from "@/types/call";
import { cn } from "@/lib/utils";

interface ChatWindowProps {
  conversation: Conversation;
  onBack?: () => void;
  onStartCall?: (type: CallType) => void;
}

interface PendingFile {
  file: File;
  preview: string | null; // object URL for images
}

export function ChatWindow({ conversation, onBack, onStartCall }: ChatWindowProps) {
  const { currentUser } = useAuth();
  const { messages, loading } = useMessages(conversation.id, currentUser?.uid);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPersonal = conversation.type === "personal";
  const otherUid = isPersonal
    ? conversation.participants.find((p) => p !== currentUser?.uid) ?? null
    : null;

  const otherPresence = useUserPresence(otherUid);
  const { onTypingStart, onTypingStop, subscribe } = useTyping(
    conversation.id,
    currentUser?.uid,
    conversation.participantDetails
  );

  useEffect(() => {
    const unsub = subscribe((names) => setTypingNames(names));
    return unsub;
  }, [subscribe]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => {
      if (pendingFile?.preview) URL.revokeObjectURL(pendingFile.preview);
    };
  }, [pendingFile]);

  function getTitle(): string {
    if (!isPersonal) return conversation.name ?? "Group";
    return conversation.participantDetails[otherUid ?? ""]?.displayName ?? "Chat";
  }

  function getSubtitle(): { text: string; isTyping: boolean; isOnline: boolean } {
    if (typingNames.length > 0) {
      const label = isPersonal
        ? "typing..."
        : typingNames.length === 1
          ? `${typingNames[0]} is typing...`
          : `${typingNames[0]} and ${typingNames.length - 1} more typing...`;
      return { text: label, isTyping: true, isOnline: false };
    }
    if (!isPersonal) {
      const names = conversation.participants
        .map((uid) => conversation.participantDetails[uid]?.displayName ?? uid)
        .join(", ");
      return { text: names, isTyping: false, isOnline: false };
    }
    if (otherPresence.isOnline) {
      return { text: "online", isTyping: false, isOnline: true };
    }
    return { text: formatLastSeen(otherPresence.lastSeen), isTyping: false, isOnline: false };
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const err = validateFile(file);
    if (err) { setUploadError(err); return; }
    setUploadError(null);
    const isImage = getMediaType(file) === "image";
    const preview = isImage ? URL.createObjectURL(file) : null;
    setPendingFile({ file, preview });
    inputRef.current?.focus();
  }

  function cancelPendingFile() {
    if (pendingFile?.preview) URL.revokeObjectURL(pendingFile.preview);
    setPendingFile(null);
    setUploadProgress(null);
    setUploadError(null);
  }

  async function handleSend() {
    if (!currentUser) return;
    if (!text.trim() && !pendingFile) return;

    onTypingStop();
    setSending(true);
    setUploadError(null);

    try {
      if (pendingFile) {
        setUploadProgress(0);
        const result = await uploadFile(
          conversation.id,
          pendingFile.file,
          (pct) => setUploadProgress(pct)
        );
        await sendMediaMessage(
          conversation.id,
          currentUser.uid,
          currentUser.displayName ?? "Unknown",
          currentUser.photoURL,
          conversation.participants,
          { url: result.url, mediaType: result.mediaType, fileName: result.fileName, fileSize: result.fileSize },
          text.trim() || undefined
        );
        cancelPendingFile();
      } else {
        await sendMessage(
          conversation.id,
          currentUser.uid,
          currentUser.displayName ?? "Unknown",
          currentUser.photoURL,
          text.trim(),
          conversation.participants
        );
      }
      setText("");
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSending(false);
      setUploadProgress(null);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px";
    if (e.target.value.trim()) {
      onTypingStart();
    } else {
      onTypingStop();
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

  const subtitle = getSubtitle();
  const canSend = (!!text.trim() || !!pendingFile) && !sending;

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
          <p className={cn(
            "text-xs leading-tight truncate transition-colors duration-200",
            subtitle.isTyping ? "text-[#a8ffd0] italic"
              : subtitle.isOnline ? "text-[#a8d5ca]"
              : "text-[#c5ddd8]"
          )}>
            {subtitle.text}
          </p>
        </div>
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
                  onDoubleClick={() => (isOwn ? setSelectedMessage(msg) : undefined)}
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

      {/* Pending file preview */}
      {pendingFile && (
        <div className="flex items-center gap-3 px-4 py-3 bg-white border-t border-gray-100 flex-shrink-0">
          <div className="relative flex-shrink-0">
            {pendingFile.preview ? (
              <img
                src={pendingFile.preview}
                alt="preview"
                className="w-16 h-16 object-cover rounded-xl border border-gray-200"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-[#f0f2f5] flex flex-col items-center justify-center border border-gray-200">
                <Paperclip size={20} className="text-gray-400" />
              </div>
            )}
            {/* Upload progress ring */}
            {uploadProgress !== null && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
                <span className="text-white text-xs font-semibold">{uploadProgress}%</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{pendingFile.file.name}</p>
            <p className="text-xs text-gray-400">
              {(pendingFile.file.size / 1024).toFixed(0)} KB
              {pendingFile.preview ? " · Image" : " · File"}
            </p>
            {uploadProgress !== null && (
              <div className="mt-1.5 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#00a884] rounded-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>
          <button
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            onClick={cancelPendingFile}
            disabled={sending}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100 flex-shrink-0">
          <p className="text-xs text-red-500">{uploadError}</p>
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-end gap-2 px-3 py-3 bg-[#f0f2f5] flex-shrink-0">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,application/*,text/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
          onChange={handleFileSelect}
        />
        {/* Attachment button */}
        <button
          className="w-10 h-10 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors flex-shrink-0 mb-0.5"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          title="Attach file"
        >
          <Paperclip size={20} />
        </button>

        <div className="flex-1 bg-white rounded-3xl px-4 py-2 shadow-sm min-h-[44px] flex items-end">
          <textarea
            ref={inputRef}
            className="w-full bg-transparent text-sm outline-none resize-none max-h-32 leading-relaxed placeholder:text-gray-400"
            placeholder={pendingFile ? "Add a caption…" : "Type a message"}
            rows={1}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
          />
        </div>

        <button
          className="w-11 h-11 rounded-full bg-[#00a884] flex items-center justify-center text-white shadow-sm disabled:opacity-50 hover:bg-[#008069] transition-colors flex-shrink-0"
          onClick={handleSend}
          disabled={!canSend}
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
