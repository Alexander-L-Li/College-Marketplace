import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import EmailVerification from "./pages/EmailVerification";
import VerificationSuccess from "./pages/VerificationSuccess";
import Profile from "./pages/Profile";
import PublicProfile from "./pages/PublicProfile";
import CreateListing from "./pages/CreateListing";
import ListingDetails from "./pages/ListingDetails";
import Inbox from "./pages/Inbox";
import Conversation from "./pages/Conversation";
import MyListings from "./pages/MyListings";

import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Register />} />
        {/* Backwards-compatible route */}
        <Route path="/register" element={<Navigate to="/signup" replace />} />
        <Route path="/verify" element={<EmailVerification />} />
        <Route path="/verify-success" element={<VerificationSuccess />} />
        <Route path="/home" element={<Home />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/:id" element={<PublicProfile />} />
        <Route path="/create-listing" element={<CreateListing />} />
        <Route path="/listing/:id" element={<ListingDetails />} />
        <Route path="/my-listings" element={<MyListings />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/inbox/:id" element={<Conversation />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
