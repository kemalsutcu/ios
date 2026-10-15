import { BELMA_RICH_TEXT_FACTORY_SOURCE } from './belmaRichTextFactory.generated';

/** Per-session presentation guidance; it never changes the global agent configuration. */
export const FORMAT_INSTRUCTION = 'BELMA_YANIT_BICIMI: Yanıtı ve belgelerden çıkarılan metni önce anlam, hukuki önem ve kullanıcının amacı bakımından analiz et; vurguyu yalnız bu anlamsal değerlendirmeye göre seç. Yazılı sohbet açıklamalarında temel sonucu, belirleyici bulguyu veya gerekçeyi **kalın**; kritik süreyi/tarihi veya yapılması gereken eylemi <u>altı çizili</u>; koşulu, belirsizliği, istisnayı veya ihtiyat kaydını *italik* göster. Uygunsa vurgular iç içe olabilir: **<u>tam kritik ifade</u>**. Olumsuzluğu, koşulu, süre başlangıcını ve diğer sınırlayıcı sözcükleri vurgulanan ifadeden koparma. Her paragrafı veya tüm yanıtı vurgulama; kısa ve gerçekten belirleyici bölümler seç, gerekmedikçe üç biçimi birden kullanma. Başlıklar, paragraflar ve maddelerle okunabilirliği artır. Yeni olgu, hüküm, tarih veya kesinlik ekleme; kaynak metnin ve yanıtın anlamını değiştirme. Resmî belge gövdesine, document_json alanlarına, araç parametrelerine, [BELMA_DILEKCE_BASLANGIC] / [BELMA_DILEKCE_BITIS] arasına, doğrudan alıntılara ve kod/JSON bloklarına bu sunum işaretlerini ekleme. Sesli konuşmada Markdown/HTML işaretlerini okuma. Selamlaşma gibi esas bilgi içermeyen kısa yanıtta zorunlu vurgu yoktur.';

export const RICH_TEXT_CSS = `
#card .message-text strong,.vf-history-text strong { font-weight:700!important;color:inherit!important;-webkit-text-fill-color:inherit!important; }
#card .message-text em,.vf-history-text em { font-style:italic!important; }
#card .message-text u,.vf-history-text u { text-decoration-line:underline!important;text-decoration-thickness:1.5px;text-underline-offset:3px; }
#card .message-text h1,#card .message-text h2,#card .message-text h3,#card .message-text h4,#card .message-text h5,#card .message-text h6 { font-size:16px;line-height:1.5;font-weight:700;margin:20px 0 9px; }
.vf-history-text { white-space:normal;overflow-wrap:anywhere; }
.vf-history-text p { margin:0 0 12px;white-space:pre-wrap; }
.vf-history-text p:last-child { margin-bottom:0; }
.vf-history-text ul,.vf-history-text ol { margin:8px 0 14px;padding-left:24px; }
.vf-history-text blockquote { margin:12px 0;padding:4px 14px;border-left:3px solid #d8ddd4; }
.vf-history-text pre { white-space:pre-wrap;overflow-wrap:anywhere;padding:12px;background:#f5f5f4;border-radius:8px; }
.vf-history-text a { color:inherit;text-decoration:underline;text-underline-offset:3px; }
`;

export type RichNode = {
  tag: 'text' | 'strong' | 'em' | 'u' | 'code' | 'a' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'ul' | 'ol' | 'li' | 'blockquote' | 'pre';
  text?: string; children?: RichNode[]; href?: string; start?: number;
};

