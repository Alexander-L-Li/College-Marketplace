import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

function Profile() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success"); // "success" | "error"
  const [dorms, setDorms] = useState([]);
  const [profileImage, setProfileImage] = useState(null);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    dorm_id: "",
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchDorms = async (college) => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/dorms/${college}`
      );
      if (res.ok) {
        const dormsData = await res.json();
        setDorms(dormsData);
      }
    } catch (err) {
      console.error("Error fetching dorms:", err);
    }
  };

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/");
        return;
      }

      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("token");
          navigate("/");
          return;
        }
        throw new Error("Failed to fetch profile");
      }

      const data = await res.json();
      setProfile(data);
      // If backend returns a presigned URL, show it as the current avatar
      if (data.profile_image_url) {
        setProfileImage(data.profile_image_url);
      }
      setEditForm({
        first_name: data.first_name,
        last_name: data.last_name,
        username: data.username,
        dorm_id: data.dorm_id || "",
      });

      // Fetch dorms for the user's college
      await fetchDorms(data.college);
    } catch (err) {
      console.error("Error fetching profile:", err);
      setMessage("Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setMessage("");
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditForm({
      first_name: profile.first_name,
      last_name: profile.last_name,
      username: profile.username,
      dorm_id: profile.dorm_id || "",
    });
    setMessage("");
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText);
      }

      const updatedProfile = await res.json();
      setProfile(updatedProfile);
      setIsEditing(false);
      setMessageType("success");
      setMessage("Profile updated successfully!");
    } catch (err) {
      console.error("Error updating profile:", err);
      setMessageType("error");
      setMessage(err.message || "Failed to update profile");
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/");
        return;
      }

      // Optional: show an immediate local preview while upload happens
      const localPreview = URL.createObjectURL(file);
      setProfileImage(localPreview);

      // 1) Ask backend for a presigned S3 PUT URL
      const qs = new URLSearchParams({
        filename: file.name,
        contentType: file.type,
      });
      const presignRes = await fetch(
        `${
          import.meta.env.VITE_API_BASE_URL
        }/s3/profile-upload-url?${qs.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!presignRes.ok) {
        const t = await presignRes.text();
        throw new Error(t || "Failed to get profile upload URL");
      }
      const { uploadURL, key } = await presignRes.json();

      // 2) Upload directly to S3
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error("Failed to upload profile picture to S3");
      }

      // 3) Persist the S3 key on the user record
      const saveRes = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/profile/avatar`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ profile_image_key: key }),
        }
      );
      if (!saveRes.ok) {
        const t = await saveRes.text();
        throw new Error(t || "Failed to save profile picture");
      }

      const saved = await saveRes.json();
      setProfileImage(saved.profile_image_url || localPreview);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              profile_image_url: saved.profile_image_url,
              profile_image_key: saved.profile_image_key,
            }
          : prev
      );
      setMessageType("success");
      setMessage("Profile picture updated!");
    } catch (err) {
      console.error("Profile image upload error:", err);
      setMessageType("error");
      setMessage(err.message || "Failed to upload profile picture");
    } finally {
      // reset file input so re-uploading the same file triggers onChange
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/home")}
            className="p-2"
          >
            <svg
              className="h-4 w-4"
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
          </Button>
          <h1 className="text-xl font-bold text-foreground">
            {isEditing ? "Edit Profile" : "Profile"}
          </h1>
          <div className="w-10"></div>
        </div>

        {/* Profile Image */}
        <div className="text-center">
          <div className="relative inline-block">
            <Avatar className="w-24 h-24 mx-auto">
              <AvatarImage src={profileImage} />
              <AvatarFallback className="text-lg">
                {profile?.first_name?.[0]}
                {profile?.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <Button
              size="sm"
              variant="outline"
              className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Tap camera icon to upload photo
          </p>
        </div>

        {/* Profile Info */}
        {!isEditing ? (
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-black">
                {profile?.first_name} {profile?.last_name}
              </h2>
              <p className="text-gray-600">@{profile?.username}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Email
                </label>
                <p className="text-black">{profile?.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  College
                </label>
                <p className="text-black">{profile?.college}</p>
              </div>
              {profile?.dorm_name && (
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Dorm
                  </label>
                  <p className="text-black">{profile?.dorm_name}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Member Since
                </label>
                <p className="text-black">
                  {new Date(profile?.created_at).toLocaleDateString()}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Status
                </label>
                <p className="text-black">
                  {profile?.is_verified ? (
                    <span className="text-green-600">✓ Verified</span>
                  ) : (
                    <span className="text-red-600">⚠ Not Verified</span>
                  )}
                </p>
              </div>
            </div>

            <Button onClick={handleEdit} className="w-full">
              Edit Profile
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            className="space-y-6"
          >
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-4">
              <h3 className="text-lg font-semibold text-black mb-4">
                Edit Profile
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <Input
                  type="text"
                  value={editForm.username}
                  onChange={(e) =>
                    setEditForm({ ...editForm, username: e.target.value })
                  }
                  placeholder="Enter username"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name
                  </label>
                  <Input
                    type="text"
                    value={editForm.first_name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, first_name: e.target.value })
                    }
                    placeholder="First name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name
                  </label>
                  <Input
                    type="text"
                    value={editForm.last_name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, last_name: e.target.value })
                    }
                    placeholder="Last name"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <Input
                  type="email"
                  value={profile?.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Email cannot be changed
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dorm
                </label>
                <select
                  value={editForm.dorm_id}
                  onChange={(e) =>
                    setEditForm({ ...editForm, dorm_id: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="">Select a dorm</option>
                  {dorms.map((dorm) => (
                    <option key={dorm.id} value={dorm.id}>
                      {dorm.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  Save Changes
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* Logout Button */}
        <Button
          onClick={handleLogout}
          variant="outline"
          className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors"
        >
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          Logout
        </Button>

        {/* Message Display */}
        {message && (
          <Alert
            variant={messageType === "error" ? "destructive" : "default"}
            className={
              messageType === "error"
                ? "text-center"
                : "text-center border-green-200 bg-green-50 text-green-800"
            }
          >
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}

export default Profile;
