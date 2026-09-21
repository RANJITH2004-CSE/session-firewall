const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/logs', auditController.getAuditLogs);
router.get('/thresholds', auditController.getThresholdConfig);
router.post('/thresholds', auditController.updateThresholdConfig);

module.exports = router;
