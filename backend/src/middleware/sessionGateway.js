const { evaluateFingerprintIntegrity } = require('../services/fingerprintService');
const { evaluateBehavioralIntent } = require('../services/behavioralIntentService');
const { fuseContinuousRisk } = require('../services/riskEngine');
const { executeAdaptiveResponse } = require('../services/adaptiveResponseService');
const { parseClientTelemetry } = require('../controllers/authController');

/**
 * Session Gateway Middleware (System Architecture Fig 9.1)
 * Intercepts requests to protected applications and executes continuous validation.
 */
function createSessionGateway({ targetApplication = 'General Gateway', isSensitive = false, sensitiveOperationName = null }) {
  return async (req, res, next) => {
    try {
      const session = req.sessionDoc;
      const user = req.user;

      if (!session || !user) {
        return res.status(401).json({ success: false, message: 'Authentication required by Session Gateway.' });
      }

      // Check if session was already revoked
      if (!session.isActive) {
        return res.status(403).json({
          success: false,
          code: 'SESSION_REVOKED',
          message: 'Access denied: Session has been terminated by the Continuous Authentication Firewall.'
        });
      }

      // 1. Extract Live Client Telemetry & Dynamic Fingerprint Samples
      const liveTelemetry = parseClientTelemetry(req);
      
      // Check for client-side continuous fingerprint sample header if sent by browser
      if (req.headers['x-session-canvas']) liveTelemetry.canvasHash = req.headers['x-session-canvas'];
      if (req.headers['x-session-screen']) liveTelemetry.screenResolution = req.headers['x-session-screen'];

      // 2. Dynamic Session Fingerprint Sampling (Module 1)
      const fpResult = await evaluateFingerprintIntegrity(session.sessionId, liveTelemetry);

      // 3. Behavioral Intent Analysis (Module 2)
      const intentResult = await evaluateBehavioralIntent({
        sessionId: session.sessionId,
        userId: user._id,
        endpoint: req.originalUrl,
        method: req.method,
        isSensitiveOperation: isSensitive
      });

      // 4. Risk Fusion Engine (Module 3)
      const riskEvaluation = fuseContinuousRisk({
        fingerprintIntegrityScore: fpResult.integrityScore,
        behavioralConsistencyScore: intentResult.consistencyScore,
        mismatchFactors: fpResult.mismatchFactors,
        intentDeviations: intentResult.deviationReasons
      });

      // 5. Adaptive Response Module Execution (Module 4)
      const adaptiveResult = await executeAdaptiveResponse({
        session,
        user,
        riskEvaluation,
        targetApplication,
        requestEndpoint: req.originalUrl,
        requestMethod: req.method,
        clientTelemetry: liveTelemetry
      });

      // Response Decision 1: FORCED TERMINATION (High Risk >= 75)
      if (adaptiveResult.terminated) {
        return res.status(403).json({
          success: false,
          code: 'CONTINUOUS_FIREWALL_TERMINATED',
          message: 'Continuous Firewall Alert: Session has been forcibly terminated due to combined fingerprint and behavioral anomalies.',
          riskScore: riskEvaluation.riskScore,
          action: 'TERMINATE',
          reasons: riskEvaluation.reasons
        });
      }

      // Response Decision 2: RESTRICT SENSITIVE OPERATIONS (Elevated Risk 60-74)
      if (adaptiveResult.restricted && isSensitive) {
        return res.status(403).json({
          success: false,
          code: 'OPERATION_RESTRICTED_ELEVATED_RISK',
          message: `Operation Blocked: Access to sensitive operation "${sensitiveOperationName || req.originalUrl}" is restricted while session risk is elevated.`,
          riskScore: riskEvaluation.riskScore,
          action: 'RESTRICT_ACCESS',
          reasons: riskEvaluation.reasons,
          restrictedOperations: adaptiveResult.restrictedOperations
        });
      }

      // Response Decision 3: STEP-UP RE-AUTHENTICATION (Medium Risk 30-59)
      // Attach header for client awareness
      res.setHeader('X-Firewall-Risk-Score', riskEvaluation.riskScore);
      res.setHeader('X-Firewall-Action', adaptiveResult.action);
      res.setHeader('X-Firewall-Integrity', fpResult.integrityScore);
      res.setHeader('X-Firewall-Consistency', intentResult.consistencyScore);

      // Attach context for downstream controllers
      req.firewallContext = {
        riskScore: riskEvaluation.riskScore,
        fingerprintIntegrityScore: fpResult.integrityScore,
        behavioralConsistencyScore: intentResult.consistencyScore,
        action: adaptiveResult.action,
        reasons: riskEvaluation.reasons
      };

      next();
    } catch (err) {
      console.error('[SessionGateway] Error:', err);
      next(); // Fail open gracefully per NFR3 Reliability
    }
  };
}

module.exports = {
  createSessionGateway
};
