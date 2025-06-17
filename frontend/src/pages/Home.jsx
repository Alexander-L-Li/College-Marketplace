import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    const session = localStorage.getItem("session");
    if (!session) {
      navigate("/login");
    }
  }, [navigate]);

  return (
    <div className="p-4 text-black">
      <h1 className="text-xl font-bold">Welcome to Dorm Drop!</h1>
      <p>This page is protected and only visible if you're logged in.</p>
    </div>
  );
}

export default Home;
