const express = require('express');
const router = express.Router();
const bankController = require('../controllers/bankController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.get('/dashboard', bankController.getDashboard);
router.post('/transfer', bankController.transferMoney);
router.get('/notifications', bankController.getNotifications);
router.post('/notifications/read', bankController.markNotificationsRead);

module.exports = router;
