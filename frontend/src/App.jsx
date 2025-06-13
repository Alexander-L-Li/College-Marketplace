import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Header />

        <main className="flex-grow p-4">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/profile/:userId" element={<Profile />} />
            <Route path="/item/:itemId" element={<ItemDetails />} />
            <Route path="/sell" element={<SellForm />} />
          </Routes>
        </main>
      </div>
    </Router>
    // <div className="min-h-screen bg-gray-100">
    //   {/* Scroll Bar */}
    //   <header className="hidden">
    //     <input
    //       type="text"
    //       placeholder="Search..."
    //       className="sm:hidden w-full max-w-fit bg-white border border-gray-900 rounded-md shadow-sm"
    //     />
    //   </header>
    //   <main className="p-8">{/* Your content here */}</main>
    // </div>
  );
}

export default App;
