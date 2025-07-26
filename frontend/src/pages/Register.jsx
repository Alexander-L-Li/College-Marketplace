import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Register = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters long.");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          username,
          email,
          password,
        }),
      });

      let data;
      const contentType = res.headers.get("content-type");

      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        data = { error: text };
      }

      if (res.ok) {
        const user_id = data.id || data.user_id;
        navigate(`/verify?user_id=${user_id}`);
      } else {
        setMessage(data.error || data || "Registration failed.");
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
            placeholder="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-black placeholder-gray-500 focus:ring-2 focus:ring-black transition-all"
          />
          <input
            type="text"
            placeholder="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-black placeholder-gray-500 focus:ring-2 focus:ring-black transition-all"
          />
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-black placeholder-gray-500 focus:ring-2 focus:ring-black transition-all"
          />
          <input
            type="email"
            placeholder="Email (.edu required)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-black placeholder-gray-500 focus:ring-2 focus:ring-black transition-all"
          />
          <input
            type="password"
            placeholder="Enter Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-black placeholder-gray-500 focus:ring-2 focus:ring-black transition-all"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-black text-white px-4 py-3 rounded-lg font-medium hover:bg-gray-800 transition-all disabled:opacity-50"
          >
            {isLoading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        {message && (
          <Alert variant="destructive" className="text-center">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        <div className="text-center">
          <a
            href="/"
            className="text-sm text-gray-600 hover:text-black underline underline-offset-2"
          >
            Already have an account? Log in
          </a>
        </div>
      </div>
    </div>
  );
};

export default Register;
