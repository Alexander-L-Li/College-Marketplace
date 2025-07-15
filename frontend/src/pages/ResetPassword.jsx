import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(""); // 'success', 'error'
  const [token, setToken] = useState("");

  useEffect(() => {
    const tokenParam = searchParams.get("token");
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setMessage("Invalid reset link. Please request a new password reset.");
      setMessageType("error");
    }
  }, [searchParams]);

  const validatePasswords = () => {
    if (newPassword.length < 8) {
      setMessage("Password must be at least 8 characters long.");
      setMessageType("error");
      return false;
    }

    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match.");
      setMessageType("error");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validatePasswords()) {
      return;
    }

    if (!token) {
      setMessage("Invalid reset token. Please request a new password reset.");
      setMessageType("error");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token,
            newPassword,
          }),
        }
      );

      if (response.status === 200) {
        setMessage(
          "Password reset successfully! You can now log in with your new password."
        );
        setMessageType("success");
        setNewPassword("");
        setConfirmPassword("");
      } else if (response.status === 400) {
        setMessage(
          "Invalid or expired reset token. Please request a new password reset."
        );
        setMessageType("error");
      } else if (response.status === 404) {
        setMessage(
          "Reset token not found. Please request a new password reset."
        );
        setMessageType("error");
      } else if (response.status === 500) {
        setMessage("Server error. Please try again later.");
        setMessageType("error");
      } else {
        setMessage("An error occurred. Please try again.");
        setMessageType("error");
      }
    } catch (error) {
      setMessage("Network error. Please check your connection and try again.");
      setMessageType("error");
    } finally {
      setIsLoading(false);
    }
  };

  if (!token && !message) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              Reset Password
            </h1>
            <p className="text-muted-foreground text-sm">
              Loading reset form...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Reset Password</h1>
          <p className="text-muted-foreground text-sm">
            Enter your new password below.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full"
                disabled={isLoading || !token}
                minLength={8}
              />
            </div>

            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full"
                disabled={isLoading || !token}
                minLength={8}
              />
            </div>
          </div>

          {/* Message Alert */}
          {message && (
            <Alert
              variant={messageType === "error" ? "destructive" : "default"}
              className={`animate-in slide-in-from-top-2 duration-300 ${
                messageType === "success"
                  ? "border-green-200 bg-green-50 text-green-800"
                  : ""
              }`}
            >
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full font-semibold"
            disabled={isLoading || !newPassword || !confirmPassword || !token}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Resetting Password...
              </>
            ) : (
              "Reset Password"
            )}
          </Button>
        </form>

        {/* Back to Login Link */}
        <div className="text-center">
          {messageType === "success" ? (
            <Link
              to="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 inline-flex items-center gap-1"
            >
              ← Back to Login
            </Link>
          ) : (
            <Link
              to="/forgot-password"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 inline-flex items-center gap-1"
            >
              ← Request New Reset Link
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
