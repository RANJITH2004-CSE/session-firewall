const User = require('../models/User');
const Transaction = require('../models/Transaction');
const SecurityAlert = require('../models/SecurityAlert');
const Notification = require('../models/Notification');
const { evaluateSessionRisk } = require('../services/riskEngine');
const { parseClientTelemetry } = require('./authController');

async function getDashboard(req, res) {
  try {
    const user = await User.findById(req.user._id).select('-password');
    const transactions = await Transaction.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10);

    // Look for any unresolved critical alert for this user
    const pendingAlert = await SecurityAlert.findOne({
      userId: req.user._id,
      customerStatus: 'PENDING'
    }).sort({ createdAt: -1 });

    const unreadNotifications = await Notification.find({
      userId: req.user._id,
      isRead: false
    }).sort({ createdAt: -1 }).limit(10);

    return res.status(200).json({
      success: true,
      account: {
        accountNumber: user.accountNumber,
        balance: user.balance,
        currency: user.currency,
        name: user.name,
        email: user.email,
        transfersLocked: user.transfersLocked,
        transferLockReason: user.transferLockReason,
        transferLockedAt: user.transferLockedAt
      },
      transactions,
      pendingAlert,
      unreadNotifications
    });
  } catch (err) {
    console.error('[BankController.getDashboard] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve banking dashboard data.' });
  }
}

async function transferMoney(req, res) {
  try {
    const { recipientName, recipientAccount, amount, category, description } = req.body;
    const user = await User.findById(req.user._id);

    // 1. Check if transfers are locked
    if (user.transfersLocked) {
      return res.status(403).json({
        success: false,
        code: 'TRANSFERS_LOCKED',
        message: user.transferLockReason || 'Wire and ACH transfers are currently disabled on your account for security protection.'
      });
    }

    const transferAmount = Number(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Please provide a valid transfer amount.' });
    }

    if (transferAmount > user.balance) {
      return res.status(400).json({ success: false, message: 'Insufficient funds for this transfer.' });
    }

    // 2. Evaluate transfer risk (Rule 8: Large or unusual transfer: +25 pts; Rule 7: Mid-session drift: +25 pts)
    const telemetry = parseClientTelemetry(req);
    const riskEval = evaluateSessionRisk({
      user,
      currentTelemetry: telemetry,
      context: {
        isMidSessionCheck: true,
        activeSession: req.sessionDoc,
        transferAmount
      }
    });

    // If mid-session risk combined with large transfer is excessive
    if (riskEval.score >= 60) {
      user.transfersLocked = true;
      user.transferLockReason = `High-risk transaction attempt ($${transferAmount}) flagged with suspicious session behavior.`;
      await user.save();

      await Transaction.create({
        userId: user._id,
        recipientName: recipientName || 'External Recipient',
        recipientAccount: recipientAccount || 'ACC-XXXX',
        amount: transferAmount,
        type: 'debit',
        category: category || 'Wire Transfer',
        description,
        status: 'blocked',
        riskScore: riskEval.score,
        blockReason: 'Blocked by Session Firewall risk policy.'
      });

      return res.status(403).json({
        success: false,
        code: 'TRANSFER_FLAGGED_RISK',
        message: 'Transfer blocked by Session Firewall due to high cumulative session and transaction risk.',
        riskScore: riskEval.score,
        reasons: riskEval.reasons
      });
    }

    // 3. Process valid transfer
    user.balance -= transferAmount;
    await user.save();

    const transaction = await Transaction.create({
      userId: user._id,
      recipientName: recipientName || 'Demo Recipient',
      recipientAccount: recipientAccount || 'ACC-8921',
      amount: transferAmount,
      type: 'debit',
      category: category || 'Transfer',
      description: description || `Transfer to ${recipientName}`,
      status: 'completed',
      riskScore: riskEval.score
    });

    return res.status(200).json({
      success: true,
      message: `Successfully transferred $${transferAmount.toFixed(2)} to ${recipientName}.`,
      transaction,
      newBalance: user.balance
    });

  } catch (err) {
    console.error('[BankController.transferMoney] Error:', err);
    return res.status(500).json({ success: false, message: 'Transfer failed to process.' });
  }
}

async function getNotifications(req, res) {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    return res.status(200).json({ success: true, notifications });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
  }
}

async function markNotificationsRead(req, res) {
  try {
    await Notification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true });
    return res.status(200).json({ success: true, message: 'Notifications marked as read.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update notifications.' });
  }
}

module.exports = {
  getDashboard,
  transferMoney,
  getNotifications,
  markNotificationsRead
};
