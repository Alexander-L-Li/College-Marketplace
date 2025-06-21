import { useState } from "react";
import { useNavigate } from "react-router-dom";

const Landing = () => {
  const [mode, setMode] = useState("register");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    const navigate = useNavigate();
    const endpoint = mode === "register" ? "/register" : "/login";
    const payload =
      mode === "register"
        ? { first_name: firstName, last_name: lastName, email, password }
        : { email_entry: email, password_entry: password };

    try {
      const res = await fetch(`http://localhost:3001${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.text();
      if (res.ok) {
        if (mode === "login") {
          const json = JSON.parse(data);
          localStorage.setItem("session", json.token);
          navigate("/home");
        } else {
          setMessage("Registration successful! Please log in.");
          setMode("login");

          // Clear form fields after successful registration
          setFirstName("");
          setLastName("");
          setEmail("");
          setPassword("");
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
    // Optionally clear fields when switching modes
    if (mode === "login") {
      setFirstName("");
      setLastName("");
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-2 py-8">
      <div className="w-full max-w-sm space-y-8">
        {/* Header Section */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold text-black tracking-tight">
            Dorm Drop
          </h1>
          <p className="text-gray-600 text-base leading-relaxed px-2">
            MIT's exclusive campus marketplace. Buy, sell, and trade with your
            peers.
          </p>
        </div>

        {/* Form Section */}
        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Registration Fields */}
            <div
              className={`space-y-4 transition-all duration-300 ${
                mode === "register"
                  ? "opacity-100 max-h-32"
                  : "opacity-0 max-h-0 overflow-hidden"
              }`}
            >
              <input
                type="text"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
                required={mode === "register"}
              />
              <input
                type="text"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
                required={mode === "register"}
              />
            </div>

            {/* Common Fields */}
            <div className="space-y-4">
              <input
                type="email"
                placeholder="Email (.edu required)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
                required
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading
                ? mode === "register"
                  ? "Creating Account..."
                  : "Logging In..."
                : mode === "register"
                ? "Create Account"
                : "Log In"}
            </button>
          </form>

          {/* Message Display */}
          {message && (
            <div
              className={`text-center text-sm font-medium px-3 py-2 rounded-lg transition-all duration-300 ${
                message.includes("successful")
                  ? "text-green-700 bg-green-50 border border-green-200"
                  : "text-red-700 bg-red-50 border border-red-200"
              }`}
            >
              {message}
            </div>
          )}

          {/* Mode Toggle */}
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
