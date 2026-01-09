import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { authFetch, logout } from "@/lib/auth";

function ListingDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [listing, setListing] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Check authentication on component mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const decoded = jwtDecode(token);
      const { exp } = decoded;
      if (Date.now() >= exp * 1000) {
        logout(navigate);
        return;
      }
      if (decoded?.id) {
        setCurrentUserId(decoded.id);
      }
    } catch (e) {
      logout(navigate);
      return;
    }

    fetchListing();
  }, [navigate, id]);

  const fetchListing = async () => {
    try {
      const response = await authFetch(
        navigate,
        `${import.meta.env.VITE_API_BASE_URL}/listing/${id}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to fetch listing");
      }

      const data = await response.json();
      setListing(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContactSeller = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/conversations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ listing_id: id }),
        }
      );

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Failed to open conversation");
      }

      const data = await res.json();
      const convoId = data?.conversation?.id;
      if (!convoId) {
        throw new Error("Conversation not created.");
      }

      navigate(`/inbox/${convoId}`);
    } catch (err) {
      console.error("Contact seller error:", err);
      setError(err.message || "Failed to contact seller");
    }
  };

  const nextImage = () => {
    if (listing && listing.images && listing.images.length > 1) {
      setCurrentImageIndex((prev) =>
        prev === listing.images.length - 1 ? 0 : prev + 1
      );
    }
  };

  const prevImage = () => {
    if (listing && listing.images && listing.images.length > 1) {
      setCurrentImageIndex((prev) =>
        prev === 0 ? listing.images.length - 1 : prev - 1
      );
    }
  };

  const goToImage = (index) => {
    setCurrentImageIndex(index);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading listing...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
            <button
              onClick={() => navigate("/home")}
              className="mt-4 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-white px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <p className="text-gray-600">Listing not found</p>
            <button
              onClick={() => navigate("/home")}
              className="mt-4 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-4 py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/home")}
            className="text-gray-600 hover:text-black transition-colors flex items-center space-x-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span>Back to Listings</span>
          </button>
          <h1 className="hidden md:block text-2xl font-bold text-black">
            {listing.title}
          </h1>
          <div className="w-20"></div> {/* Spacer for centering */}
        </div>

        {/* Image Carousel */}
        <div className="relative flex justify-center">
          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden w-full max-w-md lg:max-w-lg">
            {listing.images &&
            listing.images.length > 0 &&
            (listing.images[currentImageIndex]?.image_url ||
              listing.images[currentImageIndex]?.url) &&
            !(
              listing.images[currentImageIndex]?.image_url ||
              listing.images[currentImageIndex]?.url
            ).startsWith("blob:") ? (
              <img
                src={
                  listing.images[currentImageIndex]?.image_url ||
                  listing.images[currentImageIndex]?.url
                }
                alt={listing.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <span>No Image Available</span>
              </div>
            )}
          </div>

          {/* Navigation Arrows */}
          {listing.images && listing.images.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-75 transition-all"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <button
                onClick={nextImage}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-75 transition-all"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Image Thumbnails */}
        {listing.images &&
          listing.images.length > 1 &&
          listing.images.some(
            (img) =>
              (img.image_url || img.url) &&
              !(img.image_url || img.url).startsWith("blob:")
          ) && (
            <div className="flex space-x-2 justify-center">
              {listing.images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => goToImage(index)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    index === currentImageIndex
                      ? "border-black"
                      : "border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {(image.image_url || image.url) &&
                  !(image.image_url || image.url).startsWith("blob:") ? (
                    <img
                      src={image.image_url || image.url}
                      alt={`${listing.title} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-400 text-xs">No Image</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

        {/* Listing Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title and Price */}
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-black">{listing.title}</h2>
              <p className="text-4xl font-bold text-black">${listing.price}</p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-black text-center">
                Description
              </h3>
              <p className="text-gray-700 leading-relaxed text-center break-words overflow-wrap-anywhere max-w-full">
                {listing.description}
              </p>
            </div>

            {/* Categories */}
            {listing.categories && listing.categories.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-black text-center">
                  Categories
                </h3>
                <div className="flex flex-wrap gap-2 justify-center">
                  {listing.categories.map((category, index) => (
                    <span
                      key={index}
                      className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm"
                    >
                      {category.name || category}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Seller Information */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="text-lg font-semibold text-black">Seller</h3>
              <div className="space-y-2">
                <p className="text-gray-700">
                  <span className="font-medium">
                    {listing.first_name} {listing.last_name}
                  </span>
                </p>
                <p className="text-gray-600">@{listing.username}</p>
                {listing.dorm_name && (
                  <p className="text-gray-600">{listing.dorm_name}</p>
                )}
                <p className="text-gray-600">{listing.college}</p>
              </div>

              <button
                onClick={() => navigate(`/profile/${listing.user_id}`)}
                className="w-full bg-black text-white py-2 px-4 rounded-lg hover:bg-gray-800 transition-colors text-sm"
              >
                View Profile
              </button>
            </div>

            {/* Listing Info */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="text-lg font-semibold text-black">Listing Info</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p>
                  Posted: {new Date(listing.posted_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {listing.user_id !== currentUserId && (
                <button
                  onClick={handleContactSeller}
                  className="w-full bg-black text-white py-3 px-4 rounded-lg hover:bg-gray-800 transition-colors font-medium"
                >
                  Contact Seller
                </button>
              )}

              {listing.user_id === currentUserId && (
                <button
                  onClick={() => {
                    /* TODO: Implement edit listing */
                  }}
                  className="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                >
                  Edit Listing
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ListingDetails;
