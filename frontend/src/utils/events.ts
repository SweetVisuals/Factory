export const emitToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  window.dispatchEvent(new CustomEvent('toast', { detail: { message, type } }));
};

export const emitOpenChat = () => {
  window.dispatchEvent(new Event('open-chat'));
};

export const emitOpenAgentModal = (agentName: string) => {
  window.dispatchEvent(new CustomEvent('open-agent-modal', { detail: { agentName } }));
};
