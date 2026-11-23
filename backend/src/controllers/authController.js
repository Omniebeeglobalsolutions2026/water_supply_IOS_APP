const authService = require('../services/authService');

async function register(req, res, next) {
  try {
    const result = await authService.register(req.body || {});
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body || {});
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

function currentUser(req, res) {
  return res.json({ user: authService.toPublicUser(req.user) });
}

async function updateProfile(req, res, next) {
  try {
    const userId = req.user.id || req.user._id;
    const result = await authService.updateProfile(userId, req.body || {});
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = { register, login, currentUser, updateProfile };