import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [sortBy, setSortBy] = useState("name"); // name, price, time

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
        // console.log(data); delete this later
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
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black mb-2">Dorm Drop</h1>
          <p className="text-gray-600 text-sm">MIT Campus Marketplace</p>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
          />
        </div>
      </div>
      <div>
        {listings.map((item, index) => (
          <div key={index}>{/* Your Tailwind card design here */}</div>
        ))}
      </div>
    </div>
  );
}

export default Home;
