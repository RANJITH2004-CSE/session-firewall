const Session = require('../models/Session');
const SecurityAlert = require('../models/SecurityAlert');
const Blocklist = require('../models/Blocklist');
const User = require('../models/User');

/**
 * Get all suspicious sessions with customer name, details, risk score, reasons, and status
 */
async function getSuspiciousSessions(req, res) {
  try {
    const { status, riskLevel, search } = req.query;

    const query = {};

    // Filter by status
    if (status && status !== 'ALL') {
      query.status = status;
    }

    // Filter by risk level
    if (riskLevel && riskLevel !== 'ALL') {
      query.riskLevel = riskLevel.toLowerCase();
    }

    const sessions = await Session.find(query)
      .populate('userId', 'name email accountNumber transfersLocked')
      .sort({ createdAt: -1 })
      .limit(100);

    // Format for dashboard
    const formatted = sessions.map(s => {
      const user = s.userId || {};
      return {
        _id: s._id,
        sessionId: s.sessionId,
        customerId: user._id,
        customerName: user.name || 'Unknown User',
        customerEmail: user.email || 'N/A',
        accountNumber: user.accountNumber || 'N/A',
        transfersLocked: user.transfersLocked,
        time: s.createdAt,
        device: s.device,
        browser: s.browser,
        os: s.os,
        ipAddress: s.ipAddress,
        location: s.location ? `${s.location.city}, ${s.location.country}` : 'Unknown',
        locationDetails: s.location,
        isVpn: s.isVpn,
        riskScore: s.riskScore,
        riskReasons: s.riskReasons,
        riskLevel: s.riskLevel,
        status: s.status,
        isActive: s.isActive,
        isDenialReported: s.isDenialReported,
        revokedReason: s.revokedReason
      };
    });

    // Optional text search filter
    let results = formatted;
    if (search) {
      const q = search.toLowerCase();
      results = results.filter(item => 
        item.customerName.toLowerCase().includes(q) ||
        item.customerEmail.toLowerCase().includes(q) ||
        item.ipAddress.toLowerCase().includes(q) ||
        item.device.toLowerCase().includes(q) ||
        item.sessionId.toLowerCase().includes(q)
      );
    }

    return res.status(200).json({
      success: true,
      count: results.length,
      sessions: results
    });
  } catch (err) {
    console.error('[AdminController.getSuspiciousSessions] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve suspicious sessions.' });
  }
}

/**
 * Get aggregated metrics and charts data for admin overview
 */
async function getAdminMetrics(req, res) {
  try {
    const totalSessions = await Session.countDocuments();
    const blockedSessions = await Session.countDocuments({ status: 'Blocked' });
    const confirmedFraud = await Session.countDocuments({ status: 'Confirmed Fraud' });
    const mfaRequired = await Session.countDocuments({ status: 'MFA Required' });
    const activeThreats = await Session.countDocuments({ riskLevel: { $in: ['medium', 'high'] } });

    const activeBlocklistCount = await Blocklist.countDocuments({ isActive: true });
    const lockedUsersCount = await User.countDocuments({ transfersLocked: true });

    // Generate daily chart series (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const recentSessions = await Session.find({
      createdAt: { $gte: sevenDaysAgo }
    }).select('createdAt status riskLevel');

    // Aggregate by day
    const dayMap = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      dayMap[key] = { date: key, label, total: 0, suspicious: 0, blocked: 0 };
    }

    recentSessions.forEach(s => {
      const key = new Date(s.createdAt).toISOString().split('T')[0];
      if (dayMap[key]) {
        dayMap[key].total += 1;
        if (s.riskLevel === 'medium' || s.riskLevel === 'high') {
          dayMap[key].suspicious += 1;
        }
        if (s.status === 'Blocked' || s.status === 'Confirmed Fraud') {
          dayMap[key].blocked += 1;
        }
      }
    });

    const chartData = Object.values(dayMap);

    return res.status(200).json({
      success: true,
      metrics: {
        totalSessions,
        activeThreats,
        blockedSessions,
        confirmedFraud,
        mfaRequired,
        activeBlocklistCount,
        lockedUsersCount
      },
      chartData
    });
  } catch (err) {
    console.error('[AdminController.getAdminMetrics] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve admin metrics.' });
  }
}

/**
 * Get active blocklist items
 */
async function getBlocklist(req, res) {
  try {
    const list = await Blocklist.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, blocklist: list });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch blocklist.' });
  }
}

/**
 * Block or Unblock an IP or Device
 */
async function toggleBlocklist(req, res) {
  try {
    const { type, value, reason, active } = req.body;
    if (!type || !value) {
      return res.status(400).json({ success: false, message: 'Type (IP or DEVICE) and Value are required.' });
    }

    const isExplicitActive = active !== undefined ? Boolean(active) : true;

    const item = await Blocklist.findOneAndUpdate(
      { type, value },
      {
        type,
        value,
        reason: reason || `Manual update by Bank Security Administrator on ${new Date().toLocaleDateString()}`,
        isActive: isExplicitActive,
        blockedBy: req.user.name || 'Security Admin'
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: `${type} "${value}" has been ${isExplicitActive ? 'blocked' : 'unblocked'}.`,
      item
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update blocklist.' });
  }
}

/**
 * Admin action: Update Session Status (e.g. mark Resolved, Allowed, Blocked)
 */
async function updateSessionStatus(req, res) {
  try {
    const { sessionId } = req.params;
    const { status, resolutionNotes } = req.body;

    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session record not found.' });
    }

    session.status = status;
    if (status === 'Blocked' || status === 'Confirmed Fraud') {
      session.isActive = false;
      session.revokedAt = new Date();
      session.revokedReason = resolutionNotes || `Quarantined by Bank Security Administrator.`;
    } else if (status === 'Resolved' || status === 'Allowed') {
      session.isActive = true;
    }
    await session.save();

    await SecurityAlert.findOneAndUpdate(
      { sessionId },
      {
        $set: {
          adminStatus: status,
          resolvedAt: new Date(),
          resolvedBy: req.user.name,
          resolutionNotes: resolutionNotes || `Updated to ${status} by admin.`
        }
      }
    );

    return res.status(200).json({
      success: true,
      message: `Session ${sessionId} status updated to ${status}.`,
      session
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update session status.' });
  }
}

/**
 * Admin action: Unlock or lock a user's transfer capability
 */
async function toggleUserTransfers(req, res) {
  try {
    const { userId } = req.params;
    const { lock, reason } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    user.transfersLocked = Boolean(lock);
    user.transferLockReason = lock ? (reason || 'Transfers restricted by Bank Administrator.') : '';
    if (lock) {
      user.transferLockedAt = new Date();
    }
    await user.save();

    return res.status(200).json({
      success: true,
      message: `User transfers have been ${lock ? 'locked' : 'unlocked'}.`,
      transfersLocked: user.transfersLocked
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to toggle user transfer state.' });
  }
}

module.exports = {
  getSuspiciousSessions,
  getAdminMetrics,
  getBlocklist,
  toggleBlocklist,
  updateSessionStatus,
  toggleUserTransfers
};
