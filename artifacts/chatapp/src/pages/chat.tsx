import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useConversations } from "@/hooks/useConversations";
import { useUsers } from "@/hooks/useUsers";
import { ConversationList } from "@/components/ConversationList";
import { ChatWindow } from "@/components/ChatWindow";
import { NewChatModal } from "@/components/NewChatModal";
import { Conversation, User } from "@/types/chat";
import { createPersonalConversation, createGroupConversation } from "@/services/chatService";
import { MessageSquare, Search, LogOut, Edit } from "lucide-react";

export default function ChatPage() {
  const { currentUser, logout } = useAuth();
  const { conversations, loading } = useConversations(currentUser?.uid);
  const users = useUsers(currentUser?.uid);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [search, setSearch] = useState("");

  const selectedConv = conversations.find((c) => c.id === selectedConvId) ?? null;

  const filteredConvs = conversations.filter((c) => {
    if (!search) return true;
    const name = c.type === "group"
      ? c.name ?? ""
      : c.participantDetails[c.participants.find((p) => p !== currentUser?.uid) ?? ""]?.displayName ?? "";
    return name.toLowerCase().includes(search.toLowerCase()) ||
      (c.lastMessage ?? "").toLowerCase().includes(search.toLowerCase());
  });

  async function handleStartPersonal(user: User) {
    if (!currentUser) return;
    setShowNewChat(false);
    const id = await createPersonalConversation(
      { uid: currentUser.uid, displayName: currentUser.displayName ?? "Me", photoURL: currentUser.photoURL },
      user
    );
    setSelectedConvId(id);
    setMobileView("chat");
  }

  async function handleStartGroup(members: User[], groupName: string) {
    if (!currentUser) return;
    setShowNewChat(false);
    const id = await createGroupConversation(
      { uid: currentUser.uid, displayName: currentUser.displayName ?? "Me", photoURL: currentUser.photoURL },
      members,
      groupName
    );
    setSelectedConvId(id);
    setMobileView("chat");
  }

  function handleSelectConv(id: string) {
    setSelectedConvId(id);
    setMobileView("chat");
  }

  return (
    <div className="h-screen flex bg-white overflow-hidden">
      {/* Sidebar */}
      <div className={`w-full md:w-[380px] md:flex flex-col border-r border-gray-200 bg-white flex-shrink-0 ${mobileView === "list" ? "flex" : "hidden md:flex"}`}>
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#f0f2f5] flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white font-semibold">
              {currentUser?.displayName?.charAt(0).toUpperCase() ?? "?"}
            </div>
            <span className="text-sm font-semibold text-gray-800 hidden sm:block">
              {currentUser?.displayName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="w-9 h-9 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
              onClick={() => setShowNewChat(true)}
              title="New chat"
            >
              <Edit size={18} />
            </button>
            <button
              className="w-9 h-9 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
              onClick={logout}
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 bg-white border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center bg-[#f0f2f5] rounded-full px-3 gap-2">
            <Search size={16} className="text-gray-400" />
            <input
              className="flex-1 bg-transparent text-sm py-2 outline-none placeholder:text-gray-400"
              placeholder="Search or start new chat"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <ConversationList
              conversations={filteredConvs}
              selectedId={selectedConvId}
              currentUid={currentUser?.uid ?? ""}
              onSelect={handleSelectConv}
            />
          )}
        </div>

        {/* FAB new chat */}
        <button
          className="absolute bottom-6 left-[340px] md:hidden w-14 h-14 bg-[#00a884] rounded-full flex items-center justify-center text-white shadow-lg hover:bg-[#008069] transition-colors"
          onClick={() => setShowNewChat(true)}
        >
          <MessageSquare size={24} />
        </button>
      </div>

      {/* Chat area */}
      <div className={`flex-1 flex flex-col ${mobileView === "chat" ? "flex" : "hidden md:flex"}`}>
        {selectedConv ? (
          <ChatWindow
            conversation={selectedConv}
            onBack={() => setMobileView("list")}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full bg-[#f0f2f5]">
            <div className="w-24 h-24 rounded-full bg-[#dfe5e7] flex items-center justify-center mb-4">
              <MessageSquare size={48} className="text-[#a0b3b8]" />
            </div>
            <h2 className="text-2xl font-light text-gray-600 mb-2">WhatsApp Web</h2>
            <p className="text-sm text-gray-400 text-center max-w-xs">
              Send and receive messages with full delivery and read receipts — just like WhatsApp.
            </p>
            <button
              className="mt-6 flex items-center gap-2 bg-[#00a884] text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-[#008069] transition-colors"
              onClick={() => setShowNewChat(true)}
            >
              <Edit size={16} />
              New chat
            </button>
          </div>
        )}
      </div>

      {showNewChat && (
        <NewChatModal
          users={users}
          onStartPersonal={handleStartPersonal}
          onStartGroup={handleStartGroup}
          onClose={() => setShowNewChat(false)}
        />
      )}
    </div>
  );
}
