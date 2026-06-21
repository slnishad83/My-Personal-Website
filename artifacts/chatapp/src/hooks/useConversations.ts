import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Conversation } from "@/types/chat";

function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  return null;
}

export function useConversations(uid: string | undefined) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", uid),
      orderBy("lastMessageTime", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const convos = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          type: data.type,
          name: data.name ?? null,
          photoURL: data.photoURL ?? null,
          participants: data.participants ?? [],
          participantDetails: data.participantDetails ?? {},
          lastMessage: data.lastMessage ?? null,
          lastMessageTime: toDate(data.lastMessageTime),
          lastMessageSenderId: data.lastMessageSenderId ?? null,
          lastMessageStatus: data.lastMessageStatus ?? null,
          createdAt: toDate(data.createdAt) ?? new Date(),
          createdBy: data.createdBy ?? "",
          unreadCount: data.unreadCount ?? {},
        } as Conversation;
      });
      setConversations(convos);
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  return { conversations, loading };
}
