export function adminRoute (req, res, next) {
    if (!req.auth || "admin" != req.auth.role) {
      return res.status(404).json({
        err : "Not found."
      })
    }
    return next();
  }
