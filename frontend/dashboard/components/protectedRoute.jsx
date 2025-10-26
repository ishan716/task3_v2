import { Navigate, Outlet } from "react-router-dom";
import { jwtDecode } from "jwt-decode";


function getUserRole() {
    const token = localStorage.getItem("accessToken");
    if (!token) return null;

    try {
        const decoded = jwtDecode(token);
        return decoded.role || null;
    } catch (error) {
        console.error("Invalid token:", error);
        return null;
    }
}

export default function ProtectedRoute({ allowedRoles }) {
    const token = localStorage.getItem("accessToken");

    // 🚨 Block access if no token
    if (!token) {
        console.warn("No token found. Redirecting to login...");
        return <Navigate to="/login" replace />;
    }

    // ✅ Decode token after confirming it exists
    const userRole = getUserRole();

    // 🚫 Block if role mismatch
    if (allowedRoles && !allowedRoles.includes(userRole)) {
        console.warn("User role not allowed:", userRole);
        return <Navigate to="/login" replace />;
    }

    // ✅ Otherwise, allow access
    return <Outlet />;
}
