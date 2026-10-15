/** Public identifiers only. Never put provider API keys into EXPO_PUBLIC variables. */
export const config = Object.freeze({
  agentId: 'agent_3201kxh8cz66frw97yn0tb0tm134',
  branchId: 'agtbrch_8901m48ppneyfrjsgtp57te8mss0',
  sessionEndpoint: process.env.EXPO_PUBLIC_SESSION_ENDPOINT ?? '',
  maxSessionSeconds: 600,
});
