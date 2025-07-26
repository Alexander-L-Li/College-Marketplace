import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

function Home() {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name_asc");

  const filteredListings = listings
    .filter((listing) =>
      listing.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "name_asc") return a.title.localeCompare(b.title);
      if (sortBy === "name_desc") return b.title.localeCompare(a.title);
      if (sortBy === "price_asc") return a.price - b.price;
      if (sortBy === "price_desc") return b.price - a.price;
      if (sortBy === "latest")
        return new Date(b.posted_at) - new Date(a.posted_at);
      if (sortBy === "oldest")
        return new Date(a.posted_at) - new Date(b.posted_at);
      return 0;
    });

  useEffect(() => {
    const token = localStorage.getItem("token");
    console.log(
      "Home.jsx - Token retrieved from localStorage:",
      token ? "Token exists" : "No token"
    );

    if (!token) {
      console.log("No token found, redirecting to login");
      navigate("/");
      return;
    }

    try {
      const { exp } = jwtDecode(token);
      console.log("Token expiration check:", {
        exp,
        currentTime: Date.now(),
        isExpired: Date.now() >= exp * 1000,
      });
      if (Date.now() >= exp * 1000) {
        console.log("Token expired, redirecting to login");
        localStorage.removeItem("token");
        navigate("/");
        return;
      }
    } catch (e) {
      console.log("Token decode error:", e);
      localStorage.removeItem("token");
      navigate("/");
      return;
    }

    async function fetchListings() {
      try {
        console.log(
          "Making request to /listings with token:",
          token ? "Token exists" : "No token"
        );
        const res = await fetch("http://localhost:3001/listings", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        console.log("Response status:", res.status);
        if (!res.ok) {
          const errorText = await res.text();
          console.log("Error response:", errorText);
          throw new Error(errorText || "Failed to fetch listings");
        }

        const data = await res.json();
        console.log("Listings fetched successfully:", data.length, "items");
        setListings(data);
      } catch (err) {
        console.error("fetchListings error:", err);
      }
    }

    fetchListings();
  }, [navigate]);

  async function handleLogout(e) {
    e.preventDefault();
    localStorage.removeItem("token");
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-white px-4 py-6">
      <div className="max-w mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black mb-2">Dorm Space</h1>
          <p className="text-gray-600 text-sm">
            MIT's exclusive campus marketplace.
          </p>
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
        {filteredListings.map((listing) => (
          <div
            key={listing.id}
            onClick={() => handleListingClick(listing.id)}
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
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Home;
