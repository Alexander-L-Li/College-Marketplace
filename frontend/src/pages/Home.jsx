import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    const session = localStorage.getItem("session");
    if (!session) {
      navigate("/");
    }
  }, [navigate]);

  async function handleLogout(e) {
    e.preventDefault();
    localStorage.removeItem("session");
    navigate("/");
  }

  return (
    <div className="p-4 text-black">
      <h1 className="text-xl font-bold">Welcome to Dorm Drop!</h1>
      <p>This page is protected and only visible if you're logged in.</p>
      <form onSubmit={handleLogout} className="space-y-4">
        <button
          type="submit"
          className="w-full p-2 bg-black text-white rounded hover:bg-gray-800"
        >
          Logout
        </button>
      </form>
    </div>
  );
}

export default Home;
