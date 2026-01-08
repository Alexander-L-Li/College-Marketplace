import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Login = () => {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email_entry: emailOrUsername,
          password_entry: password,
        }),
      });

      const data = await res.text();
      if (res.ok) {
        const json = JSON.parse(data);
        console.log(
          "Login successful, token received:",
          json.token ? "Token exists" : "No token"
        );
        localStorage.setItem("token", json.token);
        console.log(
          "Token stored in localStorage:",
          localStorage.getItem("token") ? "Token stored" : "No token stored"
        );
        navigate("/home");
      } else {
        setMessage(data || "Login failed.");
      }
    } catch (err) {
      console.error(err);
      setMessage("Network error - please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-2 py-8">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold text-black tracking-tight">
            Dorm Space
          </h1>
          <p className="text-gray-600 text-base">
            MIT's exclusive campus marketplace.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Username or Email (.edu)"
            value={emailOrUsername}
            onChange={(e) => setEmailOrUsername(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black transition-all"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black transition-all"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-black text-white px-4 py-3 rounded-lg font-medium hover:bg-gray-800 transition-all disabled:opacity-50"
          >
            {isLoading ? "Logging In..." : "Log In"}
          </button>
        </form>

        {message && (
          <Alert variant="destructive" className="text-center">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        <div className="text-center">
          <Link
            to="/signup"
            className="text-sm text-gray-600 hover:text-black underline underline-offset-2"
          >
            New here? Create an account
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
