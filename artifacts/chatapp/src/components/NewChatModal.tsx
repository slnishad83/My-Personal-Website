import { useState } from "react";
import { User } from "@/types/chat";
import { X, Search, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface NewChatModalProps {
  users: User[];
  onStartPersonal: (user: User) => void;
  onStartGroup: (members: User[], groupName: string) => void;
  onClose: () => void;
}

export function NewChatModal({ users, onStartPersonal, onStartGroup, onClose }: NewChatModalProps) {
  const [mode, setMode] = useState<"list" | "group">("list");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<User[]>([]);
  const [groupName, setGroupName] = useState("");

  const filtered = users.filter((u) =>
    u.displayName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  function toggleSelect(user: User) {
    setSelected((prev) =>
      prev.find((u) => u.uid === user.uid)
        ? prev.filter((u) => u.uid !== user.uid)
        : [...prev, user]
    );
  }

  function Avatar({ user }: { user: User }) {
    if (user.photoURL) {
      return <img src={user.photoURL} alt={user.displayName} className="w-10 h-10 rounded-full object-cover" />;
    }
    return (
      <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white font-medium">
        {user.displayName.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-[#008069] text-white">
          <h2 className="font-semibold">{mode === "group" ? "Add group members" : "New chat"}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        {mode === "list" && (
          <button
            className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors"
            onClick={() => setMode("group")}
          >
            <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center">
              <Users size={20} className="text-white" />
            </div>
            <span className="text-sm font-medium text-gray-800">New group</span>
          </button>
        )}

        <div className="px-3 py-2 border-b border-gray-100">
          <div className="flex items-center bg-[#f0f2f5] rounded-full px-3 gap-2">
            <Search size={16} className="text-gray-400" />
            <input
              className="flex-1 bg-transparent text-sm py-2 outline-none placeholder:text-gray-400"
              placeholder="Search name or number"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {mode === "group" && selected.length > 0 && (
          <div className="flex gap-2 px-3 py-2 overflow-x-auto border-b border-gray-100 flex-shrink-0">
            {selected.map((u) => (
              <div key={u.uid} className="flex flex-col items-center gap-1 flex-shrink-0">
                <div className="relative">
                  <Avatar user={u} />
                  <button
                    className="absolute -top-1 -right-1 bg-gray-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
                    onClick={() => toggleSelect(u)}
                  >
                    ×
                  </button>
                </div>
                <span className="text-[10px] text-gray-600 max-w-[40px] truncate">{u.displayName}</span>
              </div>
            ))}
          </div>
        )}

        <div className="overflow-y-auto flex-1">
          {filtered.map((user) => {
            const isSelected = selected.some((u) => u.uid === user.uid);
            return (
              <button
                key={user.uid}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50"
                onClick={() => {
                  if (mode === "list") {
                    onStartPersonal(user);
                  } else {
                    toggleSelect(user);
                  }
                }}
              >
                <div className="relative">
                  <Avatar user={user} />
                  {user.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#00a884] rounded-full border-2 border-white" />
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-gray-900">{user.displayName}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
                {mode === "group" && (
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                    isSelected ? "bg-[#00a884] border-[#00a884]" : "border-gray-300"
                  )}>
                    {isSelected && <span className="text-white text-[10px]">✓</span>}
                  </div>
                )}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">No users found</p>
          )}
        </div>

        {mode === "group" && selected.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
            <input
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#00a884] mb-3"
              placeholder="Group name (required)"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
            <button
              className="w-full bg-[#00a884] text-white py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-opacity"
              disabled={!groupName.trim()}
              onClick={() => {
                if (groupName.trim()) onStartGroup(selected, groupName.trim());
              }}
            >
              Create group ({selected.length} members)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
