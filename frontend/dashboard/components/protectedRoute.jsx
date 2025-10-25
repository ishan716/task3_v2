import { Navigate, Outlet } from "react-router-dom";
import jwtDecode from "jwt-decode";

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
    const userRole = getUserRole();

    if (!token) {
        // Not logged in → go to login
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(userRole)) {
        // Logged in but wrong role → go to login again
        return <Navigate to="/login" replace />;
    }

    // Authorized
    return <Outlet />;
}
