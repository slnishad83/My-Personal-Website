export type MessageStatus = "sending" | "sent" | "delivered" | "read";

export interface MessageReceipt {
  userId: string;
  displayName: string;
  photoURL: string | null;
  timestamp: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderPhotoURL: string | null;
  text: string;
  createdAt: Date;
  status: MessageStatus;
  deliveredTo: Record<string, number>; // userId -> timestamp ms
  readBy: Record<string, number>;      // userId -> timestamp ms
}

export interface Participant {
  uid: string;
  displayName: string;
  photoURL: string | null;
  isOnline: boolean;
  lastSeen: Date | null;
}

export interface Conversation {
  id: string;
  type: "personal" | "group";
  name: string | null;
  photoURL: string | null;
  participants: string[]; // uids
  participantDetails: Record<string, Participant>;
  lastMessage: string | null;
  lastMessageTime: Date | null;
  lastMessageSenderId: string | null;
  lastMessageStatus: MessageStatus | null;
  createdAt: Date;
  createdBy: string;
  unreadCount: Record<string, number>; // userId -> count
}

export interface User {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  isOnline: boolean;
  lastSeen: Date | null;
}
