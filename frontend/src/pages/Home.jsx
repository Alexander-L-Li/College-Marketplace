import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, User, Inbox as InboxIcon, LogOut, Tag } from "lucide-react";
import { authFetch, logout } from "@/lib/auth";

function Home() {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name_asc");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const apiBase = import.meta.env.VITE_API_BASE_URL;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const searchDebounceRef = useRef(null);

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
  }, [apiBase, navigate, searchQuery, sortBy]);

  async function handleLogout(e) {
    e.preventDefault();
    logout(navigate);
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
                  Inbox
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

        {/* Create Listing Button */}
        <div className="flex justify-center">
          <button
            onClick={() => navigate("/create-listing")}
            className="w-full bg-black text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-600 focus:ring-offset-2"
          >
            + Create New Listing
          </button>
        </div>

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
                <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                  {listing.cover_image_url ? (
                    <img
                      src={listing.cover_image_url}
                      alt={listing.title}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <span className="text-gray-400 text-xs">No Image</span>
                  )}
                </div>

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
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Home;
