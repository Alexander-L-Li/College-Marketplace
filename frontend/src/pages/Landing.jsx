import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

const Landing = () => {
  const [mode, setMode] = useState("register");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    if (mode === "register") {
      if (password.length < 8) {
        setMessage("Password must be at least 8 characters long.");
        setIsLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setMessage("Passwords do not match.");
        setIsLoading(false);
        return;
      }
    }

    const endpoint = mode === "register" ? "/register" : "/login";
    const payload =
      mode === "register"
        ? { first_name: firstName, last_name: lastName, email, password }
        : { email_entry: email, password_entry: password };

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}${endpoint}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.text();
      if (res.ok) {
        if (mode === "login") {
          const json = JSON.parse(data);
          localStorage.setItem("session", json.token);
          navigate("/home");
        } else {
          setMessage(
            "Registration successful! Check your email to verify your account."
          );
          setMode("login");
          setFirstName("");
          setLastName("");
          setEmail("");
          setPassword("");
          setConfirmPassword("");
        }
      } else {
        setMessage(data || "Something went wrong");
      }
    } catch (err) {
      console.error(err);
      setMessage("Network error - please try again");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === "register" ? "login" : "register");
    setMessage("");
    setFirstName("");
    setLastName("");
    setPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-2 py-8">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold text-black tracking-tight">
            Dorm Drop
          </h1>
          <p className="text-gray-600 text-base leading-relaxed px-2">
            MIT's exclusive campus marketplace. Buy, sell, and trade with your
            peers.
          </p>
        </div>

        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div
              className={`space-y-4 transition-all duration-300 ${
                mode === "register"
                  ? "opacity-100 max-h-32"
                  : "opacity-0 max-h-0 overflow-hidden"
              }`}
            >
              <Input
                type="text"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required={mode === "register"}
              />
              <Input
                type="text"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required={mode === "register"}
              />
            </div>

            <Input
              type="email"
              placeholder="Email (.edu required)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            {mode === "register" && password.length > 0 && (
              <Input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            )}

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {mode === "register"
                    ? "Creating Account..."
                    : "Logging In..."}
                </>
              ) : mode === "register" ? (
                "Create Account"
              ) : (
                "Log In"
              )}
            </Button>
          </form>

          {message && (
            <Alert
              variant={
                message.includes("successful") ? "default" : "destructive"
              }
              className={`animate-in slide-in-from-top-2 duration-300 ${
                message.includes("successful")
                  ? "border-green-200 bg-green-50 text-green-800"
                  : ""
              }`}
            >
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <div className="text-center">
            <button
              type="button"
              onClick={toggleMode}
              className="text-gray-600 text-sm hover:text-black transition-colors duration-200 underline underline-offset-2"
            >
              {mode === "register"
                ? "Already have an account? Log in"
                : "New here? Create an account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;
