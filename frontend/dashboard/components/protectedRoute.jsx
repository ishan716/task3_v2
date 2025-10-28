import { Navigate, Outlet } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

function getDecodedToken() {
    const token = localStorage.getItem("accessToken");
    if (!token) return null;

    try {
        return jwtDecode(token);
    } catch (error) {
        console.error("Invalid token:", error);
        return null;
    }
}

export default function ProtectedRoute({ allowedRoles }) {
    const token = localStorage.getItem("accessToken");

    if (!token) {
        console.warn("No token found. Redirecting to login...");
        return <Navigate to="/login" replace />;
    }

    const decoded = getDecodedToken();
    if (!decoded) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("user_id");
        console.warn("Token decode failed. Redirecting to login...");
        return <Navigate to="/login" replace />;
    }

    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("user_id");
        console.warn("Token expired. Redirecting to login...");
        return <Navigate to="/login" replace />;
    }

    const userRole = decoded.role || null;

    if (allowedRoles && !allowedRoles.includes(userRole)) {
        console.warn("User role not allowed:", userRole);
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}

