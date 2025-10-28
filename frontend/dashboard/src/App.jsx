import { Routes, Route } from "react-router-dom";
import EventsScreen from "../pages/EventsScreen.jsx";
import SingleEventDetailPage from "../pages/SingleEventDetailPage.jsx";
import FeedbackPage from "../pages/FeedbackPage.jsx";
import RecommendedEvents from "../pages/RecommendedEvents.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import AdminAnalytics from "./pages/AdminAnalytics.jsx";
import LoginPage from "../pages/login.jsx";
import ProtectedRoute from "../components/protectedRoute.jsx";
import AdminLoginPage from "../pages/adminlogin.jsx";

export default function App() {
  return (
      <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 transition-colors duration-500">
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />

          {/* ✅ Protected user routes */}
          <Route element={<ProtectedRoute allowedRoles={['user']} />}>
            <Route path="/" element={<EventsScreen />} />
            <Route path="/events/:id" element={<SingleEventDetailPage />} />
            <Route path="/events/:eventId/feedback" element={<FeedbackPage />} />
            <Route path="/recommended" element={<RecommendedEvents />} />
          </Route>

          {/* Admin routes (not wrapped here yet) */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />} >
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
        </Route>
        </Routes>
      </div>
  );
}
