// Wix Custom Element ID: #customelement1 | Tag: virtari-belma-belge
const CONFIG = {
  agentId: "agent_3901m4m3a562fat953akjhk0b9d4",
  assistantName: "Belma",
  subtitle: "Hukuk asistanı",
  enabled: true,
  fileInputEnabled: true,
  defaultMode: "text",
  voiceInput: "ptt",
  maxSessionSeconds: 600,
  allowBargeIn: true,
  showQuestions: false,
  questions: [],
  placeholder: "Belma’ya bir mesaj yazın…"
};

$w.onReady(() => {
  const element = $w("#customelement1");
  const applyConfig = () => element.setAttribute("config-json", JSON.stringify(CONFIG));
  element.on("virtari-agent-ready", applyConfig);
  applyConfig();
});
