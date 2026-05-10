const userStates = new Map();
const leads = [];

export function getUserState(userId) {
  return userStates.get(userId) ?? null;
}

export function setUserState(userId, state) {
  userStates.set(userId, state);
}

export function clearUserState(userId) {
  userStates.delete(userId);
}

export function saveLead(lead) {
  leads.push(lead);
  return lead;
}

export function listLeads() {
  return [...leads];
}
