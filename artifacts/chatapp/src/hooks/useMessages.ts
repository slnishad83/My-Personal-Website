import { useEffect, useState, useRef } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  doc,
  updateDoc,
  serverTimestamp,
  writeBatch,
  getDocs,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Message } from "@/types/chat";

function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  return null;
}

export function useMessages(conversationId: string | null, currentUid: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const markedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!conversationId || !currentUid) return;
    markedRef.current = new Set();
    setMessages([]);
    setLoading(true);

    const q = query(
      collection(db, "conversations", conversationId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, async (snap) => {
      const msgs = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          conversationId,
          senderId: data.senderId,
          senderName: data.senderName ?? "",
          senderPhotoURL: data.senderPhotoURL ?? null,
          text: data.text,
          createdAt: toDate(data.createdAt) ?? new Date(),
          status: data.status ?? "sent",
          deliveredTo: data.deliveredTo ?? {},
          readBy: data.readBy ?? {},
        } as Message;
      });
      setMessages(msgs);
      setLoading(false);

      // Mark unread messages as delivered + read
      const batch = writeBatch(db);
      let hasUpdates = false;
      const now = Date.now();

      for (const msg of msgs) {
        if (msg.senderId === currentUid) continue;
        if (markedRef.current.has(msg.id)) continue;

        const needsDelivered = !msg.deliveredTo[currentUid];
        const needsRead = !msg.readBy[currentUid];

        if (needsDelivered || needsRead) {
          markedRef.current.add(msg.id);
          const msgRef = doc(db, "conversations", conversationId, "messages", msg.id);
          const update: Record<string, unknown> = {};
          if (needsDelivered) update[`deliveredTo.${currentUid}`] = now;
          if (needsRead) update[`readBy.${currentUid}`] = now;
          batch.update(msgRef, update);
          hasUpdates = true;
        }
      }

      if (hasUpdates) {
        await batch.commit().catch(() => {});
        // Reset unread count for this user
        await updateDoc(doc(db, "conversations", conversationId), {
          [`unreadCount.${currentUid}`]: 0,
        }).catch(() => {});
      }
    });

    return () => {
      unsub();
      markedRef.current = new Set();
    };
  }, [conversationId, currentUid]);

  return { messages, loading };
}
