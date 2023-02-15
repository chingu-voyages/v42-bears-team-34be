export function protectedRoute (req, res, next) {
  if (!req.auth || req.auth.expired) {
    return res.status(401).json({
      err : "Login first."
    })
  }
  return next();
}
