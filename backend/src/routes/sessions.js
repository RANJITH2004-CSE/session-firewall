const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.get('/', sessionController.getSessions);
router.post('/mark-not-me', sessionController.markNotMe);
router.post('/confirm-was-me', sessionController.confirmWasMe);
router.delete('/:sessionId', sessionController.terminateSession);

module.exports = router;
