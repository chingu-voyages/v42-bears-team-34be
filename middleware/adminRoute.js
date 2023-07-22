function adminRoute (req, res, next) {
  if (!req.auth || req.auth.role !== "admin") {
    return res.status(401).json({
      err : "Invalid access level to complete this operation."
    })
  }
  return next();
}

export default adminRoute;