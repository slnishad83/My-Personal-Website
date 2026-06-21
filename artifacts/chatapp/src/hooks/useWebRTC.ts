import { useRef, useCallback } from "react";
import {
  doc,
  collection,
  addDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CallType } from "@/types/call";

const STUN_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function useWebRTC() {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const unsubCallRef = useRef<(() => void) | null>(null);
  const unsubCandidatesRef = useRef<(() => void) | null>(null);

  const cleanup = useCallback(() => {
    unsubCallRef.current?.();
    unsubCandidatesRef.current?.();
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
  }, []);

  const getMedia = useCallback(async (type: CallType): Promise<MediaStream> => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === "video",
    });
    localStreamRef.current = stream;
    return stream;
  }, []);

  const createPeerConnection = useCallback(
    (
      onRemoteStream: (stream: MediaStream) => void,
      onIceCandidate: (candidate: RTCIceCandidate) => void
    ): RTCPeerConnection => {
      const pc = new RTCPeerConnection(STUN_SERVERS);
      pcRef.current = pc;

      const remoteStream = new MediaStream();
      remoteStreamRef.current = remoteStream;

      pc.ontrack = (e) => {
        e.streams[0]?.getTracks().forEach((track) => remoteStream.addTrack(track));
        onRemoteStream(remoteStream);
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) onIceCandidate(e.candidate);
      };

      localStreamRef.current?.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!));

      return pc;
    },
    []
  );

  // Caller: create offer
  const startCall = useCallback(
    async (
      callId: string,
      callType: CallType,
      onRemoteStream: (stream: MediaStream) => void
    ) => {
      await getMedia(callType);

      const pc = createPeerConnection(onRemoteStream, async (candidate) => {
        await addDoc(collection(db, "calls", callId, "callerCandidates"), candidate.toJSON());
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await updateDoc(doc(db, "calls", callId), { offer: { type: offer.type, sdp: offer.sdp } });

      // Listen for answer
      unsubCallRef.current = onSnapshot(doc(db, "calls", callId), async (snap) => {
        const data = snap.data();
        if (!pc.currentRemoteDescription && data?.answer) {
          const answerDesc = new RTCSessionDescription(data.answer);
          await pc.setRemoteDescription(answerDesc).catch(() => {});
        }
      });

      // Listen for callee ICE candidates
      unsubCandidatesRef.current = onSnapshot(
        collection(db, "calls", callId, "calleeCandidates"),
        (snap) => {
          snap.docChanges().forEach((change) => {
            if (change.type === "added") {
              const c = new RTCIceCandidate(change.doc.data());
              pc.addIceCandidate(c).catch(() => {});
            }
          });
        }
      );
    },
    [getMedia, createPeerConnection]
  );

  // Callee: accept offer and create answer
  const answerCall = useCallback(
    async (
      callId: string,
      callType: CallType,
      offer: RTCSessionDescriptionInit,
      onRemoteStream: (stream: MediaStream) => void
    ) => {
      await getMedia(callType);

      const pc = createPeerConnection(onRemoteStream, async (candidate) => {
        await addDoc(collection(db, "calls", callId, "calleeCandidates"), candidate.toJSON());
      });

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await updateDoc(doc(db, "calls", callId), {
        answer: { type: answer.type, sdp: answer.sdp },
        status: "accepted",
      });

      // Listen for caller ICE candidates
      unsubCandidatesRef.current = onSnapshot(
        collection(db, "calls", callId, "callerCandidates"),
        (snap) => {
          snap.docChanges().forEach((change) => {
            if (change.type === "added") {
              const c = new RTCIceCandidate(change.doc.data());
              pc.addIceCandidate(c).catch(() => {});
            }
          });
        }
      );
    },
    [getMedia, createPeerConnection]
  );

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return false;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (!audioTrack) return false;
    audioTrack.enabled = !audioTrack.enabled;
    return !audioTrack.enabled; // returns true if now muted
  }, []);

  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) return false;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (!videoTrack) return false;
    videoTrack.enabled = !videoTrack.enabled;
    return !videoTrack.enabled;
  }, []);

  const getLocalStream = useCallback(() => localStreamRef.current, []);
  const getRemoteStream = useCallback(() => remoteStreamRef.current, []);

  return {
    startCall,
    answerCall,
    toggleMute,
    toggleCamera,
    getLocalStream,
    getRemoteStream,
    cleanup,
  };
}
