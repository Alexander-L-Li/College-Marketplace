import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authFetch } from "@/lib/auth";

export default function MyListings() {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    price: "",
    description: "",
  });

  async function load() {
    setIsLoading(true);
    setError("");
    try {
      const res = await authFetch(navigate, `${import.meta.env.VITE_API_BASE_URL}/my-listings`);
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Failed to load listings");
      }
      const data = await res.json();
      setListings(data.listings || []);
    } catch (err) {
      setError(err.message || "Failed to load listings");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startEdit(l) {
    setEditingId(l.id);
    setEditForm({
      title: l.title || "",
      price: l.price ?? "",
      description: l.description || "",
    });
  }

  async function saveEdit(listingId) {
    setError("");
    try {
      const res = await authFetch(navigate, `${import.meta.env.VITE_API_BASE_URL}/listings/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title,
          price: Number(editForm.price),
          description: editForm.description,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Failed to update listing");
      }
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.message || "Failed to update listing");
    }
  }

  async function toggleSold(listingId, nextIsSold) {
    setError("");
    try {
      const res = await authFetch(navigate, `${import.meta.env.VITE_API_BASE_URL}/listings/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_sold: nextIsSold }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Failed to update sold status");
      }
      await load();
    } catch (err) {
      setError(err.message || "Failed to update sold status");
    }
  }

  async function deleteListing(listingId) {
    const ok = window.confirm("Delete this listing? This cannot be undone.");
    if (!ok) return;
    setError("");
    try {
      const res = await authFetch(navigate, `${import.meta.env.VITE_API_BASE_URL}/listings/${listingId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Failed to delete listing");
      }
      await load();
    } catch (err) {
      setError(err.message || "Failed to delete listing");
    }
  }

  return (
    <div className="min-h-screen bg-white px-4 py-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/home")}
            className="text-gray-600 hover:text-black transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold text-black">My Listings</h1>
          <div className="w-12" />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-red-800 text-sm">{error}</div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center text-gray-600 py-8">Loading...</div>
        ) : listings.length === 0 ? (
          <div className="text-center text-gray-600">
            You have no listings yet.
          </div>
        ) : (
          <div className="space-y-4">
            {listings.map((l) => (
              <div
                key={l.id}
                className="bg-white border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-start gap-4">
                  <button
                    onClick={() => navigate(`/listing/${l.id}`)}
                    className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center"
                    title="View listing"
                  >
                    {l.cover_image_url ? (
                      <img
                        src={l.cover_image_url}
                        alt={l.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-gray-400 text-xs">No Image</span>
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-black truncate">
                        {l.title}
                      </div>
                      {l.is_sold && (
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-800">
                          SOLD
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-700">${l.price}</div>
                    <div className="text-sm text-gray-600 line-clamp-2">
                      {l.description}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Posted:{" "}
                      {l.posted_at ? new Date(l.posted_at).toLocaleDateString() : ""}
                    </div>
                  </div>
                </div>

                {editingId === l.id ? (
                  <div className="mt-4 space-y-3">
                    <input
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      value={editForm.title}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, title: e.target.value }))
                      }
                      placeholder="Title"
                    />
                    <input
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      value={editForm.price}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, price: e.target.value }))
                      }
                      placeholder="Price"
                      type="number"
                      step="0.01"
                      min="0"
                    />
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      value={editForm.description}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Description"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => saveEdit(l.id)}
                        className="flex-1 px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      onClick={() => startEdit(l)}
                      className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleSold(l.id, !l.is_sold)}
                      className="px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800"
                    >
                      {l.is_sold ? "Mark Available" : "Mark Sold"}
                    </button>
                    <button
                      onClick={() => deleteListing(l.id)}
                      className="px-4 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


