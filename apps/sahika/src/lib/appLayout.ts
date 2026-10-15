/** Layout lives in the assistant document: one background, one viewport, no nested page. */
export type AppInsets = { top: number; right: number; bottom: number; left: number };
export const ZERO_INSETS: AppInsets = { top: 0, right: 0, bottom: 0, left: 0 };

export const APP_SHADOW_CSS = `
:host([data-sahika-app-layout]) {
  display:flex!important;flex-direction:column!important;
  height:var(--sahika-app-height,100dvh)!important;min-height:0!important;max-height:var(--sahika-app-height,100dvh)!important;
  padding:var(--sahika-safe-top,0px) max(12px,var(--sahika-safe-right,0px)) var(--sahika-safe-bottom,0px) max(12px,var(--sahika-safe-left,0px))!important;
  box-sizing:border-box!important;overflow:hidden!important;container-type:size;
  --app-orb:clamp(88px,22cqh,144px);--app-avatar:clamp(64px,12cqh,100px);
  --app-title:clamp(36px,6.5cqh,50px);--app-space:clamp(4px,1.1cqh,10px);
}
.sahika-app-identity { position:relative!important;flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:3px;padding:4px 0 var(--app-space);background:transparent!important; }
.sahika-app-name { position:relative;margin:0;font-family:SahikaAppTitle,system-ui,sans-serif;font-weight:400;font-style:normal;font-size:var(--app-title);line-height:1.15; }
.sahika-app-name span { display:block;background:linear-gradient(105deg,#7b22d3 5%,#2469ed 28%,#b77aff 44%,#fff 50%,#2469ed 57%,#7b22d3 76%,#2469ed 95%);background-size:350% 100%;background-clip:text;-webkit-background-clip:text;color:transparent;animation:sahika-app-shimmer 5s linear infinite;filter:drop-shadow(0 0 5px #675bec55); }
.sahika-app-subtitle { margin:0;color:var(--vf-muted,#52565f);font:italic 13px/1.3 system-ui,sans-serif;text-align:center; }
.sahika-app-avatar { display:block;width:var(--app-avatar);height:var(--app-avatar);object-fit:contain;border-radius:50%;margin-top:3px; }
.sahika-app-partners { position:relative!important;display:flex;flex:0 0 auto;align-items:center;justify-content:center;gap:12px;height:42px;min-height:0;padding:5px 0 3px;background:transparent!important; }
.sahika-app-partners img { display:block;object-fit:contain;height:31px;width:auto;max-width:82px; }
.sahika-app-partners .sahika-app-yapay { height:29px;max-width:68px; }
.sahika-app-partners span { font:300 13px/1 system-ui,sans-serif;color:var(--vf-muted,#777); }
:host([data-voice-theme=dark]) .sahika-app-partners .sahika-app-yapay { filter:drop-shadow(0 0 2px #fff); }
.vf-root.vf-root { position:relative!important;display:flex!important;flex-direction:column!important;flex:1 1 0!important;width:100%!important;height:auto!important;min-height:0!important;max-height:none!important;max-width:none!important;margin:0!important;padding:0!important;overflow:hidden!important;background:transparent!important;border:0!important; }
.vf-root .content,.vf-root .columns { display:flex!important;flex-direction:column!important;flex:1 1 0!important;min-height:0!important;height:100%!important;max-height:100%!important;min-width:0!important;gap:var(--app-space)!important;padding:0!important;margin:0!important;overflow:hidden!important; }
.vf-root .hero,.vf-root.no-transcript .hero { flex:1 1 0!important;min-height:0!important;display:flex!important;flex-direction:column!important;width:100%!important;max-width:none!important;margin:0!important; }
.vf-root.vf-chat .hero { flex:0 0 auto!important; }
.vf-root .mode-selector { flex:0 0 auto!important;width:100%!important;max-width:540px!important;margin:0 auto var(--app-space)!important;padding:3px!important; }
.vf-root .mode-selector button { min-height:42px!important;padding:6px 10px!important; }
.vf-controls.vf-controls { flex:1 1 0!important;min-height:0!important;max-height:none!important;padding:32px 10px 52px!important;gap:24px!important;align-items:center!important; }
.vf-root .vf-start.vf-start,.vf-root .vf-ptt.vf-ptt { width:var(--app-orb)!important;height:var(--app-orb)!important;margin:0!important; }
.vf-root .vf-start.vf-ended { width:calc(var(--app-orb)*.6)!important;height:calc(var(--app-orb)*.6)!important; }
.vf-root .vf-start:not(.vf-ended):not(.vf-connecting) .circle-caption { top:calc(100% + 35px)!important; }
.vf-root .circle-caption { width:min(190px,44vw)!important; }
.vf-root .state-pill { flex:0 0 auto;min-height:24px!important;margin:4px 0!important;padding:2px 10px!important; }
.vf-root .vf-captions.vf-captions { flex:0 1 auto!important;font-size:clamp(15px,3cqh,20px)!important;min-height:0!important;height:6.25em!important;max-height:24cqh!important; }
.vf-root .wave { flex:0 0 auto;max-height:22px;margin:3px 0!important; }
.vf-root .vf-history { flex:0 0 auto;min-height:36px!important;margin:4px auto 0!important;padding:8px 14px!important; }
.vf-root.vf-chat .vf-history { display:none!important; }
.vf-root.vf-chat .vf-controls { flex:0 0 auto!important;padding:0!important;min-height:0!important; }
.vf-root.vf-chat .vf-start.vf-start { width:38px!important;height:38px!important;margin:0 auto!important; }
.vf-root .conversation,.vf-root .conversation-panel { display:flex;flex-direction:column;flex:1 1 0!important;min-height:0!important;height:auto!important;max-height:100%!important;overflow:hidden!important; }
.vf-root .conversation-head { flex:0 0 auto!important;padding:6px 10px!important;min-height:36px; }
.vf-root .log-wrap { display:flex!important;flex-direction:column!important;flex:1 1 0!important;min-height:0!important;height:auto!important;overflow:hidden!important; }
.vf-root .log,.vf-root.vf-chat .log,.vf-root .eleven-conversation-root,.vf-root.vf-chat .eleven-conversation-root { flex:1 1 0!important;min-height:0!important;height:auto!important;max-height:none!important; }
.vf-root .log { overflow-y:auto!important;overscroll-behavior:contain!important;-webkit-overflow-scrolling:touch;padding:10px!important; }
.vf-root .eleven-conversation-root,.vf-root .pv-conversation { display:flex!important;flex-direction:column!important;min-height:0!important;overflow:hidden!important; }
.vf-root .pv-conversation { flex:1 1 0!important;height:100%!important; }
.vf-root .compose,.vf-root .footer { flex:0 0 auto!important;padding:6px 0 0!important;min-height:0!important; }
.vf-root .compose textarea,.vf-root textarea.input { font-size:16px!important;line-height:1.35!important;min-height:44px!important;height:44px!important;max-height:70px!important;resize:none!important; }
.vf-root .compose-note { padding:0 10px 3px!important;font-size:10px!important; }
.vf-root .typing { flex:0 0 auto;min-height:0!important;padding:0 10px 3px!important; }
.vf-root .inline-recommendations { flex:0 0 auto!important;padding:3px 0!important; }
.vf-root .inline-recommendations .suggestions { gap:4px!important; }
.vf-root .suggestion { padding:6px 10px!important; }
.vf-root .vf-clinic { flex:0 0 auto!important;margin-top:0!important;padding:3px 0!important; }
.vf-root .vf-clinic .actions { gap:20px!important; }
.vf-root .vf-clinic .action-button { width:36px!important;height:36px!important;min-height:36px!important; }
.vf-root .vf-clinic .action-button .icon { width:20px!important;height:20px!important; }
.vf-root .top,.vf-root .brand,.vf-root .orb-wrap,.vf-root .title,.vf-root .subtitle,.vf-root .intro { display:none!important; }
.vf-dialog.vf-dialog { height:calc(var(--sahika-app-height,100dvh) - var(--sahika-safe-top,0px) - var(--sahika-safe-bottom,0px) - 16px)!important;max-height:calc(var(--sahika-app-height,100dvh) - 16px)!important; }
:host([data-sahika-app-compact]) { --app-title:36px;--app-avatar:68px;--app-space:4px;--app-orb:104px; }
:host([data-sahika-app-short]) { --app-orb:70px;--app-space:3px; }
:host([data-sahika-app-short]) .sahika-app-identity { display:grid;grid-template-columns:44px auto;grid-template-rows:auto auto;justify-content:center;column-gap:10px;padding:2px 0 5px; }
:host([data-sahika-app-short]) .sahika-app-avatar { grid-row:1 / 3;grid-column:1;width:42px;height:42px;margin:0; }
:host([data-sahika-app-short]) .sahika-app-name { font-size:30px;line-height:1;grid-row:1;grid-column:2;text-align:center; }
:host([data-sahika-app-short]) .sahika-app-subtitle { grid-row:2;grid-column:2;font-size:11px; }
:host([data-sahika-app-short]) .sahika-app-partners { height:28px;padding:2px 0; }
:host([data-sahika-app-short]) .sahika-app-partners img { height:23px; }
:host([data-sahika-app-short]) .vf-root .conversation-head { min-height:28px;padding:2px 8px!important; }
:host([data-sahika-app-short]) .vf-root .vf-clinic,:host([data-sahika-app-short]) .vf-root .inline-recommendations,:host([data-sahika-app-short]) .vf-root .compose-note { display:none!important; }
:host([data-sahika-app-short]) .vf-controls.vf-controls { padding:12px 8px 28px!important; }
:host([data-sahika-app-short]) .vf-root .vf-halo i:nth-child(n+3),:host([data-sahika-app-short]) .vf-root .vf-halo::after { display:none!important; }
:host([data-sahika-app-short]) .vf-root .vf-start:not(.vf-ended):not(.vf-connecting) .circle-caption { top:calc(100% + 16px)!important; }
:host([data-sahika-app-short]) .vf-root .mode-selector { margin-bottom:3px!important; }
:host([data-sahika-app-short]) .vf-root .mode-selector button { min-height:36px!important; }
:host([data-sahika-app-layout]) [hidden][hidden] { display:none!important; }
@keyframes sahika-app-shimmer { from{background-position:100% 50%}to{background-position:0% 50%} }
@media(prefers-reduced-motion:reduce) { .sahika-app-name span { animation:none; } }
`;

