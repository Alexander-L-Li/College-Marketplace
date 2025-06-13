import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Scroll Bar */}
      <header className="hidden">
        <input
          type="text"
          placeholder="Search..."
          className="sm:hidden w-full max-w-fit bg-white border border-gray-900 rounded-md shadow-sm"
        />
      </header>
      <main className="p-8">{/* Your content here */}</main>
    </div>
  );
}

export default App;
