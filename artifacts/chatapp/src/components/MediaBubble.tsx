import { useState } from "react";
import { Message } from "@/types/chat";
import { formatFileSize } from "@/services/uploadService";
import { FileText, Download, X, ZoomIn } from "lucide-react";

interface MediaBubbleProps {
  message: Message;
  isOwn: boolean;
}

export function MediaBubble({ message, isOwn }: MediaBubbleProps) {
  const [lightbox, setLightbox] = useState(false);

  if (!message.mediaURL || !message.mediaType) return null;

  if (message.mediaType === "image") {
    return (
      <>
        <div
          className="relative cursor-pointer group rounded-xl overflow-hidden"
          style={{ maxWidth: 240 }}
          onClick={() => setLightbox(true)}
        >
          <img
            src={message.mediaURL}
            alt={message.fileName ?? "image"}
            className="w-full object-cover rounded-xl"
            style={{ maxHeight: 320 }}
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <ZoomIn
              size={28}
              className="text-white opacity-0 group-hover:opacity-100 drop-shadow transition-opacity"
            />
          </div>
          {/* Caption */}
          {message.text && (
            <p className="text-sm text-gray-800 px-1 pt-1">{message.text}</p>
          )}
        </div>

        {/* Lightbox */}
        {lightbox && (
          <div
            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center"
            onClick={() => setLightbox(false)}
          >
            <button
              className="absolute top-4 right-4 text-white hover:text-gray-300"
              onClick={() => setLightbox(false)}
            >
              <X size={28} />
            </button>
            <img
              src={message.mediaURL!}
              alt={message.fileName ?? "image"}
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <a
              href={message.mediaURL!}
              download={message.fileName ?? "image"}
              target="_blank"
              rel="noreferrer"
              className="absolute bottom-6 right-6 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-full flex items-center gap-2 text-sm transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Download size={16} />
              Download
            </a>
          </div>
        )}
      </>
    );
  }

  // File
  return (
    <a
      href={message.mediaURL}
      target="_blank"
      rel="noreferrer"
      download={message.fileName ?? "file"}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl no-underline group ${
        isOwn ? "bg-[#c1f0b8]" : "bg-[#f0f2f5]"
      }`}
      style={{ maxWidth: 260 }}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
        isOwn ? "bg-[#00a884]/20" : "bg-[#00a884]/10"
      }`}>
        <FileText size={20} className="text-[#00a884]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {message.fileName ?? "File"}
        </p>
        <p className="text-xs text-gray-400">
          {message.fileSize ? formatFileSize(message.fileSize) : ""}
        </p>
      </div>
      <Download size={16} className="text-gray-400 group-hover:text-[#00a884] flex-shrink-0 transition-colors" />
    </a>
  );
}
