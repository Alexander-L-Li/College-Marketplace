import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { authFetch } from "@/lib/auth";

export default function EditListing() {
  const navigate = useNavigate();
  const { id } = useParams(); // listing id

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

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
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-600 hover:text-black transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold text-black">Edit Listing</h1>
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
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-black truncate">
                  {listing.title}
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.is_sold}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, is_sold: e.target.checked }))
                    }
                    className="w-4 h-4"
                  />
                  Mark as sold
                </label>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Toggling sold status requires `listings.is_sold` migration.
              </div>
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


