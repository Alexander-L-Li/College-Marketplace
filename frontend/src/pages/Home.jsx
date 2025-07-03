import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name"); // name, price, time

  const filteredListings = listings
    .filter((listing) =>
      listing.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "price") return a.price - b.price;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return 0;
    });

  useEffect(() => {
    const session = localStorage.getItem("session");
    if (!session) {
      navigate("/");
    }

    async function fetchListings() {
      try {
        const res = await fetch("http://localhost:3001/listings");
        const data = await res.json();
        setListings(data);
        // console.log(data);
      } catch (err) {
        console.error(err);
      }
    }

    fetchListings();
  }, [navigate]);

  async function handleLogout(e) {
    e.preventDefault();
    localStorage.removeItem("session");
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-white px-4 py-6">
      <div className="max-w mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black mb-2">Dorm Drop</h1>
          <p className="text-gray-600 text-sm">MIT Campus Marketplace</p>
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
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-black">Current Listings</h2>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-black"
          >
            <option value="name">Sort by Name</option>
            <option value="price">Sort by Price</option>
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
              {/* Image Placeholder */}
              <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                <span className="text-gray-400 text-xs">No Image</span>
              </div>

              {/* Item Info */}
              <div className="flex-1">
                <h3 className="font-bold text-black text-base">
                  {listing.name}
                </h3>
                <p className="text-lg font-semibold text-black">
                  ${listing.price}
                </p>
                <p className="text-sm text-gray-600">
                  {listing.seller} • {listing.dorm}
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