/** Self-contained so exactly the same parser can be injected into WKWebView. */
export function createBelmaRichText() {
  const word = (char: string) => !!char && /[\p{L}\p{N}_]/u.test(char);
  const space = (char: string) => !char || /\s/u.test(char);
  const textNode = (text: string): RichNode => ({ tag: 'text', text });
  function safeLink(value: string): string | null {
    if (!value || value.length > 36000 || /[\u0000-\u0020\u007f\\<>]/u.test(value)) return null;
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  }
  function inline(source: string, depth = 0): RichNode[] {
    if (depth > 24) return [textNode(source)];
    // Resolve brackets once; nested literal bracket text must not repeatedly scan its suffix.
    const bracketEnds = new Map<number, number>(); const bracketStack: number[] = [];
    for (let offset = 0; offset < source.length; offset++) {
      if (source[offset] === '\\') { offset++; continue; }
      if (source[offset] === '[') bracketStack.push(offset);
      if (source[offset] === ']' && bracketStack.length) bracketEnds.set(bracketStack.pop()!, offset);
    }
    type Frame = { marker: string; tag: 'strong' | 'em' | 'u'; nodes: RichNode[]; literal: string; start: number };
    const frames: Frame[] = [{ marker: '', tag: 'em', nodes: [], literal: '', start: 0 }];
    const flush = (frame: Frame) => { if (frame.literal) { frame.nodes.push(textNode(frame.literal)); frame.literal = ''; } };
    let i = 0;
    while (i < source.length) {
      const frame = frames[frames.length - 1]; const rest = source.slice(i);
      const end = frame.marker === '<u>' ? '</u>' : frame.marker;
      if (end && rest.startsWith(end) && (end === '</u>' || (!space(source[i - 1])
        && (!end.includes('_') || !(word(source[i - 1]) && /[\p{L}\p{N}]/u.test(source[i + end.length] || '')))))) {
        flush(frame); frames.pop(); const parent = frames[frames.length - 1];
        parent.nodes.push({ tag: frame.tag, children: frame.marker === '***' ? [{ tag: 'em', children: frame.nodes }] : frame.nodes });
        i += end.length; continue;
      }
      if (source[i] === '\\' && /[\\`*_\[\]()<>]/u.test(source[i + 1] || '')) { frame.literal += source[i + 1]; i += 2; continue; }
      if (source[i] === '`') {
        const run = /^`+/u.exec(rest)![0]; let closing = i + run.length;
        while ((closing = source.indexOf(run, closing)) !== -1) {
          if (source[closing - 1] !== '`' && source[closing + run.length] !== '`') break;
          closing += run.length;
        }
        if (closing !== -1) { flush(frame); frame.nodes.push({ tag: 'code', text: source.slice(i + run.length, closing) }); i = closing + run.length; continue; }
        // Incomplete code retains its markers and content until the matching closing run arrives.
        frame.literal += source.slice(i); i = source.length; continue;
      }
      if (source[i] === '[' && depth + frames.length < 24) {
        // Brackets and URL parentheses are balanced; no HTML attributes or URL titles are accepted.
        const endLabel = bracketEnds.get(i);
        if (endLabel === undefined) { frame.literal += source.slice(i); i = source.length; continue; }
        const bracket = endLabel + 1;
        if (source[bracket] === '(') {
          let closing = bracket + 1; let parentheses = 1;
          for (; closing < source.length && parentheses; closing++) {
            if (source[closing] === '(') parentheses++;
            if (source[closing] === ')') parentheses--;
          }
          if (parentheses) { frame.literal += source.slice(i); i = source.length; continue; }
          const href = safeLink(source.slice(bracket + 1, closing - 1));
          if (href) { flush(frame); frame.nodes.push({ tag: 'a', href, children: inline(source.slice(i + 1, endLabel), depth + frames.length) }); i = closing; continue; }
          // Unsafe links remain entirely literal, including their label markup.
          frame.literal += source.slice(i, closing); i = closing; continue;
        }
      }
      let marker = '', tag: 'strong' | 'em' | 'u' = 'em';
      if (rest.startsWith('<u>')) { marker = '<u>'; tag = 'u'; }
      else if (rest.startsWith('***')) { marker = '***'; tag = 'strong'; }
      else if (rest.startsWith('**') || rest.startsWith('__')) { marker = rest.slice(0, 2); tag = 'strong'; }
      else if (rest.startsWith('*') || rest.startsWith('_')) marker = rest[0];
      if (marker && depth + frames.length < 24 && !space(source[i + marker.length])
        && (!marker.includes('_') || !word(source[i - 1]))) {
        flush(frame); frames.push({ marker, tag, nodes: [], literal: '', start: i }); i += marker.length; continue;
      }
      frame.literal += source[i++];
    }
    if (frames.length > 1) {
      // Preserve every character of an unfinished outer span; never guess the model's intent.
      frames[0].literal += source.slice(frames[1].start);
    }
    flush(frames[0]); return frames[0].nodes;
  }
  function blocks(source: string, depth = 0): RichNode[] {
    if (depth > 24) return [{ tag: 'p', children: [textNode(source)] }];
    const lines = source.replace(/\r\n?/gu, '\n').split('\n'); const output: RichNode[] = [];
    let paragraph: string[] = [];
    const flush = () => { if (paragraph.length) { output.push({ tag: 'p', children: inline(paragraph.join('\n')) }); paragraph = []; } };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) { flush(); continue; }
      const fence = /^ {0,3}(`{3,}|~{3,})([^`]*)$/u.exec(line);
      if (fence) {
        flush(); const content: string[] = []; const marker = fence[1][0]; const count = fence[1].length;
        let j = i + 1;
        for (; j < lines.length; j++) {
          const close = /^ {0,3}(`+|~+)\s*$/u.exec(lines[j]);
          if (close && close[1][0] === marker && close[1].length >= count) break;
          content.push(lines[j]);
        }
        // Keep unclosed fences visible while streaming, instead of pretending they are final.
        output.push({ tag: 'pre', children: [{ tag: 'code', text: (j === lines.length ? line + '\n' : '') + content.join('\n') }] });
        i = Math.min(j, lines.length - 1); continue;
      }
      const heading = /^ {0,3}(#{1,6})\s+(.+)$/u.exec(line);
      if (heading) { flush(); output.push({ tag: ('h' + heading[1].length) as RichNode['tag'], children: inline(heading[2]) }); continue; }
      if (/^ {0,3}>/u.test(line)) {
        flush(); const quote: string[] = [];
        while (i < lines.length && /^ {0,3}>/u.test(lines[i])) quote.push(lines[i++].replace(/^ {0,3}> ?/u, ''));
        i--; output.push({ tag: 'blockquote', children: blocks(quote.join('\n'), depth + 1) }); continue;
      }
      const list = /^(\s*)(?:([-*+•])|(\d{1,9})[.)])\s+(.+)$/u.exec(line);
      if (list) {
        flush(); const ordered = !!list[3]; const indent = list[1].length; const children: RichNode[] = [];
        let j = i;
        while (j < lines.length) {
          const item = /^(\s*)(?:([-*+•])|(\d{1,9})[.)])\s+(.+)$/u.exec(lines[j]);
          if (!item || item[1].length !== indent || !!item[3] !== ordered) break;
          const body = [item[4]]; j++;
          while (j < lines.length && lines[j].trim() && /^\s+/u.test(lines[j])
            && (lines[j].match(/^\s*/u)![0].length > indent)) {
            body.push(lines[j].slice(Math.min(indent + 2, lines[j].match(/^\s*/u)![0].length))); j++;
          }
          children.push({ tag: 'li', children: blocks(body.join('\n'), depth + 1) });
        }
        const result: RichNode = { tag: ordered ? 'ol' : 'ul', children };
        if (ordered) result.start = Number(list[3]);
        output.push(result);
        i = j - 1; continue;
      }
      paragraph.push(line);
    }
    flush(); return output;
  }
  function render(target: Element, source: string) {
    const doc = target.ownerDocument; const fragment = doc.createDocumentFragment();
    function append(parent: Node, nodes: RichNode[]) {
      for (let index = 0; index < nodes.length; index++) {
        const node = nodes[index];
        if (node.tag === 'text') { parent.appendChild(doc.createTextNode(node.text || '')); continue; }
        const child = doc.createElement(node.tag);
        if (node.tag === 'a' && node.href) {
          child.setAttribute('href', node.href); child.setAttribute('target', '_blank');
          child.setAttribute('rel', 'noopener noreferrer'); child.setAttribute('referrerpolicy', 'no-referrer');
        }
        if (node.tag === 'ol' && node.start !== undefined) child.setAttribute('start', String(node.start));
        if (node.text !== undefined) child.textContent = node.text;
        if (node.children) append(child, node.children);
        parent.appendChild(child);
      }
    }
    append(fragment, blocks(source)); target.replaceChildren(fragment);
  }
  return { inline, blocks, render, safeLink };
}

