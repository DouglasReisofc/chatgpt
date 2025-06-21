// utils/sessionUtils.js
let cronTimer = null;

async function resetAllSessions(db) {
  await db.collection('active_sessions').deleteMany({});
  await db.collection('verification_codes').deleteMany({});
  const globalSettings =
    (await db.collection('settings').findOne({ key: 'sessionLimit' })) || {
      limitEnabled: true,
      durationEnabled: true,
      maxSessions: 3,
      sessionDuration: 5
    };
  await db.collection('users').updateMany({}, {
    $set: {
      maxSessions: globalSettings.maxSessions,
      sessionDuration: globalSettings.sessionDuration
    }
  });
  console.log('All sessions reset automatically');
}

async function startSessionResetCron(db) {
  if (cronTimer) {
    clearInterval(cronTimer);
    cronTimer = null;
  }
  const setting =
    (await db.collection('settings').findOne({ key: 'sessionResetCron' })) || {
      enabled: false,
      hours: 24
    };
  if (setting.enabled !== false) {
    const interval = (setting.hours || 24) * 3600 * 1000;
    cronTimer = setInterval(() => {
      resetAllSessions(db).catch(err =>
        console.error('Cron session reset error:', err)
      );
    }, interval);
    console.log(
      `Session reset cron enabled: every ${setting.hours || 24} hour(s)`
    );
  } else {
    console.log('Session reset cron disabled');
  }
}

module.exports = { resetAllSessions, startSessionResetCron };
