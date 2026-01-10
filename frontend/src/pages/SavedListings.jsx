import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";
import { authFetch } from "@/lib/auth";

export default function SavedListings() {
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
        `${import.meta.env.VITE_API_BASE_URL}/saved-listings`
      );
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Failed to load saved listings");
      }
      const data = await res.json();
      setListings(data.listings || []);
    } catch (err) {
      setError(err.message || "Failed to load saved listings");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function unsave(listingId) {
    setError("");
    try {
      const res = await authFetch(
        navigate,
        `${import.meta.env.VITE_API_BASE_URL}/saved-listings/${listingId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Failed to unsave listing");
      }
      setListings((prev) => prev.filter((l) => l.id !== listingId));
    } catch (err) {
      setError(err.message || "Failed to unsave listing");
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
          <h1 className="text-xl font-bold text-black">Saved</h1>
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
            No saved listings yet.
          </div>
        ) : (
          <div className="space-y-4">
            {listings.map((listing) => (
              <div
                key={listing.id}
                className="bg-white border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => navigate(`/listing/${listing.id}`)}
                    className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center"
                    title="View listing"
                  >
                    {listing.cover_image_url ? (
                      <img
                        src={listing.cover_image_url}
                        alt={listing.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-gray-400 text-xs">No Image</span>
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-black truncate">
                      {listing.title}
                    </div>
                    <div className="text-sm text-gray-700">${listing.price}</div>
                    <div className="text-sm text-gray-600 truncate">
                      by {listing.first_name} {listing.last_name} (@
                      {listing.username})
                    </div>
                  </div>

                  <button
                    onClick={() => unsave(listing.id)}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                    aria-label="Unsave"
                    title="Unsave"
                  >
                    <Heart className="w-5 h-5 fill-red-500 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


