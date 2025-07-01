import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);

  useEffect(() => {
    const session = localStorage.getItem("session");
    if (!session) {
      navigate("/");
    }

    async function fetchListings() {
      try {
        const res = await fetch("http://localhost:3001/listings");
        const data = await res.json();
        setListings(data);
        // console.log(data); delete this later
      } catch (err) {
        console.error(err);
      }
    }

    fetchListings();
  }, [navigate]);

  async function handleLogout(e) {
    e.preventDefault();
    localStorage.removeItem("session");
    navigate("/");
  }

  return (
    // <div className="p-4 text-black">
    //   <h1 className="text-xl font-bold">Welcome to Dorm Drop!</h1>
    //   <p>This page is protected and only visible if you're logged in.</p>
    //   <form onSubmit={handleLogout} className="space-y-4">
    //     <button
    //       type="submit"
    //       className="w-full p-2 bg-black text-white rounded hover:bg-gray-800"
    //     >
    //       Logout
    //     </button>
    //   </form>
    // </div>
    <div>
      {listings.map((item, index) => (
        <div key={index}>{/* Your Tailwind card design here */}</div>
      ))}
    </div>
  );
}

export default Home;
