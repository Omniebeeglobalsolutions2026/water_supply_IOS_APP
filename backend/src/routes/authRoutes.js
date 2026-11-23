const express = require('express');
const { register, login, currentUser, updateProfile } = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, currentUser);
router.put('/profile', authenticate, updateProfile);

module.exports = router;