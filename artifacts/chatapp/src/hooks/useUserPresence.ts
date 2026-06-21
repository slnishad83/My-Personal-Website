import { useEffect, useState } from "react";
import { doc, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface PresenceInfo {
  isOnline: boolean;
  lastSeen: Date | null;
}

function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  return null;
}

export function useUserPresence(uid: string | null | undefined): PresenceInfo {
  const [presence, setPresence] = useState<PresenceInfo>({ isOnline: false, lastSeen: null });

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "users", uid), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setPresence({
        isOnline: data.isOnline ?? false,
        lastSeen: toDate(data.lastSeen),
      });
    });
    return unsub;
  }, [uid]);

  return presence;
}
