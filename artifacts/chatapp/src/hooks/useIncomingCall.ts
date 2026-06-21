import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Call } from "@/types/call";

function toDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  return new Date();
}

export function useIncomingCall(currentUid: string | undefined) {
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);

  useEffect(() => {
    if (!currentUid) return;
    const q = query(
      collection(db, "calls"),
      where("calleeId", "==", currentUid),
      where("status", "==", "calling")
    );
    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) {
        setIncomingCall(null);
        return;
      }
      const doc = snap.docs[0];
      const data = doc.data();
      setIncomingCall({
        id: doc.id,
        callerId: data.callerId,
        callerName: data.callerName,
        callerPhotoURL: data.callerPhotoURL ?? null,
        calleeId: data.calleeId,
        calleeName: data.calleeName,
        conversationId: data.conversationId,
        type: data.type,
        status: data.status,
        offer: data.offer,
        answer: data.answer,
        createdAt: toDate(data.createdAt),
        endedAt: null,
        duration: null,
      });
    });
    return unsub;
  }, [currentUid]);

  return { incomingCall, setIncomingCall };
}
