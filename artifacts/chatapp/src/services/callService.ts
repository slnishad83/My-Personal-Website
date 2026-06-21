import {
  doc,
  collection,
  setDoc,
  updateDoc,
  serverTimestamp,
  addDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CallType } from "@/types/call";

export async function initiateCall(params: {
  callerId: string;
  callerName: string;
  callerPhotoURL: string | null;
  calleeId: string;
  calleeName: string;
  conversationId: string;
  type: CallType;
}): Promise<string> {
  const ref = doc(collection(db, "calls"));
  await setDoc(ref, {
    ...params,
    status: "calling",
    offer: null,
    answer: null,
    createdAt: serverTimestamp(),
    endedAt: null,
    duration: null,
  });
  return ref.id;
}

export async function rejectCall(callId: string) {
  await updateDoc(doc(db, "calls", callId), {
    status: "rejected",
    endedAt: serverTimestamp(),
  });
}

export async function endCall(callId: string, durationSeconds: number) {
  await updateDoc(doc(db, "calls", callId), {
    status: "ended",
    endedAt: serverTimestamp(),
    duration: durationSeconds,
  });
}

export async function markMissed(callId: string) {
  await updateDoc(doc(db, "calls", callId), {
    status: "missed",
    endedAt: serverTimestamp(),
  });
}

export async function addCallMessageToChat(
  conversationId: string,
  senderId: string,
  senderName: string,
  type: CallType,
  status: "ended" | "missed" | "rejected",
  duration: number | null
) {
  let text = "";
  if (status === "ended") {
    const mins = Math.floor((duration ?? 0) / 60);
    const secs = (duration ?? 0) % 60;
    const dur = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    text = `📞 ${type === "video" ? "Video" : "Voice"} call ended · ${dur}`;
  } else if (status === "missed") {
    text = `📞 Missed ${type === "video" ? "video" : "voice"} call`;
  } else {
    text = `📞 ${type === "video" ? "Video" : "Voice"} call declined`;
  }

  await addDoc(collection(db, "conversations", conversationId, "messages"), {
    senderId,
    senderName,
    senderPhotoURL: null,
    text,
    createdAt: serverTimestamp(),
    status: "sent",
    deliveredTo: { [senderId]: Date.now() },
    readBy: { [senderId]: Date.now() },
    isCallLog: true,
  });

  await updateDoc(doc(db, "conversations", conversationId), {
    lastMessage: text,
    lastMessageTime: serverTimestamp(),
    lastMessageSenderId: senderId,
    lastMessageStatus: "sent",
  });
}
