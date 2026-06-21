export type MessageStatus = "sending" | "sent" | "delivered" | "read";
export type MediaType = "image" | "file";

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
  deliveredTo: Record<string, number>;
  readBy: Record<string, number>;
  // Media
  mediaURL: string | null;
  mediaType: MediaType | null;
  fileName: string | null;
  fileSize: number | null;
  isCallLog?: boolean;
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
  participants: string[];
  participantDetails: Record<string, Participant>;
  lastMessage: string | null;
  lastMessageTime: Date | null;
  lastMessageSenderId: string | null;
  lastMessageStatus: MessageStatus | null;
  createdAt: Date;
  createdBy: string;
  unreadCount: Record<string, number>;
}

export interface User {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  isOnline: boolean;
  lastSeen: Date | null;
}
