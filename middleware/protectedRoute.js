export function protectedRoute (req, res, next) {
	if(!req.auth){
    return res.status(401).json({
      err : "Login first."
    })
  }
	return next();
}