/** Serialized into the HTTPS WebView, not evaluated in the native JS runtime. */
export function appLayoutRuntime() {
  // This function is serialized. All dependencies deliberately arrive through install().
  let observedRoot: ShadowRoot | null = null;
  let observer: MutationObserver | null = null;
  let lastOptions = { css: '', avatar: '', pulsevet: '', yapayMevzular: '', insets: { top: 0, right: 0, bottom: 0, left: 0 } };
  let assistant: HTMLElement | null = null;
  const viewport = () => {
    if (!assistant) return;
    const visual = window.visualViewport;
    const height = Math.max(160, Math.round(Math.min(window.innerHeight, visual?.height || window.innerHeight)));
    const short = height < 500;
    assistant.style.setProperty('--sahika-app-height', `${height}px`);
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      const value = side === 'bottom' && short ? 0 : Math.max(0, lastOptions.insets[side] || 0);
      assistant.style.setProperty(`--sahika-safe-${side}`, `${value}px`);
    }
    assistant.toggleAttribute('data-sahika-app-compact', height < 740);
    assistant.toggleAttribute('data-sahika-app-short', short);
    if (window.scrollY || window.scrollX) window.scrollTo(0, 0);
  };
  const install = (element: HTMLElement, options: typeof lastOptions) => {
    assistant = element;
    lastOptions = options;
    const root = element.shadowRoot;
    if (!root || !root.querySelector('.vf-root,section.frame')) return false;
    element.setAttribute('data-sahika-app-layout', '');
    if (!root.getElementById('sahika-app-layout-style')) {
      const style = document.createElement('style');
      style.id = 'sahika-app-layout-style'; style.textContent = options.css; root.append(style);
    }
    if (!root.getElementById('sahika-app-identity')) {
      const identity = document.createElement('header'); identity.id = 'sahika-app-identity'; identity.className = 'sahika-app-identity';
      const name = document.createElement('h1'); name.className = 'sahika-app-name';
      const shimmer = document.createElement('span'); shimmer.textContent = 'Şahika'; name.append(shimmer);
      const subtitle = document.createElement('p'); subtitle.className = 'sahika-app-subtitle'; subtitle.textContent = 'Yapay Zekâ Veteriner Asistanı';
      const avatar = document.createElement('img'); avatar.className = 'sahika-app-avatar'; avatar.src = options.avatar; avatar.alt = 'Şahika’nın avatarı';
      identity.append(name, subtitle, avatar); root.prepend(identity);
    }
    if (!root.getElementById('sahika-app-partners')) {
      const partners = document.createElement('footer'); partners.id = 'sahika-app-partners'; partners.className = 'sahika-app-partners'; partners.setAttribute('aria-label', 'PulseVet ve Yapay Mevzular');
      const clinic = document.createElement('img'); clinic.src = options.pulsevet; clinic.alt = 'PulseVet';
      const cross = document.createElement('span'); cross.textContent = '×'; cross.setAttribute('aria-hidden', 'true');
      const maker = document.createElement('img'); maker.className = 'sahika-app-yapay'; maker.src = options.yapayMevzular; maker.alt = 'Yapay Mevzular';
      partners.append(clinic, cross, maker); root.append(partners);
    }
    if (observedRoot !== root) {
      observer?.disconnect(); observedRoot = root;
      // Rebuilds replace the shadow contents; message changes never trigger a layout rebuild.
      observer = new MutationObserver(() => { if (assistant) install(assistant, lastOptions); });
      observer.observe(root, { childList: true });
    }
    viewport();
    return true;
  };
  window.addEventListener('resize', viewport, { passive: true });
  window.visualViewport?.addEventListener('resize', viewport, { passive: true });
  window.visualViewport?.addEventListener('scroll', viewport, { passive: true });
  return { install, viewport };
}
