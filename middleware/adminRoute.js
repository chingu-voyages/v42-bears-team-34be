export function adminRoute (req, res, next) {
    if (!req.auth || "admin" != req.auth.role) {
        // this should be a "Cannot METHOD /originalurl"

      return res.status(404).json({
        err : "Not found."
      })
    }
    return next();
  }