export const belmaRichText = createBelmaRichText();

/** Only the instruction's first line is replaced; private/history context is byte-for-byte intact. */
export function replaceFormatInstruction(value: unknown): unknown {
  if (typeof value !== 'string' || !value.startsWith('BELMA_YANIT_BICIMI:')) return value;
  const boundary = value.indexOf('\n');
  return FORMAT_INSTRUCTION + (boundary < 0 ? '' : value.slice(boundary));
}

export function buildRichTextAdapterScript(): string {
  return String.raw`
var belmaRichText=(function(){${BELMA_RICH_TEXT_FACTORY_SOURCE}
return createBelmaRichText();})();
var belmaRichInstruction=${JSON.stringify(FORMAT_INSTRUCTION)};
var belmaRichStyle=${JSON.stringify(RICH_TEXT_CSS)};
var belmaRichHosts=new WeakMap(),belmaRichTargets=new WeakMap(),belmaRichTransports=new WeakMap(),belmaRichFormats=new WeakMap();
function belmaPatchTransport(transport){
  if(!transport||typeof transport.sendContextualUpdate!=='function')return;
  var prior=belmaRichTransports.get(transport);
  if(prior===transport.sendContextualUpdate)return;
  var original=transport.sendContextualUpdate;
  var wrapped=function(value){
    if(typeof value==='string'&&value.indexOf('BELMA_YANIT_BICIMI:')===0){
      var boundary=value.indexOf('\n');value=belmaRichInstruction+(boundary<0?'':value.slice(boundary));
    }
    var args=Array.prototype.slice.call(arguments);args[0]=value;return original.apply(this,args);
  };
  belmaRichTransports.set(transport,wrapped);transport.sendContextualUpdate=wrapped;
}
function belmaRenderRich(target,source,draft){
  if(!target||typeof target.replaceChildren!=='function'||!target.ownerDocument||typeof source!=='string')return;
  var cached=belmaRichTargets.get(target);
  if(cached&&cached.source===source&&cached.draft===draft&&cached.text===target.textContent)return;
  belmaRichText.render(target,source);
  belmaRichTargets.set(target,{source:source,draft:draft,text:target.textContent});
}
function belmaPaintRich(element){
  if(!element)return;
  belmaPatchTransport(element.transport);belmaPatchTransport(element.conversation);
  if(Array.isArray(element.messages)&&element.messageNodes&&typeof element.messageNodes.get==='function'){
    element.messages.forEach(function(message){
      if(message.role!=='assistant')return;
      var row=element.messageNodes.get(message.id),target=row&&row.querySelector('.message-text');
      belmaRenderRich(target,message.text,message.draft===true);
    });
  }
  var format=element.format;
  if(format&&format.archive&&format.historyNodes&&typeof format.archive.forEach==='function'){
    format.archive.forEach(function(message){
      if(message.role==='user')return;
      var row=format.historyNodes.get(message.id),target=row&&row.querySelector('.vf-history-text');
      belmaRenderRich(target,message.text,false);
    });
  }
}
function belmaInstallRich(element,root){
  if(!element)return;
  var state=belmaRichHosts.get(element);if(!state){state={};belmaRichHosts.set(element,state);}
  ['renderMessages','render','ensureSession','send'].forEach(function(name){
    if(typeof element[name]!=='function'||state[name]===element[name])return;
    var original=element[name];
    var wrapped=function(){
      belmaPatchTransport(this.transport);belmaPatchTransport(this.conversation);
      var result=original.apply(this,arguments);
      if(name==='render')belmaInstallRich(this,this.shadowRoot);
      if(name==='renderMessages'||name==='render')belmaPaintRich(this);
      return result;
    };
    state[name]=wrapped;element[name]=wrapped;
  });
  var format=element.format;
  if(format&&typeof format.renderHistory==='function'&&belmaRichFormats.get(format)!==format.renderHistory){
    var originalHistory=format.renderHistory;
    var history=function(){var result=originalHistory.apply(this,arguments);belmaPaintRich(element);return result;};
    belmaRichFormats.set(format,history);format.renderHistory=history;
  }
  if(root&&typeof root.getElementById==='function'&&!root.getElementById('belma-ios-rich-style')){
    var style=document.createElement('style');style.id='belma-ios-rich-style';style.textContent=belmaRichStyle;root.appendChild(style);
  }
  belmaPaintRich(element);
}
`;
}
