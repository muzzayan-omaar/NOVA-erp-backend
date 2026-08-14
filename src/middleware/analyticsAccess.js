export default function analyticsAccess(req, res, next) {
  const user = req.user;

  if (!user) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  // Only GENERAL_MANAGER can access dashboard analytics

  if (user.role !== "GENERAL_MANAGER") {
    return res.status(403).json({
      message: "Dashboard analytics restricted to General Manager",
    });
  }

  next();
}
