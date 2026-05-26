// The single source of truth for where the extension sends its API calls.
// When you deploy the backend, change this URL and update host_permissions
// in manifest.json to match (otherwise the browser will block requests).
window.PROMPT_REFINERY_CONFIG = {
  apiUrl: 'http://localhost:3001',
};
