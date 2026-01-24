import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { authFetch } from "@/lib/auth";
import { Trash2 } from "lucide-react";

export default function EditListing() {
  const navigate = useNavigate();
  const { id } = useParams(); // listing id

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isSavingSold, setIsSavingSold] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [aiError, setAiError] = useState("");

  const [listing, setListing] = useState(null);
  const [allCategories, setAllCategories] = useState([]);

  const [form, setForm] = useState({
    title: "",
    price: "",
    description: "",
    categories: [],
    is_sold: false,
  });

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError("");
      try {
        // Fetch listing details (includes categories and is_sold)
        const listingRes = await authFetch(
          navigate,
          `${import.meta.env.VITE_API_BASE_URL}/listing/${id}`
        );
        if (!listingRes.ok) {
          const t = await listingRes.text();
          throw new Error(t || "Failed to load listing");
        }
        const data = await listingRes.json();
        setListing(data);

        // Fetch category options
        const catsRes = await authFetch(
          navigate,
          `${import.meta.env.VITE_API_BASE_URL}/categories`
        );
        if (catsRes.ok) {
          const cats = await catsRes.json();
          setAllCategories(cats || []);
        }

        setForm({
          title: data.title || "",
          price: data.price ?? "",
          description: data.description || "",
          categories: Array.isArray(data.categories) ? data.categories : [],
          is_sold: !!data.is_sold,
        });
      } catch (err) {
        setError(err.message || "Failed to load listing");
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [id, navigate]);

  async function reloadListing() {
    const listingRes = await authFetch(
      navigate,
      `${import.meta.env.VITE_API_BASE_URL}/listing/${id}`
    );
    if (!listingRes.ok) {
      const t = await listingRes.text();
      throw new Error(t || "Failed to reload listing");
    }
    const data = await listingRes.json();
    setListing(data);
    setForm((p) => ({ ...p, is_sold: !!data.is_sold }));
  }

  async function toggleSold(nextIsSold) {
    setError("");
    setIsSavingSold(true);
    // optimistic
    setForm((p) => ({ ...p, is_sold: nextIsSold }));
    try {
      const res = await authFetch(
        navigate,
        `${import.meta.env.VITE_API_BASE_URL}/listings/${id}`,
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
      await reloadListing();
    } catch (err) {
      // revert
      setForm((p) => ({ ...p, is_sold: !nextIsSold }));
      setError(err.message || "Failed to update sold status");
    } finally {
      setIsSavingSold(false);
    }
  }

  async function setCover(imageId) {
    setError("");
    try {
      const res = await authFetch(
        navigate,
        `${
          import.meta.env.VITE_API_BASE_URL
        }/listings/${id}/images/${imageId}/cover`,
        { method: "PATCH" }
      );
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Failed to set cover image");
      }
      await reloadListing();
    } catch (err) {
      setError(err.message || "Failed to set cover image");
    }
  }

  async function deleteImage(imageId) {
    setError("");
    try {
      const res = await authFetch(
        navigate,
        `${import.meta.env.VITE_API_BASE_URL}/listings/${id}/images/${imageId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Failed to delete image");
      }
      await reloadListing();
    } catch (err) {
      setError(err.message || "Failed to delete image");
    }
  }

  async function addImages(files) {
    const selected = Array.from(files || []);
    if (selected.length === 0) return;

    // basic validation
    for (const f of selected) {
      if (!f.type.startsWith("image/")) {
        setError("Please upload only image files.");
        return;
      }
      if (f.size > 10 * 1024 * 1024) {
        setError("Image size must be less than 10MB.");
        return;
      }
    }

    const existingCount = listing?.images?.length || 0;
    if (existingCount + selected.length > 6) {
      setError("Maximum 6 images allowed per listing.");
      return;
    }

    setIsUploadingImages(true);
    setError("");
    try {
      // 1) get presigned upload urls
      const filesData = selected.map((f) => ({
        filename: f.name,
        contentType: f.type,
      }));

      const uploadUrlsResponse = await authFetch(
        navigate,
        `${import.meta.env.VITE_API_BASE_URL}/s3/upload-urls`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: filesData }),
        }
      );
      if (!uploadUrlsResponse.ok) {
        const t = await uploadUrlsResponse.text();
        throw new Error(t || "Failed to get upload URLs");
      }
      const { uploadUrls } = await uploadUrlsResponse.json();

      // 2) upload each file to S3
      const uploaded = [];
      for (let i = 0; i < selected.length; i++) {
        const file = selected[i];
        const { uploadURL, key } = uploadUrls[i];
        const putRes = await fetch(uploadURL, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!putRes.ok) {
          throw new Error(`Failed to upload image ${i + 1}`);
        }
        uploaded.push({ url: key, is_cover: false });
      }

      // 3) attach keys to listing
      const attachRes = await authFetch(
        navigate,
        `${import.meta.env.VITE_API_BASE_URL}/listings/${id}/images`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_urls: uploaded }),
        }
      );
      if (!attachRes.ok) {
        const t = await attachRes.text();
        throw new Error(t || "Failed to attach images to listing");
      }

      await reloadListing();
    } catch (err) {
      setError(err.message || "Failed to upload images");
    } finally {
      setIsUploadingImages(false);
    }
  }

  const toggleCategory = (name) => {
    setForm((prev) => {
      const has = prev.categories.includes(name);
      return {
        ...prev,
        categories: has
          ? prev.categories.filter((c) => c !== name)
          : [...prev.categories, name],
      };
    });
  };

  async function generateListing() {
    setAiError("");
    setError("");

    if (!listing?.images?.length) {
      setAiError("No images available to analyze.");
      return;
    }

    // Get the S3 key from the cover image or first image
    const coverImage = listing.images.find((img) => img.is_cover) || listing.images[0];
    if (!coverImage?.image_key) {
      setAiError("Unable to access image for AI analysis.");
      return;
    }

    setIsGenerating(true);
    try {
      const res = await authFetch(
        navigate,
        `${import.meta.env.VITE_API_BASE_URL}/ai/generate-listing`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_keys: [coverImage.image_key],
            category_hints: form.categories.length > 0 ? form.categories : null,
            max_images: 1,
          }),
        }
      );

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Failed to generate listing details");
      }

      const data = await res.json();
      const { title, description } = data || {};
      if (!title || !description) {
        throw new Error("AI returned invalid data.");
      }

      setForm((prev) => ({ ...prev, title, description }));
    } catch (err) {
      setAiError(err.message || "Failed to generate listing details.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSave() {
    setError("");
    setIsSaving(true);
    try {
      const res = await authFetch(
        navigate,
        `${import.meta.env.VITE_API_BASE_URL}/listings/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title,
            price: Number(form.price),
            description: form.description,
            categories: form.categories,
            is_sold: form.is_sold,
          }),
        }
      );
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Failed to update listing");
      }
      navigate(`/listing/${id}`);
    } catch (err) {
      setError(err.message || "Failed to update listing");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-white px-4 py-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-600 hover:text-black transition-colors"
          >
            ← Back
          </button>
          <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
            <h1 className="text-xl font-bold text-black truncate">
              Edit Listing
            </h1>
            {form.is_sold ? (
              <span className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-800">
                SOLD
              </span>
            ) : null}
          </div>
          <div className="w-12" />
        </div>

        {isLoading ? (
          <div className="text-center text-gray-600 py-8">Loading...</div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        ) : !listing ? (
          <div className="text-center text-gray-600">Listing not found.</div>
        ) : (
          <div className="space-y-6">
            {/* Photos */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-black">Photos</h2>
                <label className="text-sm text-blue-700 hover:text-blue-800 cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => addImages(e.target.files)}
                    disabled={isUploadingImages}
                  />
                  {isUploadingImages ? "Uploading..." : "+ Add Photos"}
                </label>
              </div>

              <div className="text-xs text-gray-500">
                Max 6 images. Set a cover image to control the thumbnail shown
                in the feed.
              </div>

              {listing.images?.length ? (
                <div className="grid grid-cols-3 gap-2">
                  {listing.images.map((img) => (
                    <div
                      key={img.id}
                      className="relative rounded-lg overflow-hidden border border-gray-200 bg-white"
                    >
                      {img.is_cover ? (
                        <div className="absolute top-1 left-1 bg-black/80 text-white text-[10px] px-2 py-0.5 rounded-full">
                          Cover
                        </div>
                      ) : null}
                      <img
                        src={img.image_url}
                        alt="Listing"
                        className="w-full h-24 object-cover"
                      />

                      <div className="p-2 flex items-center justify-between gap-2">
                        <button
                          onClick={() => setCover(img.id)}
                          disabled={isUploadingImages}
                          className="text-[11px] text-blue-700 hover:text-blue-800"
                        >
                          Set cover
                        </button>
                        <button
                          onClick={() => deleteImage(img.id)}
                          disabled={isUploadingImages}
                          className="p-1 rounded hover:bg-gray-100"
                          aria-label="Delete image"
                          title="Delete image"
                        >
                          <Trash2 className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-600">No photos yet.</div>
              )}
            </div>

            {/* AI Generation */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-black">Generate with AI</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Auto-generate title and description from your photos
                  </p>
                </div>
                <button
                  type="button"
                  onClick={generateListing}
                  disabled={isGenerating || !listing?.images?.length}
                  className="px-4 py-2 text-sm font-semibold bg-black text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {isGenerating ? "Generating..." : "Generate"}
                </button>
              </div>
              {aiError && (
                <p className="text-sm text-red-600 mt-2">{aiError}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Title
              </label>
              <input
                className="w-full px-3 py-3 border border-gray-300 rounded-lg text-black"
                value={form.title}
                onChange={(e) =>
                  setForm((p) => ({ ...p, title: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Price
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full px-3 py-3 border border-gray-300 rounded-lg text-black"
                value={form.price}
                onChange={(e) =>
                  setForm((p) => ({ ...p, price: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                rows={5}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg text-black resize-none"
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Categories
              </label>

              {allCategories.length === 0 ? (
                <div className="text-sm text-gray-600">
                  No categories loaded.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {allCategories.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 text-sm text-gray-700"
                    >
                      <input
                        type="checkbox"
                        checked={form.categories.includes(c.name)}
                        onChange={() => toggleCategory(c.name)}
                        className="w-4 h-4"
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Status (bottom-of-page) */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.is_sold}
                      onChange={(e) => toggleSold(e.target.checked)}
                      className="w-4 h-4"
                      disabled={isSavingSold}
                    />
                    Mark as sold
                  </label>
                  {form.is_sold ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-800">
                      SOLD
                    </span>
                  ) : null}
                </div>
                {isSavingSold ? (
                  <div className="text-xs text-gray-500">Saving…</div>
                ) : null}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Sold listings won’t appear in the marketplace feed/search.
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => navigate(`/listing/${id}`)}
                className="flex-1 px-4 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 px-4 py-3 rounded-lg bg-black text-white hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
