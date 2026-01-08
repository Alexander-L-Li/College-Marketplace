import { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Loader2, Mail, CheckCircle, Clock } from "lucide-react";

const EmailVerification = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const user_id = searchParams.get("user_id") || "";

  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(""); // 'success' | 'error' | ''
  const [isVerified, setIsVerified] = useState(false);

  // Timer state
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [isInCooldown, setIsInCooldown] = useState(false);

  // Auto-submit when code is complete
  useEffect(() => {
    if (code.length === 6) {
      handleVerifyCode();
    }
  }, [code]);

  // Countdown timer effect
  useEffect(() => {
    let interval;
    if (isInCooldown && cooldownSeconds > 0) {
      interval = setInterval(() => {
        setCooldownSeconds((prev) => {
          if (prev <= 1) {
            setIsInCooldown(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isInCooldown, cooldownSeconds]);

  const handleVerifyCode = async () => {
    if (code.length !== 6 || !user_id) return;

    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ user_id, code }),
        }
      );

      if (response.status === 200) {
        setMessage("Email verified successfully! You can now log in.");
        setMessageType("success");
        setIsVerified(true);
        // Send user to a dedicated success screen
        setTimeout(() => navigate("/verify-success"), 600);
      } else if (response.status === 400) {
        setMessage("Invalid or expired code. Please try again.");
        setMessageType("error");
        setCode("");
      } else if (response.status === 404) {
        setMessage("Verification code not found. Please register again.");
        setMessageType("error");
      } else if (response.status === 429) {
        setMessage("Too many attempts. Please wait before trying again.");
        setMessageType("error");
      } else {
        setMessage("Verification failed. Please try again.");
        setMessageType("error");
        setCode("");
      }
    } catch (error) {
      setMessage("Network error. Please check your connection and try again.");
      setMessageType("error");
      setCode("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    if (!user_id || isInCooldown) return;

    setIsResending(true);
    setMessage("");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/resend-verification`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ user_id }),
        }
      );

      if (response.status === 200) {
        setMessage(
          "✅ Code has been reset! Check your email for the new verification code."
        );
        setMessageType("success");
        // Start 30-second cooldown
        setCooldownSeconds(30);
        setIsInCooldown(true);
      } else if (response.status === 429) {
        const responseText = await response.text();
        if (responseText.includes("Wait before resending")) {
          setMessage(
            "⏰ Please wait 30 seconds before requesting another code."
          );
          setMessageType("error");
          // Start cooldown timer
          setCooldownSeconds(30);
          setIsInCooldown(true);
        } else {
          setMessage("Please wait before requesting another code.");
          setMessageType("error");
        }
      } else {
        setMessage("Failed to resend code. Please try again.");
        setMessageType("error");
      }
    } catch (error) {
      setMessage("Network error. Please try again.");
      setMessageType("error");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Mail className="w-8 h-8 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Check Your Email
            </h1>
            <p className="text-muted-foreground text-sm mt-2">
              We sent a 6-digit code to
            </p>
            <p className="text-foreground font-medium text-sm">{email}</p>
          </div>
        </div>

        {!isVerified ? (
          <>
            {/* OTP Input */}
            <div className="space-y-4">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={(value) => setCode(value)}
                  disabled={isSubmitting}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                Enter the 6-digit code from your email
              </p>
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

            {/* Verify Button */}
            <Button
              onClick={handleVerifyCode}
              className="w-full font-semibold"
              disabled={isSubmitting || code.length !== 6}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify Code"
              )}
            </Button>

            {/* Resend Code */}
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Didn't receive the code?
              </p>
              <Button
                variant="ghost"
                onClick={handleResendCode}
                disabled={isResending || isInCooldown}
                className="text-sm"
              >
                {isResending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : isInCooldown ? (
                  <>
                    <Clock className="w-4 h-4 mr-2" />
                    Wait {cooldownSeconds}s
                  </>
                ) : (
                  "Resend Code"
                )}
              </Button>

              {/* Cooldown Timer Display */}
              {isInCooldown && (
                <div className="text-xs text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <Clock className="w-3 h-3" />
                    <span>Resend available in {cooldownSeconds} seconds</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1 mt-2">
                    <div
                      className="bg-blue-600 h-1 rounded-full transition-all duration-1000 ease-linear"
                      style={{ width: `${(cooldownSeconds / 30) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Success State */
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <CheckCircle className="w-16 h-16 text-green-500" />
            </div>

            <Alert className="border-green-200 bg-green-50 text-green-800">
              <AlertDescription className="text-center">
                {message}
              </AlertDescription>
            </Alert>

            <Button asChild className="w-full font-semibold">
              <Link to="/login">Continue to Login</Link>
            </Button>
          </div>
        )}

        {/* Back Link */}
        <div className="text-center">
          <Link
            to="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 inline-flex items-center gap-1"
          >
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default EmailVerification;
