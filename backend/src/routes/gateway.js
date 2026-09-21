const express = require('express');
const router = express.Router();
const gatewayController = require('../controllers/gatewayController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { createSessionGateway } = require('../middleware/sessionGateway');

router.use(authenticateToken);

// Continuous Client Heartbeat Telemetry
router.post('/telemetry/heartbeat', gatewayController.reportHeartbeatTelemetry);

// 1. Enterprise HR & Administration Portal
router.get(
  '/enterprise/overview',
  createSessionGateway({ targetApplication: 'Enterprise Portal', isSensitive: false }),
  gatewayController.getEnterpriseOverview
);

router.post(
  '/enterprise/bulk-export',
  createSessionGateway({ targetApplication: 'Enterprise Portal', isSensitive: true, sensitiveOperationName: 'Bulk Payroll & PII Export' }),
  gatewayController.bulkExportEnterpriseData
);

router.post(
  '/enterprise/role-escalation',
  createSessionGateway({ targetApplication: 'Enterprise Portal', isSensitive: true, sensitiveOperationName: 'Privilege & Role Escalation' }),
  gatewayController.escalateUserRole
);

// 2. Cloud SaaS Workspace
router.get(
  '/saas/projects',
  createSessionGateway({ targetApplication: 'Cloud SaaS Workspace', isSensitive: false }),
  gatewayController.getSaasProjects
);

router.post(
  '/saas/export-database',
  createSessionGateway({ targetApplication: 'Cloud SaaS Workspace', isSensitive: true, sensitiveOperationName: 'Full Tenant Database Dump' }),
  gatewayController.exportSaasDatabase
);

router.post(
  '/saas/delete-workspace',
  createSessionGateway({ targetApplication: 'Cloud SaaS Workspace', isSensitive: true, sensitiveOperationName: 'Destructive Workspace Deletion' }),
  gatewayController.deleteSaasWorkspace
);

module.exports = router;
