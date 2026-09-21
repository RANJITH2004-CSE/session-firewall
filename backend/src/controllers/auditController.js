const AuditLog = require('../models/AuditLog');
const { getRiskThresholds, setRiskThresholds } = require('../services/riskEngine');

/**
 * AuditLog Controller (Class Diagram Fig 10.2 & Functional Requirements FR9, FR10)
 */

async function getAuditLogs(req, res) {
  try {
    const { action, targetApplication, limit = 50, sessionId } = req.query;
    const query = {};

    if (action && action !== 'ALL') {
      query.action = action;
    }
    if (targetApplication && targetApplication !== 'ALL') {
      query.targetApplication = targetApplication;
    }
    if (sessionId) {
      query.sessionId = sessionId;
    }

    const logs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(Number(limit));

    const totalCount = await AuditLog.countDocuments(query);

    return res.status(200).json({
      success: true,
      count: logs.length,
      totalCount,
      logs
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve audit logs.' });
  }
}

async function getThresholdConfig(req, res) {
  try {
    const thresholds = getRiskThresholds();
    return res.status(200).json({
      success: true,
      thresholds,
      samplingFrequencySeconds: 10,
      weights: {
        fingerprintWeight: 0.50,
        behavioralWeight: 0.50
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch thresholds.' });
  }
}

async function updateThresholdConfig(req, res) {
  try {
    const { thresholds } = req.body;
    if (!thresholds) {
      return res.status(400).json({ success: false, message: 'Missing thresholds payload.' });
    }

    const updated = setRiskThresholds(thresholds);
    return res.status(200).json({
      success: true,
      message: 'Continuous Firewall risk thresholds updated successfully.',
      thresholds: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update thresholds.' });
  }
}

module.exports = {
  getAuditLogs,
  getThresholdConfig,
  updateThresholdConfig
};
