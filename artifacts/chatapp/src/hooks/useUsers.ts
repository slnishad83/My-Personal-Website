import { useEffect, useState } from "react";
import { collection, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { User } from "@/types/chat";

function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  return null;
}

export function useUsers(excludeUid?: string) {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const all = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            uid: d.id,
            displayName: data.displayName ?? "Unknown",
            email: data.email ?? "",
            photoURL: data.photoURL ?? null,
            isOnline: data.isOnline ?? false,
            lastSeen: toDate(data.lastSeen),
          } as User;
        })
        .filter((u) => u.uid !== excludeUid);
      setUsers(all);
    });
    return unsub;
  }, [excludeUid]);

  return users;
}
