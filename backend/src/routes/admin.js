const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/sessions', adminController.getSuspiciousSessions);
router.get('/alerts', adminController.getSecurityAlerts);
router.get('/metrics', adminController.getAdminMetrics);
router.get('/blocklist', adminController.getBlocklist);
router.post('/blocklist/toggle', adminController.toggleBlocklist);
router.patch('/sessions/:sessionId/status', adminController.updateSessionStatus);
router.patch('/users/:userId/transfers', adminController.toggleUserTransfers);

module.exports = router;
