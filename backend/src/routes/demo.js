const express = require('express');
const router = express.Router();
const demoController = require('../controllers/demoController');

router.post('/reset', demoController.resetDemoData);
router.post('/scenario-safe', demoController.runScenarioSafeLogin);
router.post('/scenario-suspicious', demoController.runScenarioSuspiciousLogin);

module.exports = router;
