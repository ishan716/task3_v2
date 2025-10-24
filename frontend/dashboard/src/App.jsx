import { Routes, Route } from "react-router-dom";
import EventsScreen from "../pages/EventsScreen.jsx";
import SingleEventDetailPage from "../pages/SingleEventDetailPage.jsx";
import FeedbackPage from "../pages/FeedbackPage.jsx";
import RecommendedEvents from "../pages/RecommendedEvents.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import AdminAnalytics from "./pages/AdminAnalytics.jsx";

export default function App() {
  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 transition-colors duration-500">
      <Routes>
        <Route path="/" element={<EventsScreen />} />
        <Route path="/events/:id" element={<SingleEventDetailPage />} />
        <Route path="/events/:eventId/feedback" element={<FeedbackPage />} />
        <Route path="/recommended" element={<RecommendedEvents />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/analytics" element={<AdminAnalytics />} />
      </Routes>
    </div>
  );
}
