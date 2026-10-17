// Marks a route as intentionally open to every signed-in role: it only ever acts on the
// caller's own account (req.user.id). Does no checking itself; the system report's RBAC
// matrix reads the flag so these routes aren't reported as missing a role check.
const selfService = (req, res, next) => next();

selfService.isSelfService = true;

export default selfService;
