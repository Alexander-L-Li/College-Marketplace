import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu,
  User,
  Inbox as InboxIcon,
  LogOut,
  Tag,
  Heart,
} from "lucide-react";
import { authFetch, logout } from "@/lib/auth";

function CoverThumbnail({ src, alt }) {
  const [errored, setErrored] = useState(false);

  return (
    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
      {src && !errored ? (
        <img
          src={src}
          alt={alt}
          className="object-cover w-full h-full"
          loading="lazy"
          onError={() => setErrored(true)}
        />
      ) : (
        <span className="text-gray-400 text-xs">No Image</span>
      )}
    </div>
  );
}

function Home() {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name_asc");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const apiBase = import.meta.env.VITE_API_BASE_URL;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [unreadTotal, setUnreadTotal] = useState(0);
  const searchDebounceRef = useRef(null);

  const selectableCategories = useMemo(() => {
    return (categories || []).filter(
      (c) => c?.name && String(c.name).trim().toLowerCase() !== "other"
    );
  }, [categories]);

  const categoryIdsParam = useMemo(() => {
    if (!selectedCategoryIds.length) return "";
    return [...selectedCategoryIds].sort().join(",");
  }, [selectedCategoryIds]);

  function toggleCategory(id) {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // Realtime: listen for unread total changes (SSE)
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    let es;
    try {
      es = new EventSource(
        `${apiBase}/events?token=${encodeURIComponent(token)}`
      );

      es.addEventListener("unread", (evt) => {
        try {
          const data = JSON.parse(evt.data);
          setUnreadTotal(data.total_unread || 0);
        } catch {
          // ignore
        }
      });

      es.addEventListener("connected", () => {
        // ignore
      });
    } catch {
      // ignore
    }

    return () => {
      try {
        es?.close();
      } catch {
        // ignore
      }
    };
  }, [apiBase]);

  // Fetch categories for filtering
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await authFetch(navigate, `${apiBase}/categories`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        setCategories(Array.isArray(data) ? data : []);
      } catch (err) {
        if (err?.name === "AbortError") return;
        // ignore (filter UI is optional)
      }
    })();
    return () => controller.abort();
  }, [apiBase, navigate]);

  useEffect(() => {
    const controller = new AbortController();

    // debounce search to avoid firing on every keystroke
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      setError("");

      try {
        const params = new URLSearchParams();
        if (searchQuery.trim()) params.set("search", searchQuery.trim());
        if (sortBy) params.set("sort", sortBy);
        if (categoryIdsParam) params.set("category_ids", categoryIdsParam);
        // Don't show current user's own listings in the marketplace feed
        params.set("exclude_own", "1");

        const url = `${apiBase}/listings?${params.toString()}`;
        const res = await authFetch(navigate, url, {
          signal: controller.signal,
        });

        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || "Failed to fetch listings");
        }

        const data = await res.json();
        setListings(data);
      } catch (err) {
        if (err.name === "AbortError") return;
        setError(err.message || "Failed to fetch listings");
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => controller.abort();
  }, [apiBase, navigate, searchQuery, sortBy, categoryIdsParam]);

  async function handleLogout(e) {
    e.preventDefault();
    logout(navigate);
  }

  async function toggleSave(listingId, nextSaved) {
    try {
      // optimistic update
      setListings((prev) =>
        prev.map((l) =>
          l.id === listingId ? { ...l, is_saved: nextSaved } : l
        )
      );
      const res = await authFetch(
        navigate,
        nextSaved
          ? `${apiBase}/saved-listings`
          : `${apiBase}/saved-listings/${listingId}`,
        nextSaved
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ listing_id: listingId }),
            }
          : { method: "DELETE" }
      );
      if (!res.ok) {
        throw new Error(await res.text());
      }
    } catch (err) {
      // revert on failure
      setListings((prev) =>
        prev.map((l) =>
          l.id === listingId ? { ...l, is_saved: !nextSaved } : l
        )
      );
      setError(err.message || "Failed to update saved state");
    }
  }

  // Close menu on outside click
  useEffect(() => {
    function onDocMouseDown(e) {
      if (!isMenuOpen) return;
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [isMenuOpen]);

  return (
    <div className="min-h-screen bg-white px-4 py-6">
      <div className="max-w mx-auto space-y-6">
        {/* Header */}
        <div className="relative">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-black mb-2">Dorm Space</h1>
          </div>

          {/* Hamburger Menu - Top Right */}
          <div ref={menuRef} className="absolute top-0 right-0">
            <button
              onClick={() => setIsMenuOpen((v) => !v)}
              className="p-2 text-gray-600 hover:text-black transition-colors"
              aria-label="Menu"
            >
              <Menu className="w-6 h-6" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50">
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    navigate("/profile");
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-black hover:bg-gray-50 flex items-center gap-2"
                >
                  <User className="w-4 h-4" />
                  Profile
                </button>
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    navigate("/inbox");
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-black hover:bg-gray-50 flex items-center gap-2"
                >
                  <InboxIcon className="w-4 h-4" />
                  <span className="flex-1">Inbox</span>
                  {unreadTotal > 0 && (
                    <span className="min-w-[22px] h-5 px-2 rounded-full bg-blue-600 text-white text-[11px] font-semibold flex items-center justify-center">
                      {unreadTotal}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    navigate("/my-listings");
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-black hover:bg-gray-50 flex items-center gap-2"
                >
                  <Tag className="w-4 h-4" />
                  My Listings
                </button>
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    navigate("/saved");
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-black hover:bg-gray-50 flex items-center gap-2"
                >
                  <Heart className="w-4 h-4" />
                  Saved
                </button>
                <button
                  onClick={(e) => {
                    setIsMenuOpen(false);
                    handleLogout(e);
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-red-700 hover:bg-red-50 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-3 py-3 border border-gray-300 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
          />
        </div>

        {/* Category Filters */}
        {selectableCategories.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="text-sm font-semibold text-black">
                Filter by category
              </div>
              {selectedCategoryIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedCategoryIds([])}
                  className="text-xs font-semibold text-gray-600 hover:text-black"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {selectableCategories.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 text-sm text-black select-none"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-black"
                    checked={selectedCategoryIds.includes(c.id)}
                    onChange={() => toggleCategory(c.id)}
                  />
                  <span>{c.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Sort Bar */}
        <div className="py-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-black">Current Listings</h2>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-black"
          >
            <option value="name_asc">Name (A to Z)</option>
            <option value="name_desc">Name (Z to A)</option>
            <option value="price_asc">Price (low to high)</option>
            <option value="price_desc">Price (high to low)</option>
            <option value="latest">Latest</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>
      </div>
      {/* Listings */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center text-gray-600 py-8">Loading...</div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        ) : (
          listings.map((listing) => (
            <div
              key={listing.id}
              onClick={() => navigate(`/listing/${listing.id}`)}
              className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-center space-x-4">
                {/* Cover Image */}
                <CoverThumbnail
                  src={listing.cover_image_url}
                  alt={listing.title}
                />

                {/* Item Info */}
                <div className="flex-1">
                  <h3 className="font-bold text-black text-base">
                    {listing.title}
                  </h3>
                  <p className="text-lg font-semibold text-black">
                    ${listing.price}
                  </p>
                  <p className="text-sm text-gray-600">
                    by {listing.first_name} {listing.last_name} (@
                    {listing.username})
                    {listing.dorm_name && ` • ${listing.dorm_name}`}
                  </p>
                </div>

                {/* Save button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSave(listing.id, !listing.is_saved);
                  }}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                  aria-label={listing.is_saved ? "Unsave" : "Save"}
                  title={listing.is_saved ? "Unsave" : "Save"}
                >
                  <Heart
                    className={`w-5 h-5 ${
                      listing.is_saved
                        ? "fill-red-500 text-red-500"
                        : "text-gray-400"
                    }`}
                  />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Home;
