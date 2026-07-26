(function () {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const cardList = $("#cardList");
  const detailBackdrop = $("#detailBackdrop");
  const viewer = $("#imageViewer");
  const pageParams = new URLSearchParams(window.location.search);
  const requestedModule = pageParams.get("module") || pageParams.get("channel") || "life";
  const moduleConfig = window.LifeSpaceDefaults.channels.find((item) => item.id === requestedModule)
    || window.LifeSpaceDefaults.channels.find((item) => item.id === "life");
  const moduleType = moduleConfig.id;
  const visitorId = pageParams.get("id") || "";
  const visitorMode = pageParams.get("mode") === "visitor";
  const embeddedMode = pageParams.get("embedded") === "1";
  const publicSpace = visitorMode && window.DataService.legacy ? window.DataService.legacy.getPublicSpace(visitorId) : null;
  const demoVisitor = visitorMode
    ? (publicSpace ? Object.assign({}, publicSpace.profile, {
        id: publicSpace.user.id,
        nickname: publicSpace.profile.nickname || publicSpace.user.nickname,
        cards: publicSpace.cards
      }) : (window.LifeSpaceDemoVisitors ? window.LifeSpaceDemoVisitors[visitorId] : null))
    : null;
  const currentUser = window.DataService.legacy.getCurrentUser();
  if (!visitorMode && !currentUser) {
    window.DataService.legacy.requireUser(`channel.html${location.search}`);
    return;
  }
  const templateNames = {
    a: "沉浸大图", b: "左图右文", c: "一大两小",
    d: "杂志版", e: "日记版", f: "拼贴版"
  };
  let previewTemplate = "";
  let listUrls = [];
  let detailUrls = [];
  let viewerUrls = [];
  let viewerIndex = 0;
  const storageOwner = window.DataService.legacy.getCurrentUser();
  const storageScope = `${storageOwner ? storageOwner.id : "visitor"}.${moduleType}`;
  const MUSIC_LIBRARY_KEY = `life-space-v1.music-library.${storageScope}`;
  const MUSIC_SETTINGS_KEY = `life-space-v1.music-settings.${storageScope}`;
  const backgroundMusic = $("#backgroundMusic");
  let musicUrl = "";
  let musicLibrary = [];
  let musicSettings = { trackId: "", enabled: false, volume: 45 };
  const CHANNEL_STYLE_KEY = `life-space-v1.module-style.${storageScope}`;
  const FRAME_IMAGE_ID = `module-frame-image-${storageScope}`;
  const PROMPT_IMAGE_ID = `module-prompt-image-${storageScope}`;
  const FRAME_IMAGE_DATA_KEY = `life-space-v1.module-frame-data.${storageScope}`;
  const PROMPT_IMAGE_DATA_KEY = `life-space-v1.module-prompt-data.${storageScope}`;
  let channelStyle = { frameZoom: 100, frameX: 50, frameY: 50 };
  let frameImageUrl = "";
  let promptImageUrl = "";
  let frameDrag = null;

  function showNotice(message) {
    $("#notice").textContent = message;
    $("#notice").classList.add("show");
    setTimeout(() => $("#notice").classList.remove("show"), 2300);
  }

  function saveChannelStyle() {
    window.DataService.preferences.set(CHANNEL_STYLE_KEY, channelStyle);
  }

  function applyFrameTransform() {
    const image = $("#framePhoto");
    image.style.objectPosition = `${channelStyle.frameX}% ${channelStyle.frameY}%`;
    image.style.transform = `scale(${channelStyle.frameZoom / 100})`;
    $("#framePhotoZoom").value = channelStyle.frameZoom;
  }

  async function loadChannelStyle() {
    const stored = readMusicValue(CHANNEL_STYLE_KEY, {});
    channelStyle = {
      frameZoom: Math.max(100, Math.min(240, Number(stored.frameZoom) || 100)),
      frameX: Math.max(0, Math.min(100, Number(stored.frameX) || 50)),
      frameY: Math.max(0, Math.min(100, Number(stored.frameY) || 50))
    };
    applyFrameTransform();
    const storedFrameImage = window.DataService.preferences.get(FRAME_IMAGE_DATA_KEY, "");
    const storedPromptImage = window.DataService.preferences.get(PROMPT_IMAGE_DATA_KEY, "");
    if (storedFrameImage) {
      $("#framePhoto").src = storedFrameImage;
      $("#framePhoto").hidden = false;
      $("#framePhoto").style.display = "block";
      $("#framePlaceholder").hidden = true;
      $("#framePlaceholder").style.display = "none";
    }
    if (storedPromptImage) {
      $("#promptCard").style.backgroundImage = `url("${storedPromptImage}")`;
    }
    if (storedFrameImage && storedPromptImage) return;
    try {
      const frameRecord = storedFrameImage ? null : await window.DataService.mediaLegacy.get(FRAME_IMAGE_ID);
      if (frameRecord) {
        frameImageUrl = URL.createObjectURL(window.DataService.mediaLegacy.variantBlob(frameRecord, "preview"));
        $("#framePhoto").src = frameImageUrl;
        $("#framePhoto").hidden = false;
        $("#framePhoto").style.display = "block";
        $("#framePlaceholder").hidden = true;
        $("#framePlaceholder").style.display = "none";
      }
      const promptRecord = storedPromptImage ? null : await window.DataService.mediaLegacy.get(PROMPT_IMAGE_ID);
      if (promptRecord) {
        promptImageUrl = URL.createObjectURL(window.DataService.mediaLegacy.variantBlob(promptRecord, "preview"));
        $("#promptCard").style.backgroundImage = `url("${promptImageUrl}")`;
      }
    } catch (error) {
      console.warn("生活频道个性图片读取失败", error);
    }
  }

  async function saveStyleImage(file, id, cardId) {
    if (!file || !file.type.startsWith("image/")) throw new Error("请选择一张图片");
    const record = await window.DataService.mediaLegacy.createAssetsFromFile(file, {
      id,
      cardId,
      createdAt: new Date().toISOString()
    });
    await window.DataService.mediaLegacy.putMany([record]);
    return record;
  }

  function prepareLocalImage(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith("image/")) {
        reject(new Error("请选择一张图片"));
        return;
      }
      const fileUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        const maxSide = 1200;
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(fileUrl);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      image.onerror = () => {
        URL.revokeObjectURL(fileUrl);
        reject(new Error("无法读取这张照片，请换一张 JPG、PNG 或 WebP 图片"));
      };
      image.src = fileUrl;
    });
  }

  function readMusicValue(key, fallback) {
    return window.DataService.preferences.get(key, fallback);
  }

  function saveMusicState() {
    window.DataService.preferences.set(MUSIC_LIBRARY_KEY, musicLibrary);
    window.DataService.preferences.set(MUSIC_SETTINGS_KEY, musicSettings);
  }

  function renderMusicLibrary() {
    const select = $("#musicSelect");
    select.innerHTML = musicLibrary.length
      ? musicLibrary.map((track) => `<option value="${escapeHtml(track.id)}">${escapeHtml(track.name)}</option>`).join("")
      : '<option value="">尚未添加音乐</option>';
    if (!musicLibrary.some((track) => track.id === musicSettings.trackId)) {
      musicSettings.trackId = musicLibrary[0] ? musicLibrary[0].id : "";
    }
    select.value = musicSettings.trackId;
    select.disabled = !musicLibrary.length;
    $("#musicEnabled").checked = Boolean(musicSettings.enabled && musicSettings.trackId);
    $("#musicVolume").value = musicSettings.volume;
    $("#musicVolumeValue").value = `${musicSettings.volume}%`;
  }

  function setMusicStatus(message) {
    $("#musicStatus").textContent = message;
  }

  async function loadSelectedMusic(shouldPlay) {
    if (musicUrl) {
      URL.revokeObjectURL(musicUrl);
      musicUrl = "";
    }
    backgroundMusic.pause();
    backgroundMusic.removeAttribute("src");
    if (!musicSettings.trackId) {
      musicSettings.enabled = false;
      $("#musicEnabled").checked = false;
      setMusicStatus("请先添加一首音乐");
      return;
    }
    try {
      const record = await window.DataService.mediaLegacy.get(musicSettings.trackId);
      if (!record || !record.originalBlob) throw new Error("音乐文件不存在");
      musicUrl = URL.createObjectURL(record.originalBlob);
      backgroundMusic.src = musicUrl;
      backgroundMusic.volume = musicSettings.volume / 100;
      if (shouldPlay && musicSettings.enabled) {
        await backgroundMusic.play();
        setMusicStatus(`正在播放：${record.fileName || "我的音乐"}`);
      } else {
        setMusicStatus(musicSettings.enabled ? "点击音乐开关开始播放" : "当前已关闭");
      }
    } catch (error) {
      musicSettings.enabled = false;
      $("#musicEnabled").checked = false;
      setMusicStatus(error.message || "音乐读取失败");
      saveMusicState();
    }
  }

  async function initializeMusic() {
    musicLibrary = readMusicValue(MUSIC_LIBRARY_KEY, []).filter((track) => track && track.id && track.name);
    const stored = readMusicValue(MUSIC_SETTINGS_KEY, {});
    musicSettings = {
      trackId: String(stored.trackId || ""),
      enabled: Boolean(stored.enabled),
      volume: Math.max(0, Math.min(100, Number(stored.volume) || 45))
    };
    renderMusicLibrary();
    await loadSelectedMusic(false);
  }

  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  function formatDate(value, includeTime) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric", month: "long", day: "numeric",
      hour: includeTime ? "2-digit" : undefined,
      minute: includeTime ? "2-digit" : undefined
    }).format(date);
  }

  function formatDotDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join(".");
  }

  function activeCards() {
    if (demoVisitor) {
      return demoVisitor.cards
        .filter((card) => (card.moduleType || card.channelId || "life") === moduleType && card.visibility !== "private")
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return window.DataService.legacy.getCards(moduleType);
  }

  function activeCard(id) {
    const card = demoVisitor
      ? demoVisitor.cards.find((card) => card.id === id && (card.moduleType || card.channelId || "life") === moduleType && card.visibility !== "private") || null
      : window.DataService.legacy.getCard(id);
    return card && (card.moduleType || card.channelId || "life") === moduleType ? card : null;
  }

  function applyModuleConfig() {
    document.title = `${moduleConfig.name}｜我的生命空间`;
    $(".channel-header .eyebrow").textContent = `${moduleConfig.shortName} MODULE`;
    $(".channel-header h1").textContent = moduleConfig.name;
    $(".channel-header > p:last-child").textContent = moduleConfig.description;
    $("#recordsTitle").textContent = `${moduleConfig.shortName}记录`;
    $(".prompt-card > p").textContent = moduleConfig.prompt;
    $(".prompt-record-button").href = `editor.html?module=${encodeURIComponent(moduleType)}`;
    $(".prompt-record-button").innerHTML = `<span aria-hidden="true">＋</span> 新增${moduleConfig.shortName}内容`;
    $("#lifePhotoFrame").setAttribute("aria-label", `${moduleConfig.name}相框`);
    $("#framePlaceholder span").textContent = moduleConfig.shortName.toUpperCase();
    $("#framePlaceholder strong").textContent = `放一张属于${moduleConfig.shortName}的照片`;
  }

  function initializeVisitorView() {
    if (!demoVisitor) return;
    document.body.classList.add("visitor-channel");
    document.title = `${demoVisitor.nickname}的${moduleConfig.shortName}｜生命空间`;
    $(".channel-header .eyebrow").textContent = `VISITING ${moduleConfig.shortName.toUpperCase()} MODULE`;
    $(".channel-header h1").textContent = `${demoVisitor.nickname}的${moduleConfig.shortName}`;
    $(".channel-header > p:last-child").textContent = `这里展示的是 TA 愿意与你分享的${moduleConfig.shortName}记录。`;
    $(".prompt-card").hidden = true;
    $("#openMusicPanel").hidden = true;
    $("#recordsTitle").textContent = `公开${moduleConfig.shortName}记录`;
    const backParams = new URLSearchParams({ mode: "visitor", id: demoVisitor.id });
    if (embeddedMode) backParams.set("embedded", "1");
    $(".back-link").href = `index.html?${backParams.toString()}`;
    $(".back-link").textContent = "← 返回 TA 的生命空间";
  }

  function revokeUrls(urls) {
    urls.forEach((url) => URL.revokeObjectURL(url));
    urls.length = 0;
  }

  async function resolveImages(card, variant, urlBucket) {
    const images = Array.isArray(card.images) ? card.images : [];
    const resolved = [];
    for (let index = 0; index < images.length; index += 1) {
      const image = images[index];
      if (typeof image === "string" && image.startsWith("data:image/")) {
        resolved.push({ src: image, index, positionX: 50, positionY: 50 });
        continue;
      }
      if (typeof image === "string" && !image.startsWith("data:")) {
        resolved.push({ src: image, index, positionX: 50, positionY: 50 });
        continue;
      }
      if (image && typeof image === "object" && image.src) {
        resolved.push({
          src: image.src,
          index,
          positionX: Number.isFinite(Number(image.positionX)) ? Number(image.positionX) : 50,
          positionY: Number.isFinite(Number(image.positionY)) ? Number(image.positionY) : 50
        });
        continue;
      }
      const id = typeof image === "string" ? image : image && image.id;
      if (!id) continue;
      try {
        const record = await window.DataService.mediaLegacy.get(id);
        const blob = window.DataService.mediaLegacy.variantBlob(record, variant);
        if (!blob) continue;
        const url = URL.createObjectURL(blob);
        urlBucket.push(url);
        resolved.push({
          src: url,
          index,
          positionX: typeof image === "object" && Number.isFinite(Number(image.positionX)) ? Number(image.positionX) : 50,
          positionY: typeof image === "object" && Number.isFinite(Number(image.positionY)) ? Number(image.positionY) : 50
        });
      } catch (error) {
        console.warn("生命卡图片读取失败", id, error);
      }
    }
    return resolved;
  }

  async function resolveMedia(meta, urlBucket) {
    if (!meta || !meta.id) return null;
    try {
      const record = await window.DataService.mediaLegacy.get(meta.id);
      if (!record || !record.originalBlob) return null;
      const url = URL.createObjectURL(record.originalBlob);
      urlBucket.push(url);
      return { url, fileName: meta.fileName || record.fileName || "媒体文件" };
    } catch (error) {
      console.warn("媒体文件读取失败", meta.id, error);
      return null;
    }
  }

  function recommendedTemplate(card, imageCount) {
    if (card.visualTemplate && templateNames[card.visualTemplate]) return card.visualTemplate;
    if (imageCount >= 5) return "f";
    if (imageCount === 3 || imageCount === 4) return "c";
    if (imageCount === 2) return "b";
    if (imageCount === 1) return "a";
    return "e";
  }

  function textParts(card) {
    const title = String(card.title || "").trim();
    const subtitle = String(card.subtitle || "").trim();
    const content = String(card.content || "").trim();
    const tags = [moduleConfig.shortName].concat((card.tags || []).filter(Boolean).slice(0, 2));
    return {
      title: title ? `<h3 class="visual-title">${escapeHtml(title)}</h3>` : "",
      subtitle: subtitle ? `<p class="visual-subtitle">${escapeHtml(subtitle)}</p>` : "",
      content: content ? `<p class="visual-copy">${escapeHtml(content)}</p>` : "",
      date: `<time class="visual-date">${formatDotDate(card.createdAt)}</time>`,
      tags: `<div class="visual-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>`
    };
  }

  function imageButton(cardId, image, extraClass, remaining) {
    if (!image) return `<div class="visual-placeholder ${extraClass || ""}" aria-hidden="true"><span>LIFE</span></div>`;
    return `
      <button class="visual-photo ${extraClass || ""}" type="button" data-card-image="${escapeHtml(cardId)}" data-image-index="${image.index}" aria-label="查看第 ${image.index + 1} 张高清图片">
        <img src="${image.src}" alt="生命记录第 ${image.index + 1} 张图片">
        ${remaining > 0 ? `<span class="visual-more">+${remaining}</span>` : ""}
      </button>`;
  }

  function templateHtml(card, images, template) {
    const text = textParts(card);
    const first = images[0];
    const titleOrContent = text.title || text.content;

    if (template === "a") {
      return `
        <article class="life-card visual-card card-template-a" data-card-open="${escapeHtml(card.id)}" tabindex="0">
          <div class="a-hero">${imageButton(card.id, first, "", images.length - 1)}</div>
          <div class="a-caption">
            ${text.subtitle}
            ${titleOrContent}
            ${text.title ? text.content : ""}
            <div class="visual-meta">${text.date}${text.tags}</div>
          </div>
        </article>`;
    }
    if (template === "b") {
      return `
        <article class="life-card visual-card card-template-b" data-card-open="${escapeHtml(card.id)}" tabindex="0">
          <div class="b-photo">${imageButton(card.id, first, "", images.length - 1)}</div>
          <div class="b-body">
            ${text.subtitle}${text.title}${text.content}
            <div class="b-rule"></div>${text.date}${text.tags}
          </div>
        </article>`;
    }
    if (template === "c") {
      const visible = images.slice(0, 3);
      return `
        <article class="life-card visual-card card-template-c" data-card-open="${escapeHtml(card.id)}" tabindex="0">
          <div class="c-gallery">
            ${visible.length ? visible.map((image, index) => imageButton(card.id, image, `c-photo-${index + 1}`, index === visible.length - 1 ? images.length - visible.length : 0)).join("") : imageButton(card.id, null)}
          </div>
          <div class="c-body">${text.subtitle}${text.title}${text.content}<div class="visual-meta">${text.date}${text.tags}</div></div>
        </article>`;
    }
    if (template === "d") {
      return `
        <article class="life-card visual-card card-template-d" data-card-open="${escapeHtml(card.id)}" tabindex="0">
          <div class="d-issue"><span>LIFE SPACE · MEMORY</span><span>NO. ${String(new Date(card.createdAt).getDate()).padStart(3, "0")}</span></div>
          <div class="d-heading">${text.subtitle}${text.title}</div>
          <div class="d-photo">${imageButton(card.id, first, "", images.length - 1)}</div>
          <div class="d-story"><span class="d-dropcap">${escapeHtml((card.title || card.content || "生").trim().charAt(0) || "生")}</span>${text.content}</div>
          <div class="d-footer">${text.date}${text.tags}</div>
        </article>`;
    }
    if (template === "e") {
      return `
        <article class="life-card visual-card card-template-e" data-card-open="${escapeHtml(card.id)}" tabindex="0">
          <div class="e-top"><div class="e-calendar">${formatDate(card.createdAt, false)}</div>${first ? `<div class="e-photo">${imageButton(card.id, first, "", images.length - 1)}</div>` : ""}</div>
          ${text.subtitle}${text.title}${text.content}
          <div class="e-signature">—— 写给此刻的我</div>
          ${text.tags}
        </article>`;
    }

    const visible = images.slice(0, 5);
    return `
      <article class="life-card visual-card card-template-f" data-card-open="${escapeHtml(card.id)}" tabindex="0">
        <div class="f-stamp">LIFE<br>MEMORY</div>
        <div class="f-gallery">
          ${visible.length ? visible.map((image, index) => imageButton(card.id, image, `f-photo-${index + 1}`, index === visible.length - 1 ? images.length - visible.length : 0)).join("") : imageButton(card.id, null)}
        </div>
        <div class="f-caption">${text.subtitle}${text.title}${text.content}<div class="visual-meta">${text.date}${text.tags}</div></div>
      </article>`;
  }

  async function render() {
    revokeUrls(listUrls);
    const cards = activeCards();
    $("#recordCount").textContent = `${cards.length} 条`;
    if (!cards.length) {
      cardList.innerHTML = `
        <div class="empty-state">
          <div class="empty-mark" aria-hidden="true">✦</div>
          <h3>${escapeHtml(moduleConfig.emptyTitle)}</h3>
          <p>这里还没有内容，可以从第一条开始。</p>
          ${demoVisitor ? "" : `<a class="empty-add-button" href="editor.html?module=${encodeURIComponent(moduleType)}">${escapeHtml(moduleConfig.addLabel)}</a>`}
        </div>`;
      return;
    }
    const fragments = [];
    for (const card of cards) {
      const images = await resolveImages(card, "thumbnail", listUrls);
      const template = previewTemplate || recommendedTemplate(card, images.length);
      fragments.push(window.LifeCardRenderer.render(card, images, {
        template,
        interactive: true,
        mode: "list",
        readonly: Boolean(demoVisitor)
      }));
    }
    cardList.innerHTML = fragments.join("");
  }

  function effectiveLayout(layout, count) {
    if (layout === "hero") return "hero";
    if (layout === "hero-2" && count >= 3) return "hero-2";
    if (layout === "hero-4" && count >= 5) return "hero-4";
    if (layout === "grid") return "grid";
    if (count === 1) return "hero";
    if (count === 3) return "hero-2";
    if (count >= 5) return "hero-4";
    return "grid";
  }

  function galleryHtml(card, images) {
    if (!images.length) return "";
    const layout = effectiveLayout(card.imageLayout, images.length);
    return `
      <div class="photo-layout layout-${layout} detail-gallery">
        ${images.map((image) => `
          <div class="photo-cell detail-photo-cell">
            <button class="detail-photo-view" type="button" data-image-index="${image.index}" data-card-image="${escapeHtml(card.id)}" aria-label="查看第 ${image.index + 1} 张高清图片">
              <img src="${image.src}" alt="生命记录第 ${image.index + 1} 张图片" style="object-position:${image.positionX}% ${image.positionY}%">
            </button>
            ${demoVisitor ? "" : `<button class="detail-photo-delete" type="button" data-delete-image="${image.index}" data-card-id="${escapeHtml(card.id)}" aria-label="删除第 ${image.index + 1} 张照片">删除</button>`}
          </div>
        `).join("")}
      </div>`;
  }

  async function openDetail(id) {
    const card = activeCard(id);
    if (!card) return;
    revokeUrls(detailUrls);
    const images = await resolveImages(card, "preview", detailUrls);
    const video = await resolveMedia(card.video, detailUrls);
    const voice = await resolveMedia(card.voice, detailUrls);
    const title = String(card.title || "").trim();
    const subtitle = String(card.subtitle || "").trim();
    const content = String(card.content || "").trim();
    const interactions = window.DataService.legacy.getInteractions();
    const ownerId = demoVisitor ? demoVisitor.id : currentUser.id;
    const heartCount = interactions.hearts.filter((item) => item.ownerId === ownerId && item.cardId === card.id).length;
    const heartActive = Boolean(currentUser && interactions.hearts.some((item) => item.ownerId === ownerId && item.cardId === card.id && item.actorId === currentUser.id));
    const replies = interactions.replies.filter((item) => item.ownerId === ownerId && item.cardId === card.id);
    const repliesHtml = replies.length ? replies.map((reply) => {
      const actor = window.DataService.legacy.getUser(reply.actorId);
      return `<li><strong>${escapeHtml(actor ? actor.nickname : "生命朋友")}</strong><p>${escapeHtml(reply.content)}</p><time>${formatDate(reply.createdAt, true)}</time></li>`;
    }).join("") : '<li class="no-replies">还没有回应，写下第一句话吧。</li>';
    $("#detailPanel").innerHTML = `
      <div class="detail-topbar">
        <button class="detail-back" type="button" data-detail-back>← 返回</button>
        <strong>查看完整记录</strong>
      </div>
      ${galleryHtml(card, images)}
      <div class="detail-body">
        ${video ? `<section class="detail-media"><h3>视频</h3><video controls playsinline preload="metadata" src="${video.url}"></video></section>` : ""}
        ${voice ? `<section class="detail-media detail-audio"><h3>语音</h3><audio controls preload="metadata" src="${voice.url}"></audio></section>` : ""}
        ${subtitle ? `<p class="detail-subtitle">${escapeHtml(subtitle)}</p>` : ""}
        ${title ? `<h2>${escapeHtml(title)}</h2>` : ""}
        <div class="detail-meta">${formatDate(card.createdAt, true)}</div>
        ${content ? `<p class="detail-text">${escapeHtml(content)}</p>` : ""}
        <section class="social-panel" data-social-card="${escapeHtml(card.id)}" data-owner-id="${escapeHtml(ownerId)}">
          <div class="social-summary">
            <button class="heart-button${heartActive ? " active" : ""}" type="button" data-heart-card="${escapeHtml(card.id)}" ${!demoVisitor ? "disabled" : ""}>✦ <span>${heartActive ? "已点亮" : "点亮心星"}</span> · <b>${heartCount}</b></button>
            <span>${replies.length} 条回应</span>
          </div>
          <ul class="reply-list">${repliesHtml}</ul>
          ${demoVisitor ? `<form class="reply-form" data-reply-form><input name="reply" maxlength="500" placeholder="写下你的回应…" aria-label="回应内容" required><button type="submit">发送</button></form>` : ""}
        </section>
        ${demoVisitor
          ? '<div class="detail-actions visitor-detail-actions"><button class="detail-save-button" type="button" data-detail-back>返回公开记录</button></div>'
          : `<div class="detail-actions">
              <button class="detail-save-button" type="button" data-detail-save>保存</button>
              <a class="primary-button" href="editor.html?module=${encodeURIComponent(moduleType)}&id=${encodeURIComponent(card.id)}">编辑</a>
              <button class="danger-button" type="button" data-detail-delete="${escapeHtml(card.id)}">删除</button>
            </div>`}
      </div>`;
    detailBackdrop.classList.add("open");
    detailBackdrop.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeDetail() {
    detailBackdrop.classList.remove("open");
    detailBackdrop.setAttribute("aria-hidden", "true");
    if (!viewer.classList.contains("open")) document.body.style.overflow = "";
    revokeUrls(detailUrls);
  }

  function showViewerImage() {
    if (!viewerUrls.length) return;
    $("#viewerImage").src = viewerUrls[viewerIndex].src;
    $("#viewerImage").alt = `生命记录高清图片，第 ${viewerIndex + 1} 张`;
    $("#viewerCount").textContent = `${viewerIndex + 1} / ${viewerUrls.length}`;
    $("#viewerPrev").disabled = viewerUrls.length < 2;
    $("#viewerNext").disabled = viewerUrls.length < 2;
  }

  async function openViewer(cardId, initialIndex) {
    const card = activeCard(cardId);
    if (!card) return;
    if (viewer.classList.contains("open")) closeViewer();
    const tempUrls = [];
    const images = await resolveImages(card, "original", tempUrls);
    viewerUrls = images.map((image) => ({ src: image.src, sourceIndex: image.index, isObjectUrl: tempUrls.includes(image.src) }));
    const foundIndex = viewerUrls.findIndex((image) => image.sourceIndex === Number(initialIndex));
    viewerIndex = foundIndex >= 0 ? foundIndex : 0;
    viewer.classList.add("open");
    viewer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    showViewerImage();
  }

  function closeViewer() {
    viewer.classList.remove("open");
    viewer.setAttribute("aria-hidden", "true");
    $("#viewerImage").removeAttribute("src");
    revokeUrls(viewerUrls.filter((image) => image.isObjectUrl).map((image) => image.src));
    viewerUrls = [];
    if (!detailBackdrop.classList.contains("open")) document.body.style.overflow = "";
  }

  function moveViewer(direction) {
    if (viewerUrls.length < 2) return;
    viewerIndex = (viewerIndex + direction + viewerUrls.length) % viewerUrls.length;
    showViewerImage();
  }

  async function removeCard(id) {
    if (demoVisitor) return;
    const card = window.DataService.legacy.getCard(id);
    if (!card) return;
    const label = String(card.title || "").trim() || "这条生活记录";
    if (!window.confirm(`确定删除“${label}”吗？删除后无法恢复。`)) return;
    try {
      await window.DataService.mediaLegacy.deleteByCard(id);
      window.DataService.legacy.deleteCard(id);
      closeViewer();
      closeDetail();
      await render();
    } catch (error) {
      $("#notice").textContent = error.message;
      $("#notice").classList.add("show");
      setTimeout(() => $("#notice").classList.remove("show"), 2600);
    }
  }

  async function removeCardImage(cardId, imageIndex) {
    if (demoVisitor) return;
    const card = window.DataService.legacy.getCard(cardId);
    if (!card || !Array.isArray(card.images)) return;
    const index = Number(imageIndex);
    if (!Number.isInteger(index) || index < 0 || index >= card.images.length) return;
    if (!window.confirm(`确定删除第 ${index + 1} 张照片吗？其他照片和文字会保留。`)) return;
    const removed = card.images[index];
    const removedId = typeof removed === "string" ? removed : removed && removed.id;
    const nextImages = card.images
      .filter((_, itemIndex) => itemIndex !== index)
      .map((image, order) => typeof image === "object" && image !== null
        ? Object.assign({}, image, { order })
        : image);
    try {
      if (removedId && !String(removedId).startsWith("data:image/")) {
        await window.DataService.mediaLegacy.deleteMany([removedId]);
      }
      window.DataService.legacy.saveCard(Object.assign({}, card, { images: nextImages }));
      closeViewer();
      await render();
      await openDetail(cardId);
      $("#notice").textContent = "已删除这张照片";
      $("#notice").classList.add("show");
      setTimeout(() => $("#notice").classList.remove("show"), 2200);
    } catch (error) {
      $("#notice").textContent = error.message || "照片删除失败，请重试。";
      $("#notice").classList.add("show");
      setTimeout(() => $("#notice").classList.remove("show"), 2600);
    }
  }

  cardList.addEventListener("click", async (event) => {
    const viewButton = event.target.closest("[data-card-view]");
    if (viewButton) {
      await openDetail(viewButton.dataset.cardView);
      return;
    }
    const manageButton = event.target.closest("[data-card-manage]");
    if (manageButton) {
      window.location.href = `editor.html?module=${encodeURIComponent(moduleType)}&id=${encodeURIComponent(manageButton.dataset.cardManage)}`;
      return;
    }
    const imageButton = event.target.closest("[data-card-image]");
    if (imageButton) {
      await openViewer(imageButton.dataset.cardImage, imageButton.dataset.imageIndex);
      return;
    }
    const card = event.target.closest("[data-card-open]");
    if (card) await openDetail(card.dataset.cardOpen);
  });
  cardList.addEventListener("keydown", async (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-card-open]")) {
      event.preventDefault();
      await openDetail(event.target.dataset.cardOpen);
    }
  });
  detailBackdrop.addEventListener("click", async (event) => {
    const heartButton = event.target.closest("[data-heart-card]");
    if (heartButton) {
      const panel = heartButton.closest("[data-social-card]");
      try {
        const result = window.DataService.legacy.toggleHeart(panel.dataset.ownerId, panel.dataset.socialCard);
        heartButton.classList.toggle("active", result.active);
        heartButton.querySelector("span").textContent = result.active ? "已点亮" : "点亮心星";
        heartButton.querySelector("b").textContent = result.count;
      } catch (error) {
        if (!currentUser) location.href = `auth.html?returnTo=${encodeURIComponent(location.pathname.split("/").pop() + location.search)}`;
        else showNotice(error.message);
      }
      return;
    }
    if (event.target.closest("[data-detail-save]")) {
      closeDetail();
      $("#notice").textContent = "记录已保存";
      $("#notice").classList.add("show");
      setTimeout(() => $("#notice").classList.remove("show"), 2200);
      return;
    }
    if (event.target.closest("[data-detail-back]")) {
      closeDetail();
      return;
    }
    const deleteImageButton = event.target.closest("[data-delete-image]");
    if (deleteImageButton) {
      await removeCardImage(deleteImageButton.dataset.cardId, deleteImageButton.dataset.deleteImage);
      return;
    }
    const imageButton = event.target.closest("[data-card-image]");
    if (imageButton) {
      await openViewer(imageButton.dataset.cardImage, imageButton.dataset.imageIndex);
      return;
    }
    if (event.target === detailBackdrop || event.target.closest(".detail-close")) closeDetail();
    const deleteButton = event.target.closest("[data-detail-delete]");
    if (deleteButton) await removeCard(deleteButton.dataset.detailDelete);
  });
  detailBackdrop.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-reply-form]");
    if (!form) return;
    event.preventDefault();
    const panel = form.closest("[data-social-card]");
    try {
      window.DataService.legacy.addReply(panel.dataset.ownerId, panel.dataset.socialCard, new FormData(form).get("reply"));
      await openDetail(panel.dataset.socialCard);
    } catch (error) {
      if (!currentUser) location.href = `auth.html?returnTo=${encodeURIComponent(location.pathname.split("/").pop() + location.search)}`;
      else showNotice(error.message);
    }
  });
  $("#viewerClose").addEventListener("click", closeViewer);
  $("#viewerPrev").addEventListener("click", () => moveViewer(-1));
  $("#viewerNext").addEventListener("click", () => moveViewer(1));
  viewer.addEventListener("click", (event) => {
    if (event.target === viewer) closeViewer();
  });
  $("#openFrameEditor").addEventListener("click", () => {
    $("#frameEditor").hidden = false;
    $("#openFrameEditor").hidden = true;
  });
  $("#closeFrameEditor").addEventListener("click", () => {
    $("#frameEditor").hidden = true;
    $("#openFrameEditor").hidden = false;
  });
  $("#chooseFramePhoto").addEventListener("click", () => $("#framePhotoInput").click());
  $("#framePhotoInput").addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      const imageData = await prepareLocalImage(file);
      window.DataService.preferences.set(FRAME_IMAGE_DATA_KEY, imageData);
      if (frameImageUrl) URL.revokeObjectURL(frameImageUrl);
      frameImageUrl = "";
      channelStyle = { frameZoom: 100, frameX: 50, frameY: 50 };
      saveChannelStyle();
      applyFrameTransform();
      $("#framePhoto").src = imageData;
      $("#framePhoto").hidden = false;
      $("#framePhoto").style.display = "block";
      $("#framePlaceholder").hidden = true;
      $("#framePlaceholder").style.display = "none";
      showNotice("相框照片已更换，可以拖动和缩放");
    } catch (error) {
      showNotice(error.message || "相框照片更换失败");
    }
  });
  $("#framePhotoZoom").addEventListener("input", (event) => {
    channelStyle.frameZoom = Number(event.target.value);
    applyFrameTransform();
    saveChannelStyle();
  });
  $("#framePhotoStage").addEventListener("pointerdown", (event) => {
    if ($("#framePhoto").hidden || $("#frameEditor").hidden) return;
    frameDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      imageX: channelStyle.frameX,
      imageY: channelStyle.frameY
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.classList.add("dragging");
  });
  $("#framePhotoStage").addEventListener("pointermove", (event) => {
    if (!frameDrag || frameDrag.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    channelStyle.frameX = Math.max(0, Math.min(100, frameDrag.imageX - ((event.clientX - frameDrag.startX) / bounds.width) * 100));
    channelStyle.frameY = Math.max(0, Math.min(100, frameDrag.imageY - ((event.clientY - frameDrag.startY) / bounds.height) * 100));
    applyFrameTransform();
  });
  function finishFrameDrag(event) {
    if (!frameDrag || frameDrag.pointerId !== event.pointerId) return;
    frameDrag = null;
    event.currentTarget.classList.remove("dragging");
    saveChannelStyle();
  }
  $("#framePhotoStage").addEventListener("pointerup", finishFrameDrag);
  $("#framePhotoStage").addEventListener("pointercancel", finishFrameDrag);
  $("#changePromptBackground").addEventListener("click", () => $("#promptBackgroundInput").click());
  $("#promptBackgroundInput").addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      const imageData = await prepareLocalImage(file);
      window.DataService.preferences.set(PROMPT_IMAGE_DATA_KEY, imageData);
      if (promptImageUrl) URL.revokeObjectURL(promptImageUrl);
      promptImageUrl = "";
      $("#promptCard").style.backgroundImage = `url("${imageData}")`;
      showNotice("“开始记录”背景已更换");
    } catch (error) {
      showNotice(error.message || "背景图片更换失败");
    }
  });
  $("#openMusicPanel").addEventListener("click", () => {
    $("#musicBackdrop").classList.add("open");
    $("#musicBackdrop").setAttribute("aria-hidden", "false");
  });
  function closeMusicPanel() {
    $("#musicBackdrop").classList.remove("open");
    $("#musicBackdrop").setAttribute("aria-hidden", "true");
  }
  $("#closeMusicPanel").addEventListener("click", closeMusicPanel);
  $("#musicBackdrop").addEventListener("click", (event) => {
    if (event.target === $("#musicBackdrop")) closeMusicPanel();
  });
  $("#musicInput").addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setMusicStatus("请选择音乐或音频文件");
      return;
    }
    setMusicStatus("正在添加音乐…");
    try {
      const id = `music-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await window.DataService.mediaLegacy.putMany([{
        id,
        cardId: "__music_library__",
        originalBlob: file,
        fileName: file.name,
        mimeType: file.type,
        mediaKind: "background-music",
        createdAt: new Date().toISOString()
      }]);
      musicLibrary.push({ id, name: file.name });
      musicSettings.trackId = id;
      musicSettings.enabled = true;
      saveMusicState();
      renderMusicLibrary();
      await loadSelectedMusic(true);
    } catch (error) {
      setMusicStatus(error.message || "音乐添加失败");
    }
  });
  $("#musicSelect").addEventListener("change", async (event) => {
    musicSettings.trackId = event.target.value;
    saveMusicState();
    await loadSelectedMusic(true);
  });
  $("#musicEnabled").addEventListener("change", async (event) => {
    if (!musicSettings.trackId) {
      event.target.checked = false;
      setMusicStatus("请先从设备添加音乐");
      return;
    }
    musicSettings.enabled = event.target.checked;
    saveMusicState();
    if (musicSettings.enabled) {
      if (!backgroundMusic.src) await loadSelectedMusic(false);
      try {
        await backgroundMusic.play();
        const track = musicLibrary.find((item) => item.id === musicSettings.trackId);
        setMusicStatus(`正在播放：${track ? track.name : "我的音乐"}`);
      } catch (error) {
        musicSettings.enabled = false;
        event.target.checked = false;
        saveMusicState();
        setMusicStatus("浏览器阻止了播放，请再次点击开关");
      }
    } else {
      backgroundMusic.pause();
      setMusicStatus("当前已关闭");
    }
  });
  $("#musicVolume").addEventListener("input", (event) => {
    musicSettings.volume = Number(event.target.value);
    backgroundMusic.volume = musicSettings.volume / 100;
    $("#musicVolumeValue").value = `${musicSettings.volume}%`;
    saveMusicState();
  });
  detailBackdrop.addEventListener("play", (event) => {
    if (event.target.matches("audio, video") && !backgroundMusic.paused) {
      backgroundMusic.pause();
      setMusicStatus("播放记录媒体时已暂停背景音乐");
    }
  }, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && $("#musicBackdrop").classList.contains("open")) {
      closeMusicPanel();
      return;
    }
    if (viewer.classList.contains("open")) {
      if (event.key === "Escape") closeViewer();
      if (event.key === "ArrowLeft") moveViewer(-1);
      if (event.key === "ArrowRight") moveViewer(1);
      return;
    }
    if (event.key === "Escape") closeDetail();
  });
  window.addEventListener("beforeunload", () => {
    if (musicUrl) URL.revokeObjectURL(musicUrl);
    if (frameImageUrl) URL.revokeObjectURL(frameImageUrl);
    if (promptImageUrl) URL.revokeObjectURL(promptImageUrl);
  });

  applyModuleConfig();
  initializeVisitorView();
  initializeMusic();
  loadChannelStyle();
  render();
  const initialId = new URLSearchParams(window.location.search).get("view");
  if (initialId) openDetail(initialId);
})();
