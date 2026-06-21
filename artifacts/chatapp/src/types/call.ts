export type CallType = "voice" | "video";
export type CallStatus = "calling" | "accepted" | "rejected" | "ended" | "missed" | "busy";

export interface Call {
  id: string;
  callerId: string;
  callerName: string;
  callerPhotoURL: string | null;
  calleeId: string;
  calleeName: string;
  conversationId: string;
  type: CallType;
  status: CallStatus;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  createdAt: Date;
  endedAt?: Date | null;
  duration?: number | null; // seconds
}
