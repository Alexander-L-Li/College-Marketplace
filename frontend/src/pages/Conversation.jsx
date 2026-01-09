import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

export default function Conversation() {
  const navigate = useNavigate();
  const { id } = useParams(); // conversation id

  const token = useMemo(() => localStorage.getItem("token"), []);
  const [currentUserId, setCurrentUserId] = useState(null);
  const bottomRef = useRef(null);

  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const decoded = jwtDecode(token);
      const { exp } = decoded;
      if (Date.now() >= exp * 1000) {
        localStorage.removeItem("token");
        navigate("/login");
        return;
      }
      if (decoded?.id) setCurrentUserId(decoded.id);
    } catch {
      localStorage.removeItem("token");
      navigate("/login");
      return;
    }

    async function fetchThread() {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/conversations/${id}/messages`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || "Failed to load conversation");
        }
        const data = await res.json();
        setThread(data.conversation);
        setMessages(data.messages || []);
      } catch (err) {
        setError(err.message || "Failed to load conversation");
      } finally {
        setIsLoading(false);
      }
    }

    fetchThread();
  }, [id, navigate, token]);

  // Lightweight polling to refresh messages + read state
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/conversations/${id}/messages`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return;
        const data = await res.json();
        setThread(data.conversation);
        setMessages(data.messages || []);
      } catch {
        // ignore
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [id, token]);

  useEffect(() => {
    // Scroll to bottom on load and when messages change
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function handleSend() {
    if (!draft.trim()) return;
    setIsSending(true);
    setError("");

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/conversations/${id}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ body: draft }),
        }
      );

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Failed to send message");
      }

      const data = await res.json();
      setMessages((prev) => [...prev, data.message]);
      setDraft("");
    } catch (err) {
      setError(err.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col">
      {/* iOS-style nav bar */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <button
            onClick={() => navigate("/inbox")}
            className="text-blue-600 hover:text-blue-700 transition-colors text-sm font-medium"
          >
            ← Inbox
          </button>
          <div className="text-center">
            <div className="text-xs text-gray-500">Listing</div>
            <div className="font-semibold text-black text-sm">
              {thread?.listing_title || "Conversation"}
            </div>
          </div>
          <div className="w-16" />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 px-4 py-4 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-2">
          {isLoading ? (
            <div className="text-center text-gray-600">Loading...</div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-red-800 text-sm">{error}</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-600">
              No messages yet. Send the first one.
            </div>
          ) : (
            <>
              {messages.map((m, idx) => {
                const isMine = currentUserId && m.sender_id === currentUserId;
                const isLast = idx === messages.length - 1;
                const otherReadAt = thread?.other_last_read_at
                  ? new Date(thread.other_last_read_at).getTime()
                  : null;
                const msgAt = m.created_at
                  ? new Date(m.created_at).getTime()
                  : null;
                const showReadReceipt =
                  isMine &&
                  isLast &&
                  otherReadAt &&
                  msgAt &&
                  otherReadAt >= msgAt;
                return (
                  <div
                    key={m.id}
                    className={`flex ${
                      isMine ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div className="max-w-[78%]">
                      <div
                        className={`px-3 py-2 text-sm shadow-sm ${
                          isMine
                            ? "bg-[#007AFF] text-white rounded-2xl rounded-br-md"
                            : "bg-white text-black rounded-2xl rounded-bl-md border border-gray-200"
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words">
                          {m.body}
                        </div>
                      </div>
                      <div
                        className={`mt-1 text-[11px] text-gray-500 ${
                          isMine ? "text-right" : "text-left"
                        }`}
                      >
                        {m.created_at
                          ? new Date(m.created_at).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : ""}
                        {showReadReceipt ? (
                          <span className="ml-2 text-[11px] text-gray-500">
                            Read
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="px-4 py-3 border-t border-gray-200 bg-white">
        <div className="max-w-2xl mx-auto flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a message..."
            className="flex-1 px-4 py-3 bg-[#F2F2F7] border border-gray-200 rounded-full text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
          />
          <button
            onClick={handleSend}
            disabled={isSending || !draft.trim()}
            className="bg-[#007AFF] text-white px-5 py-3 rounded-full font-semibold hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSending ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
