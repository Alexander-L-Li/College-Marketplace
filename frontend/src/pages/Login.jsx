import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:3001/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email_entry: email,
          password_entry: password,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("session", data.token);
        setMessage("Login successful!");
        window.location.href = "/home";
      } else {
        setMessage(data?.message || "Login failed");
      }
    } catch (err) {
      setMessage("Network error");
      console.error(err);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-black">Login</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email (.edu)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border border-black rounded"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border border-black rounded"
            required
          />
          <button
            type="submit"
            className="w-full p-2 bg-black text-white rounded hover:bg-gray-800"
          >
            Sign In
          </button>
        </form>
        {message && <p className="text-sm text-red-500">{message}</p>}
      </div>
    </div>
  );
}

export default Login;
