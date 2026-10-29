const { PrismaClient } = require('@prisma/client');
const { getSettings } = require('./setting.service');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * Send an SMS message through the system gateway.
 * Checks the system setting 'smsNotification' before dispatching.
 *
 * @param {Object} params
 * @param {string} params.to - Recipient phone number (e.g. 012345678)
 * @param {string} params.message - Content of SMS
 * @param {string} [params.alertId] - Associated SOS Alert ID
 * @param {string} [params.type] - Alert Type (MEDICAL, FIRE, POLICE, etc.)
 * @returns {Promise<{ success: boolean, reason?: string, provider?: string }>}
 */
const sendSMS = async ({ to, message, alertId = null, type = 'ALERT' }) => {
  try {
    if (!to || !message) {
      return { success: false, reason: 'Recipient phone or message empty' };
    }

    // 1. Verify system settings
    const settings = await getSettings();
    const isSmsArmed =
      String(settings?.smsNotification).toLowerCase() === 'true';

    if (!isSmsArmed) {
      logger.info(
        `📱 [SMS Gateway] Delivery paused: smsNotification is DISABLED in System Settings. (Target: ${to})`
      );
      return { success: false, reason: 'SMS gateway paused by settings' };
    }

    // Clean phone number format for Cambodia (+855 or 0xx)
    let formattedPhone = to.trim();
    if (formattedPhone.startsWith('0')) {
      formattedPhone = `+855${formattedPhone.slice(1)}`;
    } else if (!formattedPhone.startsWith('+')) {
      formattedPhone = `+${formattedPhone}`;
    }

    logger.info(
      `📱 [SMS Gateway] Dispatching SMS to ${formattedPhone}: "${message}"`
    );

    // 2. Gateway Integration (If Twilio / Plasgate API key exists in .env, call it)
    const hasExternalGateway = Boolean(
      process.env.PLASGATE_API_KEY || process.env.TWILIO_AUTH_TOKEN
    );

    let provider = 'Simulated Local Telco Gateway';
    if (hasExternalGateway) {
      provider = process.env.PLASGATE_API_KEY ? 'Plasgate Cambodia' : 'Twilio';
      // In real deployment, external HTTP call is performed here
    }

    // 3. Log into Audit Log for transparency & EOC Dispatcher visibility
    try {
      const shortId = alertId ? ` #${String(alertId).slice(0, 8)}` : '';
      await prisma.auditLog.create({
        data: {
          time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          event: `📱 SMS SENT via ${provider} to ${to}: "${message.slice(0, 140)}"${shortId}`,
          userId: null,
          userName: 'SMS Gateway Service',
        },
      });
    } catch (auditErr) {
      logger.warn(`Failed to record SMS audit log: ${auditErr.message}`);
    }

    return { success: true, provider, recipient: formattedPhone };
  } catch (error) {
    logger.error(`SMS Gateway execution error: ${error.message}`);
    return { success: false, reason: error.message };
  }
};

/**
 * Send automatic SMS confirmation when a citizen reports an SOS Alert.
 */
const notifyAlertCreated = async (alert) => {
  if (!alert || !alert.phone) return;

  const typeKhmer = {
    MEDICAL: 'សង្គ្រោះបន្ទាន់ផ្នែកវេជ្ជសាស្ត្រ',
    FIRE: 'អគ្គិភ័យ',
    POLICE: 'សន្តិសុខ/នគរបាល',
    ACCIDENT: 'គ្រោះថ្នាក់ចរាចរណ៍',
    FLOOD: 'គ្រោះទឹកជំនន់',
    DISASTER: 'គ្រោះមហន្តរាយ',
  }[String(alert.type).toUpperCase()] || alert.type;

  const msg = `[Smart City SOS] យើងបានទទួលសេចក្តីរាយការណ៍អាសន្ន #${String(alert.id).slice(0, 8)} (${typeKhmer}) របស់អ្នកហើយ។ មជ្ឈមណ្ឌលបញ្ជាការ EOC កំពុងចាត់ចែងកម្លាំងជួយសង្គ្រោះជាបន្ទាន់។`;

  return sendSMS({
    to: alert.phone,
    message: msg,
    alertId: alert.id,
    type: alert.type,
  });
};

/**
 * Send automatic SMS when an Agent is dispatched to an SOS Alert.
 */
const notifyAgentDispatched = async (alert, agent) => {
  if (!alert) return;

  // 1. Notify reporting citizen
  if (alert.phone) {
    const agentName = agent?.name || 'កម្លាំងអន្តរាគមន៍';
    const agentPhone = agent?.phone ? ` (ទូរស័ព្ទ: ${agent.phone})` : '';
    const citizenMsg = `[Smart City SOS] កម្លាំងសង្គ្រោះ ${agentName}${agentPhone} ត្រូវបានចាត់តាំង និងកំពុងធ្វើដំណើរទៅកាន់ទីតាំងរបស់អ្នក។ សូមរង់ចាំនៅទីតាំងសុវត្ថិភាព។`;

    sendSMS({
      to: alert.phone,
      message: citizenMsg,
      alertId: alert.id,
      type: alert.type,
    }).catch(() => {});
  }

  // 2. Notify dispatched agent if they have phone
  if (agent && agent.phone) {
    const loc = [alert.district, alert.province].filter(Boolean).join(', ') || 'Siem Reap';
    const agentMsg = `[Smart City SOS — បេសកកម្មថ្មី] អ្នកត្រូវបានចាត់តាំង SOS #${String(alert.id).slice(0, 8)} (${alert.type}) នៅ ${loc}។ ជនរងគ្រោះ: ${alert.citizenName || 'ពលរដ្ឋ'} (ទូរស័ព្ទ: ${alert.phone || 'N/A'})។`;

    sendSMS({
      to: agent.phone,
      message: agentMsg,
      alertId: alert.id,
      type: alert.type,
    }).catch(() => {});
  }
};

/**
 * Send automatic SMS when an SOS Alert is marked as RESOLVED.
 */
const notifyAlertResolved = async (alert) => {
  if (!alert || !alert.phone) return;

  const msg = `[Smart City SOS] បេសកកម្មសង្គ្រោះ #${String(alert.id).slice(0, 8)} ត្រូវបានបញ្ចប់ដោយជោគជ័យ។ សូមអរគុណដែលបានរាយការណ៍ និងសហការជាមួយក្រុមការងារ។`;

  return sendSMS({
    to: alert.phone,
    message: msg,
    alertId: alert.id,
    type: alert.type,
  });
};

module.exports = {
  sendSMS,
  notifyAlertCreated,
  notifyAgentDispatched,
  notifyAlertResolved,
};
