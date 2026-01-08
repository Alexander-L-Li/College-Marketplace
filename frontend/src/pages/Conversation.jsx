import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

export default function Conversation() {
  const navigate = useNavigate();
  const { id } = useParams(); // conversation id

  const token = useMemo(() => localStorage.getItem("token"), []);

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
      const { exp } = jwtDecode(token);
      if (Date.now() >= exp * 1000) {
        localStorage.removeItem("token");
        navigate("/login");
        return;
      }
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
    <div className="min-h-screen bg-white flex flex-col">
      <div className="px-4 py-4 border-b border-gray-200">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <button
            onClick={() => navigate("/inbox")}
            className="text-gray-600 hover:text-black transition-colors"
          >
            ← Inbox
          </button>
          <div className="text-center">
            <div className="text-sm text-gray-600">Listing</div>
            <div className="font-semibold text-black">
              {thread?.listing_title || "Conversation"}
            </div>
          </div>
          <div className="w-16" />
        </div>
      </div>

      <div className="flex-1 px-4 py-4 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-3">
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
            messages.map((m) => (
              <div key={m.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="text-xs text-gray-500 flex justify-between gap-3">
                  <span>
                    {m.first_name} {m.last_name} (@{m.username})
                  </span>
                  <span className="whitespace-nowrap">
                    {m.created_at ? new Date(m.created_at).toLocaleString() : ""}
                  </span>
                </div>
                <div className="text-sm text-black mt-1 whitespace-pre-wrap break-words">
                  {m.body}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="px-4 py-4 border-t border-gray-200">
        <div className="max-w-2xl mx-auto flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a message..."
            className="flex-1 px-3 py-3 border border-gray-300 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
          />
          <button
            onClick={handleSend}
            disabled={isSending || !draft.trim()}
            className="bg-black text-white px-4 py-3 rounded-lg font-semibold hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSending ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}


