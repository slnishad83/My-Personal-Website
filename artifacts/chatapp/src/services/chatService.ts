import {
  collection,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  setDoc,
  Timestamp,
  arrayUnion,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { User } from "@/types/chat";

export async function sendMessage(
  conversationId: string,
  senderId: string,
  senderName: string,
  senderPhotoURL: string | null,
  text: string,
  participants: string[]
) {
  const now = Date.now();
  // Sender's own delivery/read is immediate
  const deliveredTo: Record<string, number> = { [senderId]: now };
  const readBy: Record<string, number> = { [senderId]: now };

  const msgRef = await addDoc(
    collection(db, "conversations", conversationId, "messages"),
    {
      senderId,
      senderName,
      senderPhotoURL,
      text,
      createdAt: serverTimestamp(),
      status: "sent",
      deliveredTo,
      readBy,
    }
  );

  // Increment unread for all other participants
  const unreadUpdate: Record<string, unknown> = {};
  for (const uid of participants) {
    if (uid !== senderId) {
      unreadUpdate[`unreadCount.${uid}`] = (await getDocs(
        query(collection(db, "conversations"), where("__name__", "==", conversationId))
      ).then((s) => (s.docs[0]?.data()?.unreadCount?.[uid] ?? 0) + 1));
    }
  }

  await updateDoc(doc(db, "conversations", conversationId), {
    lastMessage: text,
    lastMessageTime: serverTimestamp(),
    lastMessageSenderId: senderId,
    lastMessageStatus: "sent",
    ...unreadUpdate,
  });

  return msgRef.id;
}

export async function sendMediaMessage(
  conversationId: string,
  senderId: string,
  senderName: string,
  senderPhotoURL: string | null,
  participants: string[],
  media: {
    url: string;
    mediaType: "image" | "file";
    fileName: string;
    fileSize: number;
  },
  caption?: string
) {
  const now = Date.now();
  const deliveredTo: Record<string, number> = { [senderId]: now };
  const readBy: Record<string, number> = { [senderId]: now };

  const lastMessageText =
    media.mediaType === "image"
      ? caption ? `📷 ${caption}` : "📷 Photo"
      : `📎 ${media.fileName}`;

  await addDoc(
    collection(db, "conversations", conversationId, "messages"),
    {
      senderId,
      senderName,
      senderPhotoURL,
      text: caption ?? "",
      mediaURL: media.url,
      mediaType: media.mediaType,
      fileName: media.fileName,
      fileSize: media.fileSize,
      createdAt: serverTimestamp(),
      status: "sent",
      deliveredTo,
      readBy,
    }
  );

  const unreadUpdate: Record<string, unknown> = {};
  for (const uid of participants) {
    if (uid !== senderId) {
      unreadUpdate[`unreadCount.${uid}`] = (await getDocs(
        query(collection(db, "conversations"), where("__name__", "==", conversationId))
      ).then((s) => (s.docs[0]?.data()?.unreadCount?.[uid] ?? 0) + 1));
    }
  }

  await updateDoc(doc(db, "conversations", conversationId), {
    lastMessage: lastMessageText,
    lastMessageTime: serverTimestamp(),
    lastMessageSenderId: senderId,
    lastMessageStatus: "sent",
    ...unreadUpdate,
  });
}

export async function createPersonalConversation(
  currentUser: { uid: string; displayName: string; photoURL: string | null },
  otherUser: User
): Promise<string> {
  // Check if conversation already exists
  const q1 = query(
    collection(db, "conversations"),
    where("type", "==", "personal"),
    where("participants", "array-contains", currentUser.uid)
  );
  const snap = await getDocs(q1);
  for (const d of snap.docs) {
    const data = d.data();
    if (
      data.participants.includes(otherUser.uid) &&
      data.participants.length === 2
    ) {
      return d.id;
    }
  }

  // Create new
  const ref = doc(collection(db, "conversations"));
  await setDoc(ref, {
    type: "personal",
    name: null,
    photoURL: null,
    participants: [currentUser.uid, otherUser.uid],
    participantDetails: {
      [currentUser.uid]: {
        uid: currentUser.uid,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL,
        isOnline: true,
        lastSeen: null,
      },
      [otherUser.uid]: {
        uid: otherUser.uid,
        displayName: otherUser.displayName,
        photoURL: otherUser.photoURL,
        isOnline: otherUser.isOnline,
        lastSeen: null,
      },
    },
    lastMessage: null,
    lastMessageTime: serverTimestamp(),
    lastMessageSenderId: null,
    lastMessageStatus: null,
    createdAt: serverTimestamp(),
    createdBy: currentUser.uid,
    unreadCount: {
      [currentUser.uid]: 0,
      [otherUser.uid]: 0,
    },
  });
  return ref.id;
}

export async function createGroupConversation(
  currentUser: { uid: string; displayName: string; photoURL: string | null },
  members: User[],
  groupName: string
): Promise<string> {
  const allParticipants = [currentUser, ...members];
  const participantDetails: Record<string, unknown> = {};
  const unreadCount: Record<string, number> = {};

  for (const p of allParticipants) {
    participantDetails[p.uid] = {
      uid: p.uid,
      displayName: p.displayName,
      photoURL: p.photoURL,
      isOnline: "isOnline" in p ? p.isOnline : true,
      lastSeen: null,
    };
    unreadCount[p.uid] = 0;
  }

  const ref = doc(collection(db, "conversations"));
  await setDoc(ref, {
    type: "group",
    name: groupName,
    photoURL: null,
    participants: allParticipants.map((p) => p.uid),
    participantDetails,
    lastMessage: null,
    lastMessageTime: serverTimestamp(),
    lastMessageSenderId: null,
    lastMessageStatus: null,
    createdAt: serverTimestamp(),
    createdBy: currentUser.uid,
    unreadCount,
  });
  return ref.id;
}

export function computeMessageStatus(
  msg: { senderId: string; deliveredTo: Record<string, number>; readBy: Record<string, number> },
  participants: string[]
): "sent" | "delivered" | "read" {
  const others = participants.filter((p) => p !== msg.senderId);
  if (others.length === 0) return "sent";

  const allRead = others.every((uid) => !!msg.readBy[uid]);
  if (allRead) return "read";

  const allDelivered = others.every((uid) => !!msg.deliveredTo[uid]);
  if (allDelivered) return "delivered";

  return "sent";
}
