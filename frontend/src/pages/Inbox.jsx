import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

export default function Inbox() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
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

    async function fetchInbox() {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/conversations`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || "Failed to load inbox");
        }
        const data = await res.json();
        setConversations(data.conversations || []);
      } catch (err) {
        setError(err.message || "Failed to load inbox");
      } finally {
        setIsLoading(false);
      }
    }

    fetchInbox();
  }, [navigate]);

  const groupedByListing = useMemo(() => {
    const map = new Map();
    for (const c of conversations) {
      const key = c.listing_id;
      if (!map.has(key)) {
        map.set(key, {
          listing_id: c.listing_id,
          listing_title: c.listing_title,
          listing_cover_url: c.listing_cover_url,
          threads: [],
        });
      }
      map.get(key).threads.push(c);
    }
    return Array.from(map.values());
  }, [conversations]);

  return (
    <div className="min-h-screen bg-white px-4 py-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/home")}
            className="text-gray-600 hover:text-black transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold text-black">Inbox</h1>
          <div className="w-12" />
        </div>

        {isLoading ? (
          <div className="text-center text-gray-600">Loading inbox...</div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-red-800 text-sm">{error}</div>
          </div>
        ) : groupedByListing.length === 0 ? (
          <div className="text-center text-gray-600">No conversations yet.</div>
        ) : (
          <div className="space-y-4">
            {groupedByListing.map((g) => (
              <div
                key={g.listing_id}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                    {g.listing_cover_url ? (
                      <img
                        src={g.listing_cover_url}
                        alt={g.listing_title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-gray-400 text-xs">No</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-black truncate">
                      {g.listing_title}
                    </div>
                    <div className="text-xs text-gray-500">
                      {g.threads.length} conversation
                      {g.threads.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-gray-200">
                  {g.threads.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => navigate(`/inbox/${c.id}`)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-black truncate">
                            {c.other_first_name} {c.other_last_name} (@
                            {c.other_username})
                          </div>
                          <div className="text-sm text-gray-700 truncate">
                            {c.last_message_body || "No messages yet. Say hi!"}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 whitespace-nowrap">
                          {c.last_message_at
                            ? new Date(c.last_message_at).toLocaleDateString()
                            : ""}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
