const { settingsModel } = require('../models/connection');

const SETTINGS_KEY = 'lifecycle.plans';

function readPlans() {
  try {
    const stored = JSON.parse(settingsModel.get(SETTINGS_KEY) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    return [];
  }
}

function writePlans(plans) {
  settingsModel.set(SETTINGS_KEY, JSON.stringify(plans));
}

function sortPlans(plans) {
  return [...plans].sort((left, right) =>
    new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0)
  );
}

const lifecyclePlanService = {
  getAll() {
    return sortPlans(readPlans());
  },

  upsert(hostRef, payload) {
    const plans = readPlans();
    const nextRecord = {
      hostRef,
      ...payload,
      updatedAt: new Date().toISOString(),
    };
    const index = plans.findIndex((plan) => plan.hostRef === hostRef);

    if (index === -1) {
      plans.push(nextRecord);
    } else {
      plans[index] = nextRecord;
    }

    writePlans(plans);
    return nextRecord;
  },

  remove(hostRef) {
    const plans = readPlans();
    const nextPlans = plans.filter((plan) => plan.hostRef !== hostRef);
    writePlans(nextPlans);
    return { success: true };
  },
};

module.exports = lifecyclePlanService;
