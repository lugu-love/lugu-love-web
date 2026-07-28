(function () {
  "use strict";
  var script = document.currentScript;
  var pageKey = script && script.dataset.pageKey || location.pathname;
  var targetSelector = script && script.dataset.target || "main";
  var target = document.querySelector(targetSelector);
  if (!target || new URLSearchParams(location.search).get("view") === "public") return;

  var DB_NAME = "lugu-space-decoration-v13";
  var state = { system: "classic", editing: false, background: "", tone: "travel", mask: 85, template: "", profile: {}, objects: [], nativeTexts: [] };
  var templates = {
    story: { icon: "📖", name: "故事长卷", fit: "个人故事 · 文化记录", note: "像一本缓缓展开的人生书", tone: "story", color: "#fff4d6", paper: "#f7edd5", frame: "polaroid" },
    album: { icon: "🌅", name: "记忆相册", fit: "家庭 · 旅行 · 珍贵瞬间", note: "用光影收藏值得记住的人", tone: "travel", color: "#f8fbff", paper: "#eef5f6", frame: "polaroid" },
    growth: { icon: "🌱", name: "成长生命树", fit: "长期记录 · 人生变化", note: "看见时间留下的生命轨迹", tone: "quiet", color: "#eff8e9", paper: "#edf4df", frame: "circle" },
    home: { icon: "🏡", name: "家园空间", fit: "家庭 · 村庄 · 组织 · 地方", note: "把共同的记忆安放在一起", tone: "warm", color: "#fff2e5", paper: "#f8ead8", frame: "arch" },
    art: { icon: "🎨", name: "艺术空间", fit: "艺术家 · 创作者 · 年轻用户", note: "展示只属于你的精神世界", tone: "deep", color: "#f1edff", paper: "#e8e0f4", frame: "plain" }
  };
  var selectedId = null;
  var press = null;
  var canvas, panel, entry, toastTimer, autosaveTimer;

  function database() {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = function () { if (!request.result.objectStoreNames.contains("pages")) request.result.createObjectStore("pages"); };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }
  async function readDraft() {
    try {
      var db = await database();
      var value = await new Promise(function (resolve, reject) { var tx = db.transaction("pages", "readonly"); var req = tx.objectStore("pages").get(pageKey); req.onsuccess = function () { resolve(req.result); }; req.onerror = function () { reject(req.error); }; });
      db.close(); return value;
    } catch (_) { try { return JSON.parse(localStorage.getItem("v13-page-" + pageKey) || "null"); } catch (_) { return null; } }
  }
  async function writeDraft(showMessage) {
    captureNativeTexts();
    try {
      var db = await database();
      await new Promise(function (resolve, reject) { var tx = db.transaction("pages", "readwrite"); tx.objectStore("pages").put(state, pageKey); tx.oncomplete = resolve; tx.onerror = function () { reject(tx.error); }; });
      db.close(); if (showMessage) toast("空间已保存"); return true;
    } catch (_) { try { localStorage.setItem("v13-page-" + pageKey, JSON.stringify(state)); if (showMessage) toast("空间已保存"); return true; } catch (_) { toast("保存空间不足，请减少大图片"); return false; } }
  }
  function autosave() { clearTimeout(autosaveTimer); autosaveTimer = setTimeout(function () { writeDraft(false); }, 500); }
  function toast(text) { var old = document.querySelector(".v13-toast"); if (old) old.remove(); var item = document.createElement("div"); item.className = "v13-toast"; item.textContent = text; document.body.appendChild(item); clearTimeout(toastTimer); toastTimer = setTimeout(function () { item.remove(); }, 1400); }
  function fileData(file, done) { if (!file) return; var reader = new FileReader(); reader.onload = function () { done(String(reader.result || "")); autosave(); }; reader.readAsDataURL(file); }
  function uid() { return Date.now() + Math.floor(Math.random() * 10000); }
  function escapeHtml(value) { var node = document.createElement("div"); node.textContent = value || ""; return node.innerHTML; }
  function nativeNodes() { return Array.from(target.querySelectorAll("h1,h2,h3,p,.lugu-section-name,.nickname,.intro")).filter(function (node) { return !node.closest(".v13-canvas") && node.textContent.trim(); }); }
  function captureNativeTexts() { state.nativeTexts = nativeNodes().map(function (node) { return node.innerHTML; }); }
  function restoreNativeTexts() { nativeNodes().forEach(function (node, index) { if (state.nativeTexts[index] != null) node.innerHTML = state.nativeTexts[index]; }); }
  function setNativeEditing(on) { nativeNodes().forEach(function (node) { node.contentEditable = on ? "true" : "false"; node.classList.toggle("v13-native-editable", on); node.onblur = on ? function () { captureNativeTexts(); autosave(); } : null; }); }

  function build() {
    entry = document.createElement("button"); entry.className = "v13-decorate-entry"; entry.type = "button"; entry.textContent = "✦ 创作空间"; entry.onclick = openCreationHub; document.body.appendChild(entry);
    canvas = document.createElement("div"); canvas.className = "v13-canvas"; canvas.dataset.v13Canvas = ""; document.body.appendChild(canvas);
    applyState();
    document.addEventListener("pointerdown", blankDown, true);
    document.addEventListener("pointermove", blankMove, true);
    document.addEventListener("pointerup", blankUp, true);
    if (!state.template && !state.objects.length) window.setTimeout(openCreationHub, 180);
  }
  function closeModal(modal) { if (modal) modal.remove(); }
  function openCreationHub() {
    var modal = document.createElement("div"); modal.className = "v13-system-choice v13-creator";
    var hasDraft = Boolean(state.template || state.objects.length || state.nativeTexts.length);
    modal.innerHTML = '<div class="v13-choice-card v13-hub-card"><p class="v13-step">我的空间 · 创作中心</p><h2>今天想怎样开始？</h2><p>先选择一个模板自动生成，再用 V1.3 像做 PPT 一样修改。</p><div class="v13-hub-actions"><button data-create><b>＋ 创建新空间</b><small>从五种空间模板开始</small></button><button data-continue ' + (hasDraft ? '' : 'disabled') + '><b>继续编辑</b><small>' + (hasDraft ? '打开上次保存的空间' : '还没有保存的空间') + '</small></button><button data-free><b>自由白板</b><small>从一张空白页面开始</small></button></div><button class="v13-choice-close">返回空间</button></div>';
    modal.onclick = function (event) { var button = event.target.closest("button"); if (!button || button.disabled) return; if (button.hasAttribute("data-create")) { closeModal(modal); showTemplates(); } else if (button.hasAttribute("data-continue")) { closeModal(modal); state.editing = true; applyState(); renderPanel(); } else if (button.hasAttribute("data-free")) { closeModal(modal); state.template = "blank"; state.system = "whiteboard"; state.editing = true; state.objects = []; applyState(); renderPanel(); autosave(); } else closeModal(modal); };
    document.body.appendChild(modal);
  }
  function showTemplates() {
    var modal = document.createElement("div"); modal.className = "v13-system-choice v13-creator";
    modal.innerHTML = '<div class="v13-choice-card v13-template-card"><p class="v13-step">第 1 步，共 2 步</p><h2>选择空间模板</h2><p>先选整体结构，生成后仍可使用 V1.3 自由修改。</p><div class="v13-template-grid">' + Object.keys(templates).map(function (key) { var item = templates[key]; return '<button data-template="' + key + '"><span>' + item.icon + '</span><b>' + item.name + '</b><small>' + item.fit + '</small><em>' + item.note + '</em></button>'; }).join("") + '</div><button class="v13-choice-close">返回</button></div>';
    modal.onclick = function (event) { var button = event.target.closest("button"); if (!button) return; if (button.dataset.template) { closeModal(modal); showProfileForm(button.dataset.template); } else { closeModal(modal); openCreationHub(); } };
    document.body.appendChild(modal);
  }
  function showProfileForm(templateKey) {
    var item = templates[templateKey]; var modal = document.createElement("div"); modal.className = "v13-system-choice v13-creator";
    modal.innerHTML = '<form class="v13-choice-card v13-profile-card"><p class="v13-step">第 2 步，共 2 步 · ' + item.icon + ' ' + item.name + '</p><h2>放入你的内容</h2><p>先填写最重要的部分，其他内容生成后再慢慢增加。</p><label><span>空间名称</span><input name="title" maxlength="32" value="' + escapeHtml((state.profile && state.profile.title) || '我的空间 · 我的世界') + '"></label><label><span>一句话介绍</span><textarea name="intro" maxlength="120">' + escapeHtml((state.profile && state.profile.intro) || '让记忆在这里生长，让爱与世界重新连接。') + '</textarea></label><label class="v13-cover-picker"><span>封面图片（可以稍后添加）</span><input name="cover" type="file" accept="image/*"></label><label><span>第一段故事</span><textarea name="story" maxlength="240">' + escapeHtml((state.profile && state.profile.story) || '从这里开始，写下属于你的故事。时间、地点、照片，以及那些不愿忘记的人。') + '</textarea></label><div class="v13-form-actions"><button type="button" data-back>上一步</button><button class="v13-generate" type="submit">生成我的空间</button></div></form>';
    var form = modal.querySelector("form"); var cover = (state.profile && state.profile.cover) || "";
    form.cover.onchange = function () { fileData(form.cover.files[0], function (src) { cover = src; }); };
    form.onsubmit = function (event) { event.preventDefault(); generateTemplate(templateKey, { title: form.title.value.trim() || "我的空间", intro: form.intro.value.trim(), story: form.story.value.trim(), cover: cover }); closeModal(modal); };
    form.querySelector("[data-back]").onclick = function () { closeModal(modal); showTemplates(); };
    document.body.appendChild(modal); form.title.focus();
  }
  function templateObject(kind, values) {
    return Object.assign({ id: uid(), kind: kind, x: 24, y: 160, w: 280, h: 0, text: "", src: "", template: kind === "title" ? "simple" : "", frame: "plain", font: "inherit", size: kind === "title" ? 32 : 14, color: "", paper: "#f6f0df", opacity: 88, imageScale: 1, imageX: 50, imageY: 50, time: "", location: "" }, values || {});
  }
  function generateTemplate(templateKey, profile) {
    var item = templates[templateKey]; state.template = templateKey; state.profile = profile; state.system = "whiteboard"; state.editing = false; state.tone = item.tone; state.background = "";
    var width = Math.min(382, Math.max(300, window.innerWidth - 48)); var photoW = templateKey === "album" ? Math.round(width * .62) : Math.round(width * .52);
    state.objects = [
      templateObject("title", { x: 24, y: 110, w: width, text: profile.title, size: templateKey === "story" ? 36 : 32, color: item.color, template: templateKey === "art" ? "ink" : templateKey === "home" ? "scroll" : "simple" }),
      templateObject("text", { x: 34, y: 220, w: width - 20, text: profile.intro, size: 14, paper: item.paper, opacity: 90 }),
      templateObject("photo", { x: templateKey === "album" ? 22 : width - photoW + 24, y: 360, w: photoW, h: templateKey === "album" ? 250 : 210, src: profile.cover, frame: item.frame }),
      templateObject("title", { x: 28, y: 650, w: Math.min(230, width), text: templateKey === "growth" ? "我的生命轨迹" : templateKey === "home" ? "我们的共同记忆" : templateKey === "art" ? "我的精神世界" : templateKey === "album" ? "一张照片，一个故事" : "故事，从这里开始", size: 24, color: item.color, template: templateKey === "story" ? "scroll" : "capsule" }),
      templateObject("text", { x: 34, y: 750, w: width - 20, text: profile.story, size: 14, paper: item.paper, opacity: 92, location: "中国·泸沽湖" }),
      templateObject("title", { x: 42, y: 1030, w: width - 36, text: "未完待续 · 继续添加我的内容", size: 18, color: item.color, template: "simple" })
    ];
    applyState(); writeDraft(true); window.scrollTo({ top: 0, behavior: "smooth" }); toast("空间已生成，点击“装修空间”继续修改");
  }
  function chooseSystem() {
    var modal = document.createElement("div"); modal.className = "v13-system-choice";
    modal.innerHTML = '<div class="v13-choice-card"><h2>空间装修系统 V1.3</h2><p>请选择本页的装修方式</p><div class="v13-choice-grid"><button data-system="classic"><b>原页面装修</b><small>保留当前页面全部内容，在原页面上修改和添加。</small></button><button data-system="whiteboard"><b>白板装修</b><small>使用空白页面，从零添加图片、标题和内容。</small></button></div><button class="v13-choice-close">取消</button></div>';
    modal.onclick = function (event) { var button = event.target.closest("button"); if (!button) return; if (button.dataset.system) { state.system = button.dataset.system; state.editing = true; modal.remove(); applyState(); renderPanel(); autosave(); } else modal.remove(); };
    document.body.appendChild(modal);
  }
  function applyState() {
    target.classList.toggle("v13-whiteboard-active", state.system === "whiteboard");
    canvas.classList.toggle("v13-whiteboard", state.system === "whiteboard");
    canvas.dataset.template = state.template || "";
    canvas.style.minHeight = Math.max(document.documentElement.scrollHeight, innerHeight, state.system === "whiteboard" ? 1320 : 0) + "px";
    if (state.background) { target.style.backgroundImage = "url(" + state.background + ")"; target.style.backgroundSize = "cover"; target.style.backgroundPosition = "center"; }
    target.style.setProperty("--v13-mask", String(state.mask / 100));
    setNativeEditing(state.editing && state.system === "classic");
    entry.textContent = state.editing ? "完成装修" : state.template ? "✦ 装修空间" : "✦ 创作空间";
    entry.onclick = state.editing ? finishEditing : state.template ? chooseSystem : openCreationHub;
    renderObjects();
  }
  function finishEditing() { selectedId = null; state.editing = false; if (panel) panel.remove(); panel = null; setNativeEditing(false); applyState(); writeDraft(true); }
  function blankDown(event) {
    if (!state.editing || panel && panel.contains(event.target) || entry.contains(event.target) || event.target.closest("button,a,input,select,textarea,.v13-object")) return;
    press = { x: event.clientX, y: event.clientY, time: Date.now(), target: event.target };
  }
  function blankMove(event) { if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 9) press = null; }
  function blankUp(event) {
    if (!press) return; var start = press; press = null;
    if (Date.now() - start.time < 2000 || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 9) return;
    var rect = canvas.getBoundingClientRect(); showAddMenu(Math.max(8, event.clientX - rect.left), Math.max(8, event.clientY - rect.top));
  }
  function showAddMenu(x, y) {
    var old = document.querySelector(".v13-add-menu"); if (old) old.remove();
    var menu = document.createElement("div"); menu.className = "v13-system-choice v13-add-menu";
    menu.innerHTML = '<div class="v13-choice-card"><h2>在这里添加</h2><p>长按位置就是放置位置，页面上下滑动不受限制。</p><div class="v13-choice-grid"><button data-kind="photo"><b>＋ 图片</b></button><button data-kind="title"><b>＋ 标题</b></button><button data-kind="text"><b>＋ 内容</b></button></div><button class="v13-choice-close">取消</button></div>';
    menu.onclick = function (event) { var button = event.target.closest("button"); if (!button) return; if (button.dataset.kind) addObject(button.dataset.kind, x, y); menu.remove(); };
    document.body.appendChild(menu);
  }
  function addObject(kind, x, y) {
    var object = { id: uid(), kind: kind, x: Math.max(8, x - 85), y: Math.max(8, y - 35), w: kind === "photo" ? 190 : 180, h: kind === "photo" ? 140 : 0, text: kind === "title" ? "点击输入标题" : "点击这里，写下你的内容。", src: "", template: kind === "title" ? "capsule" : "", frame: "plain", font: "inherit", size: kind === "title" ? 26 : 13, color: "", paper: "#f6f0df", opacity: 85, imageScale: 1, imageX: 50, imageY: 50, time: "", location: "" };
    state.objects.push(object); selectedId = object.id; renderObjects(); renderPanel(); autosave();
  }
  function renderObjects() {
    canvas.innerHTML = ""; canvas.style.minHeight = Math.max(document.documentElement.scrollHeight, innerHeight) + "px";
    state.objects.forEach(function (object) {
      var node = document.createElement("div"); node.className = "v13-object " + (object.kind === "photo" ? "v13-object-photo v13-frame-" + object.frame : object.kind === "title" ? "v13-object-title v13-title-" + object.template : "v13-object-text") + (selectedId === object.id ? " is-selected" : ""); node.dataset.id = object.id;
      node.style.left = object.x + "px"; node.style.top = object.y + "px"; node.style.width = object.w + "px"; if (object.h) node.style.height = object.h + "px"; node.style.fontFamily = object.font || "inherit"; node.style.fontSize = object.size + "px"; if (object.color) node.style.color = object.color;
      if (object.kind === "photo") { if (object.src) { node.style.backgroundImage = "url(" + object.src + ")"; node.style.backgroundSize = "auto " + Math.max(100, object.imageScale * 100) + "%"; node.style.backgroundPosition = object.imageX + "% " + object.imageY + "%"; } else node.textContent = "长按编辑后选择图片"; }
      else { node.innerHTML = escapeHtml(object.text); node.style.backgroundColor = object.kind === "text" ? colorAlpha(object.paper, object.opacity / 100) : ""; if (object.kind === "text" && (object.time || object.location)) { var meta = document.createElement("span"); meta.className = "v13-object-meta"; meta.textContent = [formatTime(object.time), object.location && "⌖ " + object.location].filter(Boolean).join(" · "); node.appendChild(meta); } }
      node.onclick = function () { if (!state.editing && object.kind === "photo" && object.src) showOriginal(object.src); };
      attachObjectPress(node, object);
      if (state.editing && selectedId === object.id) addHandles(node, object);
      canvas.appendChild(node);
    });
  }
  function attachObjectPress(node, object) {
    var hold, origin;
    node.onpointerdown = function (event) { if (!state.editing || event.target.closest("button")) return; event.stopPropagation(); origin = { x: event.clientX, y: event.clientY }; hold = setTimeout(function () { selectedId = object.id; renderObjects(); renderPanel(); }, 2000); };
    node.onpointermove = function (event) { if (origin && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 8) { clearTimeout(hold); hold = null; } };
    node.onpointerup = node.onpointercancel = function () { clearTimeout(hold); hold = null; origin = null; };
  }
  function addHandles(node, object) {
    var tools = document.createElement("div"); tools.className = "v13-object-tools";
    [["move","●"],["width","↔"],["height","↕"],["delete","×"]].forEach(function (pair) { var button = document.createElement("button"); button.className = "v13-handle v13-" + pair[0]; button.textContent = pair[1]; if (pair[0] === "delete") button.onclick = function (event) { event.stopPropagation(); state.objects = state.objects.filter(function (item) { return item.id !== object.id; }); selectedId = null; renderObjects(); renderPanel(); autosave(); }; else bindDrag(button, object, pair[0]); tools.appendChild(button); });
    node.appendChild(tools);
    if (object.kind !== "photo") { node.contentEditable = "true"; node.onblur = function () { object.text = Array.from(node.childNodes).filter(function (child) { return !(child.nodeType === 1 && (child.classList.contains("v13-object-tools") || child.classList.contains("v13-object-meta"))); }).map(function (child) { return child.textContent; }).join("").trim(); autosave(); }; }
  }
  function bindDrag(button, object, action) {
    var drag;
    button.onpointerdown = function (event) { event.preventDefault(); event.stopPropagation(); button.setPointerCapture(event.pointerId); drag = { id: event.pointerId, x: event.clientX, y: event.clientY, ox: object.x, oy: object.y, w: object.w, h: object.h || button.parentElement.parentElement.offsetHeight }; };
    button.onpointermove = function (event) { if (!drag || drag.id !== event.pointerId) return; event.preventDefault(); var dx = event.clientX - drag.x, dy = event.clientY - drag.y; if (action === "move") { object.x = drag.ox + dx; object.y = drag.oy + dy; } else if (action === "width") object.w = Math.max(72, drag.w + dx); else { object.h = Math.max(44, drag.h + dy); } renderObjects(); };
    button.onpointerup = button.onpointercancel = function () { if (!drag) return; drag = null; autosave(); };
  }
  function renderPanel() {
    if (!state.editing) return; if (panel) panel.remove(); panel = document.createElement("section"); panel.className = "v13-panel";
    panel.innerHTML = '<div class="v13-panel-head"><b>空间装修系统 V1.3</b><div><button data-action="template">换模板</button><button data-action="save">保存空间</button><button class="v13-finish" data-action="finish">完成装修</button></div></div><details><summary>01 · 色调与背景 <small>页面背景</small></summary><div class="v13-panel-body"><select data-tone><option value="travel">旅行</option><option value="quiet">安静</option><option value="warm">温暖</option><option value="story">故事</option><option value="deep">艺术</option></select><label class="v13-wide">更换背景<input type="file" accept="image/*" data-background></label><button data-clear-bg>恢复背景</button></div></details><details><summary>03 · 添加内容 <small>长按空白处2秒</small></summary><div class="v13-panel-body"><button data-quick="photo">＋ 图片</button><button data-quick="title">＋ 标题</button><button data-quick="text">＋ 内容</button><button data-page>＋ 页面</button></div></details><details><summary>04 · 编辑对象 <small>' + (selectedId ? "已选择" : "长按对象2秒") + '</small></summary><div class="v13-panel-body" data-object-editor></div></details><details><summary>05 · 文字蒙版 <small>' + state.mask + '%</small></summary><div class="v13-panel-body"><span>透明度</span><input type="range" min="0" max="100" value="' + state.mask + '" data-mask><output>' + state.mask + '%</output></div></details>';
    document.body.appendChild(panel); if (selectedId) panel.querySelectorAll("details").forEach(function (details, index) { details.hidden = index !== 2; if (index === 2) details.open = true; }); bindPanel(); fillObjectEditor(panel.querySelector("[data-object-editor]"));
  }
  function bindPanel() {
    panel.querySelector('[data-action="template"]').onclick = function () { finishEditing(); showTemplates(); };
    panel.querySelector('[data-action="save"]').onclick = function () { writeDraft(true); };
    panel.querySelector('[data-action="finish"]').onclick = finishEditing;
    panel.querySelector("[data-tone]").value = state.tone; panel.querySelector("[data-tone]").onchange = function (event) { state.tone = event.target.value; target.dataset.spaceTheme = state.tone; autosave(); };
    panel.querySelector("[data-background]").onchange = function (event) { fileData(event.target.files[0], function (src) { state.background = src; applyState(); renderPanel(); }); };
    panel.querySelector("[data-clear-bg]").onclick = function () { state.background = ""; target.style.backgroundImage = ""; autosave(); };
    panel.querySelectorAll("[data-quick]").forEach(function (button) { button.onclick = function () { addObject(button.dataset.quick, 110, scrollY + 180); }; });
    panel.querySelector("[data-page]").onclick = function () { canvas.style.minHeight = canvas.offsetHeight + 560 + "px"; document.documentElement.style.minHeight = canvas.style.minHeight; toast("已增加一页长度"); };
    panel.querySelector("[data-mask]").oninput = function (event) { state.mask = Number(event.target.value); panel.querySelector("output").textContent = state.mask + "%"; state.objects.forEach(function (item) { if (item.kind === "text") item.opacity = state.mask; }); renderObjects(); autosave(); };
  }
  function fillObjectEditor(host) {
    var object = state.objects.find(function (item) { return item.id === selectedId; }); if (!object) { host.innerHTML = '<small class="v13-wide">长按图片、标题或内容2秒后，在这里编辑。</small>'; return; }
    if (object.kind === "photo") host.innerHTML = '<label>选择/换图<input type="file" accept="image/*" data-photo></label><select data-frame><option value="plain">简约框</option><option value="circle">圆形框</option><option value="oval">椭圆框</option><option value="arch">拱形框</option><option value="film">胶片框</option><option value="wood">木质框</option><option value="polaroid">拍立得</option></select><label class="v13-wide">图片缩放<input type="range" min="1" max="4" step=".05" data-image-scale></label><button data-original>查看原图</button>';
    else host.innerHTML = '<select data-template><option value="simple">简约</option><option value="capsule">胶囊</option><option value="ribbon">丝带</option><option value="scroll">卷轴</option><option value="seal">印章</option><option value="cloud">云朵</option><option value="leaf">树叶</option><option value="floral">花边</option><option value="ink">水墨</option></select><select data-font><option value="inherit">默认字体</option><option value="Songti SC,serif">宋体</option><option value="Kaiti SC,cursive">楷体</option><option value="PingFang SC,sans-serif">苹方</option><option value="STFangsong,serif">仿宋</option></select><select data-size><option>10</option><option>12</option><option>14</option><option>16</option><option>18</option><option>20</option><option>24</option><option>28</option><option>32</option><option>36</option><option>42</option><option>48</option><option>56</option><option>64</option></select><label>字色<input type="color" data-color></label><label>纸色<input type="color" data-paper></label>' + (object.kind === "text" ? '<label class="v13-wide">时间<input type="datetime-local" data-time></label><select data-location><option value="">选择地点</option><option>中国·泸沽湖</option><option>泸沽湖·里格</option><option>泸沽湖·草海</option><option>云南·丽江</option><option>四川·凉山</option><option>线上空间</option></select><button data-gps>GPS定位</button>' : '') + '<button class="v13-accent" data-object-save>保存对象</button><button class="v13-danger" data-object-delete>删除</button>';
    if (object.kind === "photo") { host.querySelector("[data-frame]").value = object.frame; host.querySelector("[data-image-scale]").value = object.imageScale; host.querySelector("[data-photo]").onchange = function (event) { fileData(event.target.files[0], function (src) { object.src = src; renderObjects(); renderPanel(); }); }; host.querySelector("[data-frame]").onchange = function (event) { object.frame = event.target.value; renderObjects(); autosave(); }; host.querySelector("[data-image-scale]").oninput = function (event) { object.imageScale = Number(event.target.value); renderObjects(); autosave(); }; host.querySelector("[data-original]").onclick = function () { if (object.src) showOriginal(object.src); }; }
    else { host.querySelector("[data-template]").value = object.template || "simple"; host.querySelector("[data-font]").value = object.font || "inherit"; host.querySelector("[data-size]").value = String(object.size); host.querySelector("[data-color]").value = object.color || "#26332f"; host.querySelector("[data-paper]").value = object.paper || "#f6f0df"; [["template","template"],["font","font"],["size","size"],["color","color"],["paper","paper"]].forEach(function (pair) { host.querySelector("[data-" + pair[0] + "]").onchange = function (event) { object[pair[1]] = pair[0] === "size" ? Number(event.target.value) : event.target.value; renderObjects(); autosave(); }; }); if (object.kind === "text") { host.querySelector("[data-time]").value = object.time || ""; host.querySelector("[data-location]").value = object.location || ""; host.querySelector("[data-time]").onchange = function (event) { object.time = event.target.value; renderObjects(); autosave(); }; host.querySelector("[data-location]").onchange = function (event) { object.location = event.target.value; renderObjects(); autosave(); }; host.querySelector("[data-gps]").onclick = function () { locate(object); }; } }
    host.querySelector("[data-object-save]") && (host.querySelector("[data-object-save]").onclick = function () { selectedId = null; renderObjects(); renderPanel(); writeDraft(true); });
    host.querySelector("[data-object-delete]") && (host.querySelector("[data-object-delete]").onclick = function () { state.objects = state.objects.filter(function (item) { return item.id !== object.id; }); selectedId = null; renderObjects(); renderPanel(); autosave(); });
  }
  function locate(object) { if (!navigator.geolocation) return toast("当前浏览器不支持定位"); navigator.geolocation.getCurrentPosition(function (position) { object.location = position.coords.latitude.toFixed(5) + ", " + position.coords.longitude.toFixed(5); renderObjects(); renderPanel(); autosave(); toast("定位成功"); }, function () { toast("定位失败，请检查浏览器权限和HTTPS"); }, { enableHighAccuracy: true, timeout: 10000 }); }
  function showOriginal(src) { var viewer = document.createElement("div"); viewer.className = "v13-original"; viewer.innerHTML = '<img src="' + src + '" alt="原图">'; viewer.onclick = function () { viewer.remove(); }; document.body.appendChild(viewer); }
  function colorAlpha(hex, alpha) { var value = (hex || "#f6f0df").replace("#", ""); if (value.length !== 6) return hex; return "rgba(" + parseInt(value.slice(0,2),16) + "," + parseInt(value.slice(2,4),16) + "," + parseInt(value.slice(4,6),16) + "," + alpha + ")"; }
  function formatTime(value) { if (!value) return ""; var date = new Date(value); return isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" }); }

  readDraft().then(function (saved) { if (saved) state = Object.assign(state, saved); restoreNativeTexts(); build(); });
})();
