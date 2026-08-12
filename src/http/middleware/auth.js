'use strict';

function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }

  return res.redirect('/login');
}

function createAdminMiddleware({ User }) {
  if (!User || typeof User.findById !== 'function') {
    throw new TypeError('createAdminMiddleware requires a User model with findById()');
  }

  return async function isAdmin(req, res, next) {
    try {
      if (!req.session || !req.session.userId) {
        return res.redirect('/login');
      }

      const user = await User.findById(req.session.userId);
      if (!user || user.user_role !== 'admin') {
        return res.redirect('/dashboard');
      }

      req.user = user;
      return next();
    } catch (error) {
      console.error('Admin middleware error:', error);
      return res.redirect('/dashboard');
    }
  };
}

module.exports = {
  isAuthenticated,
  createAdminMiddleware
};
