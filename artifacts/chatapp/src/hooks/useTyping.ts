import { useEffect, useRef, useCallback } from "react";
import {
  doc,
  onSnapshot,
  updateDoc,
  deleteField,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const TYPING_TIMEOUT_MS = 3000;
const STALE_TYPING_MS = 5000;

/**
 * Manages typing state for a conversation.
 *
 * - Writes current user's typing status to Firestore.
 * - Returns a real-time list of OTHER participants currently typing (by display name).
 */
export function useTyping(
  conversationId: string | null,
  currentUid: string | undefined,
  participantDetails: Record<string, { displayName: string }>
) {
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const typingNamesRef = useRef<string[]>([]);
  const listenersRef = useRef<((names: string[]) => void)[]>([]);

  // Subscribe to typing changes
  function subscribe(cb: (names: string[]) => void) {
    listenersRef.current.push(cb);
    cb(typingNamesRef.current);
    return () => {
      listenersRef.current = listenersRef.current.filter((l) => l !== cb);
    };
  }

  // Notify all subscribers
  function notify(names: string[]) {
    typingNamesRef.current = names;
    listenersRef.current.forEach((l) => l(names));
  }

  // Listen to Firestore typing field
  useEffect(() => {
    if (!conversationId || !currentUid) return;
    const unsub = onSnapshot(doc(db, "conversations", conversationId), (snap) => {
      const data = snap.data();
      const typingUsers: Record<string, number> = data?.typingUsers ?? {};
      const now = Date.now();
      const names: string[] = [];
      for (const [uid, ts] of Object.entries(typingUsers)) {
        if (uid === currentUid) continue;
        const timestamp = typeof ts === "number" ? ts : 0;
        if (now - timestamp < STALE_TYPING_MS) {
          names.push(participantDetails[uid]?.displayName ?? "Someone");
        }
      }
      notify(names);
    });
    return unsub;
  }, [conversationId, currentUid]);

  // Called when the user starts typing
  const onTypingStart = useCallback(async () => {
    if (!conversationId || !currentUid) return;
    // Reset the stop timer
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => onTypingStop(), TYPING_TIMEOUT_MS);

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      await updateDoc(doc(db, "conversations", conversationId), {
        [`typingUsers.${currentUid}`]: Date.now(),
      }).catch(() => {});
    }
  }, [conversationId, currentUid]);

  // Called when the user stops typing (or sends)
  const onTypingStop = useCallback(async () => {
    if (!conversationId || !currentUid) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    isTypingRef.current = false;
    await updateDoc(doc(db, "conversations", conversationId), {
      [`typingUsers.${currentUid}`]: deleteField(),
    }).catch(() => {});
  }, [conversationId, currentUid]);

  // Clear on unmount / conversation change
  useEffect(() => {
    return () => {
      onTypingStop();
    };
  }, [onTypingStop]);

  return { onTypingStart, onTypingStop, subscribe };
}
