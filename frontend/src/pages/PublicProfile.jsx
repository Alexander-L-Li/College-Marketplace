import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function PublicProfile() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function fetchPublicProfile() {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          navigate("/");
          return;
        }

        const res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/profile/${id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) {
          if (res.status === 401) {
            localStorage.removeItem("token");
            navigate("/");
            return;
          }
          const text = await res.text();
          throw new Error(text || "Failed to load profile");
        }

        const data = await res.json();
        setProfile(data);
      } catch (err) {
        console.error("Error fetching public profile:", err);
        setMessage(err.message || "Failed to load profile");
      } finally {
        setIsLoading(false);
      }
    }

    fetchPublicProfile();
  }, [id, navigate]);

  const initials =
    profile && (profile.first_name || profile.last_name)
      ? `${(profile.first_name || "").slice(0, 1)}${(
          profile.last_name || ""
        ).slice(0, 1)}`.toUpperCase()
      : "U";

  return (
    <div className="min-h-screen bg-white px-4 py-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            Back
          </Button>
          <h1 className="text-xl font-bold text-black">Profile</h1>
          <div className="w-16" />
        </div>

        {message && (
          <Alert>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="text-center text-gray-600">Loading profile...</div>
        ) : !profile ? (
          <div className="text-center text-gray-600">Profile not found.</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
            <div className="flex flex-col items-center text-center space-y-3">
              <Avatar className="h-20 w-20">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>

              <div className="space-y-1">
                <div className="text-xl font-bold text-black">
                  {profile.first_name} {profile.last_name}
                </div>
                <div className="text-gray-600">@{profile.username}</div>
                <div className="text-sm text-gray-600">
                  {profile.college}
                  {profile.dorm_name ? ` • ${profile.dorm_name}` : ""}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-xs text-gray-500">Verified</div>
                <div className="text-sm font-medium text-black">
                  {profile.is_verified ? "Yes" : "No"}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-xs text-gray-500">Joined</div>
                <div className="text-sm font-medium text-black">
                  {profile.created_at
                    ? new Date(profile.created_at).toLocaleDateString()
                    : "—"}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PublicProfile;
