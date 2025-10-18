import supabase from "../db.js";

const adminAuthMiddleware = async (req, res, next) => {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
        return res.status(401).json({ error: "No token provided" });
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = data.user; // Attach user to request
    next();
};

export default adminAuthMiddleware;
