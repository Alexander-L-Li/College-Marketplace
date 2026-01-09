import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authFetch, logout, requireAuth } from "@/lib/auth";

function CreateListing() {
  const navigate = useNavigate();
  const [images, setImages] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [userCollege, setUserCollege] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    price: "",
    description: "",
    categories: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [uploadedImageKeys, setUploadedImageKeys] = useState([]); // Store S3 keys after upload

  // Check authentication on component mount
  useEffect(() => {
    const token = requireAuth(navigate);
    if (!token) return;

    // Fetch categories from backend
    fetchCategories();
    fetchProfileCollege();
  }, [navigate]);

  const fetchCategories = async () => {
    try {
      const response = await authFetch(
        navigate,
        `${import.meta.env.VITE_API_BASE_URL}/categories`
      );

      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  };

  const fetchProfileCollege = async () => {
    try {
      const res = await authFetch(
        navigate,
        `${import.meta.env.VITE_API_BASE_URL}/profile`
      );
      if (res.ok) {
        const data = await res.json();
        setUserCollege(data.college || "");
      }
    } catch (err) {
      console.error("Failed to fetch profile college:", err);
    }
  };

  const handleImageUpload = (files) => {
    const newImages = Array.from(files).filter((file) => {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        setError("Please upload only image files");
        return false;
      }

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        setError("Image size must be less than 10MB");
        return false;
      }

      return true;
    });

    if (images.length + newImages.length > 6) {
      setError("Maximum 6 images allowed");
      return;
    }

    // Create preview URLs and add to images array
    const imageObjects = newImages.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      is_cover: images.length === 0, // First image is cover
    }));

    setImages((prev) => [...prev, ...imageObjects]);
    setError(""); // Clear any previous errors
  };

  const removeImage = (index) => {
    setImages((prev) => {
      const newImages = prev.filter((_, i) => i !== index);
      // If we removed the cover image (index 0), make the next image the cover
      if (index === 0 && newImages.length > 0) {
        newImages[0].is_cover = true;
      }
      return newImages;
    });
  };

  // Cleanup preview URLs when component unmounts
  useEffect(() => {
    return () => {
      images.forEach((image) => {
        if (image.preview) {
          URL.revokeObjectURL(image.preview);
        }
      });
    };
  }, [images]);

  const isFormValid = () => {
    return (
      images.length > 0 &&
      uploadedImageKeys.length === images.length && // All images must be uploaded
      formData.title.trim() !== "" &&
      formData.price !== "" &&
      parseFloat(formData.price) > 0 &&
      formData.description.trim() !== "" &&
      formData.categories.length > 0
    );
  };

  // Upload images to S3 before showing form
  const handleUploadImages = async () => {
    if (images.length === 0) {
      setError("Please upload at least one image");
      return;
    }

    setIsUploadingImages(true);
    setError("");

    try {
      const token = requireAuth(navigate);
      if (!token) return;

      // Step 1: Get presigned upload URLs from backend
      const filesData = images.map((img) => ({
        filename: img.file.name,
        contentType: img.file.type,
      }));

      const uploadUrlsResponse = await authFetch(
        navigate,
        `${import.meta.env.VITE_API_BASE_URL}/s3/upload-urls`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ files: filesData }),
        }
      );

      if (!uploadUrlsResponse.ok) {
        const errorText = await uploadUrlsResponse.text();
        throw new Error(errorText || "Failed to get upload URLs");
      }

      const { uploadUrls } = await uploadUrlsResponse.json();

      // Step 2: Upload each image directly to S3 using presigned URLs
      const uploadedKeys = [];
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const { uploadURL, key } = uploadUrls[i];

        // Upload file directly to S3
        const uploadResponse = await fetch(uploadURL, {
          method: "PUT",
          headers: {
            "Content-Type": image.file.type,
          },
          body: image.file,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload image ${i + 1}`);
        }

        uploadedKeys.push({
          key: key,
          is_cover: image.is_cover,
        });
      }

      // Step 3: Store S3 keys and show form
      setUploadedImageKeys(uploadedKeys);
      setShowForm(true);
    } catch (err) {
      console.error("Image upload error:", err);
      setError(err.message || "Failed to upload images. Please try again.");
    } finally {
      setIsUploadingImages(false);
    }
  };

  const handleSubmit = async () => {
    if (!isFormValid()) {
      setError("Please fill in all required fields");
      return;
    }
    if (!userCollege) {
      setError(
        "Unable to determine your college. Please refresh and try again."
      );
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await authFetch(
        navigate,
        `${import.meta.env.VITE_API_BASE_URL}/listings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: formData.title,
            price: parseFloat(formData.price),
            description: formData.description,
            categories: formData.categories,
            college: userCollege,
            image_urls: uploadedImageKeys.map((img) => ({
              url: img.key, // S3 key (e.g., "listings/1234567890-filename.jpg")
              is_cover: img.is_cover,
            })),
          }),
        }
      );

      if (response.ok) {
        // Success! Redirect to home page
        navigate("/home");
      } else {
        const errorText = await response.text();
        setError(errorText || "Failed to create listing");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white px-4 py-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-black">Create New Listing</h1>
          <button
            onClick={() => navigate("/home")}
            className="text-gray-600 hover:text-black transition-colors"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Image Upload Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-black">Upload Images</h2>
          <p className="text-sm text-gray-600">
            Upload up to 6 images of your item
          </p>

          {/* Drag & Drop Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              dragActive
                ? "border-black bg-gray-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              handleImageUpload(e.dataTransfer.files);
            }}
            onClick={() => document.getElementById("file-input").click()}
          >
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-600">
              Drag and drop images here, or click anywhere to browse files
            </p>
            <p className="mt-1 text-xs text-gray-500">
              PNG, JPG, GIF up to 10MB each
            </p>
            <input
              id="file-input"
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => handleImageUpload(e.target.files)}
            />
          </div>

          {/* Image Preview Grid */}
          {images.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-md font-medium text-black">
                Preview ({images.length}/6)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map((image, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={image.preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      ×
                    </button>
                    {index === 0 && (
                      <div className="absolute top-1 left-1 bg-black text-white text-xs px-2 py-1 rounded">
                        Cover
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Proceed to Form Button */}
              <div className="pt-4">
                <button
                  onClick={handleUploadImages}
                  disabled={isUploadingImages}
                  className="w-full bg-black text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-600 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isUploadingImages
                    ? "Uploading Images..."
                    : "Proceed to Form"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Form Fields Section */}
        {showForm && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-black">Item Details</h2>

            {/* Title Input */}
            <div className="space-y-2">
              <label
                htmlFor="title"
                className="block text-sm font-medium text-gray-700"
              >
                Item Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    title: e.target.value.toUpperCase(),
                  }))
                }
                placeholder="e.g., Black Patagonia Down Jacket"
                className="w-full px-3 py-3 border border-gray-300 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                required
              />
            </div>

            {/* Price Input */}
            <div className="space-y-2">
              <label
                htmlFor="price"
                className="block text-sm font-medium text-gray-700"
              >
                Price <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-gray-500">$</span>
                <input
                  type="number"
                  id="price"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, price: e.target.value }))
                  }
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full pl-8 pr-3 py-3 border border-gray-300 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Description Input */}
            <div className="space-y-2">
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700"
              >
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Describe your item in detail..."
                rows={4}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none"
                required
              />
            </div>

            {/* Categories Multi-Select */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Categories <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((category) => (
                  <label
                    key={category.id}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formData.categories.includes(category.name)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData((prev) => ({
                            ...prev,
                            categories: [...prev.categories, category.name],
                          }));
                        } else {
                          setFormData((prev) => ({
                            ...prev,
                            categories: prev.categories.filter(
                              (cat) => cat !== category.name
                            ),
                          }));
                        }
                      }}
                      className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black focus:ring-2"
                    />
                    <span className="text-sm text-gray-700">
                      {category.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !isFormValid()}
                className="w-full bg-black text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-600 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Creating Listing..." : "Create Listing"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CreateListing;
