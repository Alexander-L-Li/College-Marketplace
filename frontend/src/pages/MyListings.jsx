import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authFetch } from "@/lib/auth";

export default function MyListings() {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setIsLoading(true);
    setError("");
    try {
      const res = await authFetch(
        navigate,
        `${import.meta.env.VITE_API_BASE_URL}/my-listings`
      );
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

  async function toggleSold(listingId, nextIsSold) {
    setError("");
    try {
      const res = await authFetch(
        navigate,
        `${import.meta.env.VITE_API_BASE_URL}/listings/${listingId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_sold: nextIsSold }),
        }
      );
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
      const res = await authFetch(
        navigate,
        `${import.meta.env.VITE_API_BASE_URL}/listings/${listingId}`,
        {
          method: "DELETE",
        }
      );
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

        {/* Create Listing Button */}
        <button
          onClick={() => navigate("/create-listing")}
          className="w-full bg-black text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-600 focus:ring-offset-2"
        >
          + Create New Listing
        </button>

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
          <div className="space-y-8">
            {/* Active listings */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-black">
                Active Listings
              </h2>
              {listings.filter((l) => !l.is_sold).length === 0 ? (
                <div className="text-sm text-gray-600">No active listings.</div>
              ) : (
                listings
                  .filter((l) => !l.is_sold)
                  .map((l) => (
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
                            <span className="text-gray-400 text-xs">
                              No Image
                            </span>
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
                          <div className="text-sm text-gray-700">
                            ${l.price}
                          </div>
                          <div className="text-sm text-gray-600 line-clamp-2">
                            {l.description}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Posted:{" "}
                            {l.posted_at
                              ? new Date(l.posted_at).toLocaleDateString()
                              : ""}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          onClick={() => navigate(`/edit-listing/${l.id}`)}
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
                    </div>
                  ))
              )}
            </div>

            {/* Sold listings */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-black">
                Sold Listings
              </h2>
              {listings.filter((l) => l.is_sold).length === 0 ? (
                <div className="text-sm text-gray-600">No sold listings.</div>
              ) : (
                listings
                  .filter((l) => l.is_sold)
                  .map((l) => (
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
                            <span className="text-gray-400 text-xs">
                              No Image
                            </span>
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-bold text-black truncate">
                              {l.title}
                            </div>
                            <span className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-800">
                              SOLD
                            </span>
                          </div>
                          <div className="text-sm text-gray-700">
                            ${l.price}
                          </div>
                          <div className="text-sm text-gray-600 line-clamp-2">
                            {l.description}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Posted:{" "}
                            {l.posted_at
                              ? new Date(l.posted_at).toLocaleDateString()
                              : ""}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          onClick={() => navigate(`/edit-listing/${l.id}`)}
                          className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleSold(l.id, !l.is_sold)}
                          className="px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800"
                        >
                          Mark Available
                        </button>
                        <button
                          onClick={() => deleteListing(l.id)}
                          className="px-4 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
