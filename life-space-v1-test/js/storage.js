(function () {
  "use strict";

  const KEYS = Object.freeze({
    cards: "life-space-v1.cards",
    profile: "life-space-v1.profile",
    homeTheme: "life-space-v1.home-theme",
    users: "life-space-v1.users",
    session: "life-space-v1.session",
    interactions: "life-space-v1.interactions",
    notifications: "life-space-v1.notifications"
  });

  const DEMO_USER = Object.freeze({
    id: "user-demo-lugu",
    phone: "13800000000",
    nickname: "路谷",
    createdAt: "2026-07-01T08:00:00.000Z"
  });

  function read(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn("生命空间本地数据读取失败", error);
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      if (error && error.name === "QuotaExceededError") {
        throw new Error("图片占用空间较大，请选择更小的照片后重试。");
      }
      throw new Error("保存失败，请确认浏览器允许本地存储。");
    }
  }

  function scopedKey(key, userId) {
    return `${key}.${userId || currentUserId() || "guest"}`;
  }

  function currentUserId() {
    const session = read(KEYS.session, null);
    return session && session.userId ? session.userId : "";
  }

  function ensureDemoUser() {
    const users = read(KEYS.users, []);
    if (!users.some((user) => user.id === DEMO_USER.id)) {
      users.push(DEMO_USER);
      write(KEYS.users, users);
    }
    const demoProfileKey = scopedKey(KEYS.profile, DEMO_USER.id);
    if (!localStorage.getItem(demoProfileKey)) {
      write(demoProfileKey, Object.assign({}, window.LifeSpaceDefaults.profile, {
        nickname: "路谷",
        quote: "向内生长，也向世界发光",
        bio: "喜欢山湖、音乐和那些值得慢慢记住的时刻。",
        theme: "quiet-green"
      }));
    }
    const demoCardsKey = scopedKey(KEYS.cards, DEMO_USER.id);
    if (!localStorage.getItem(demoCardsKey)) {
      write(demoCardsKey, [{
        id: "demo-card-lake",
        userId: DEMO_USER.id,
        channelId: "life",
        title: "湖边的一整个下午",
        subtitle: "风把时间吹得很慢",
        content: "没有特别的计划，只是沿着湖边走了很久。水面在发光，远处的山很安静。原来有些日子，不需要发生什么，也值得被好好收藏。",
        images: [],
        imageLayout: "auto",
        visualTemplate: "e",
        textPaper: "cream-lines",
        createdAt: "2026-07-18T08:30:00.000Z",
        updatedAt: "2026-07-18T08:30:00.000Z",
        status: "published"
      }]);
    }
    return users;
  }

  function normalizeCard(card) {
    const textPapers = ["plain", "cream-lines", "blue-grid", "pink-dots", "leaf", "sunshine", "stars", "kraft", "ink-wash", "rainbow"];
    const validModules = window.LifeSpaceDefaults.channels.map((channel) => channel.id);
    const moduleType = validModules.includes(card.moduleType)
      ? card.moduleType
      : validModules.includes(card.channelId) ? card.channelId : "life";
    return Object.assign({}, window.LifeSpaceDefaults.cardShape, card, {
      moduleType,
      channelId: moduleType,
      images: Array.isArray(card.images) ? card.images : [],
      imageLayout: ["auto", "hero", "hero-2", "hero-4", "grid"].includes(card.imageLayout) ? card.imageLayout : "auto",
      visualTemplate: ["a", "b", "c", "d", "e", "f"].includes(card.visualTemplate) ? card.visualTemplate : "",
      textPaper: textPapers.includes(card.textPaper) ? card.textPaper : "plain",
      tags: Array.isArray(card.tags) ? card.tags : []
    });
  }

  const api = {
    getUsers() {
      return ensureDemoUser().slice();
    },
    getCurrentUser() {
      const id = currentUserId();
      return ensureDemoUser().find((user) => user.id === id) || null;
    },
    getUser(id) {
      return ensureDemoUser().find((user) => user.id === id) || null;
    },
    register(phone, nickname) {
      const normalizedPhone = String(phone || "").replace(/\D/g, "");
      if (!/^1\d{10}$/.test(normalizedPhone)) throw new Error("请输入正确的 11 位手机号");
      const users = ensureDemoUser();
      let user = users.find((item) => item.phone === normalizedPhone);
      if (!user) {
        user = {
          id: `LX-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          phone: normalizedPhone,
          nickname: String(nickname || "").trim().slice(0, 12) || `生命朋友${normalizedPhone.slice(-4)}`,
          createdAt: new Date().toISOString()
        };
        users.push(user);
        write(KEYS.users, users);
        write(scopedKey(KEYS.profile, user.id), Object.assign({}, window.LifeSpaceDefaults.profile, {
          nickname: user.nickname
        }));
        write(scopedKey(KEYS.cards, user.id), []);
        write(scopedKey(KEYS.homeTheme, user.id), Object.assign({}, window.LifeSpaceDefaults.homeTheme));
      }
      write(KEYS.session, { userId: user.id, signedInAt: new Date().toISOString() });
      return user;
    },
    login(phone) {
      const normalizedPhone = String(phone || "").replace(/\D/g, "");
      const user = ensureDemoUser().find((item) => item.phone === normalizedPhone);
      if (!user) throw new Error("该手机号尚未注册");
      write(KEYS.session, { userId: user.id, signedInAt: new Date().toISOString() });
      return user;
    },
    logout() {
      localStorage.removeItem(KEYS.session);
    },
    requireUser(returnTo) {
      const user = this.getCurrentUser();
      if (user) return user;
      const target = returnTo || `${location.pathname.split("/").pop() || "index.html"}${location.search}`;
      location.href = `auth.html?returnTo=${encodeURIComponent(target)}`;
      return null;
    },
    getHomeTheme() {
      return Object.assign({}, window.LifeSpaceDefaults.homeTheme, read(scopedKey(KEYS.homeTheme), read(KEYS.homeTheme, {})));
    },
    saveHomeTheme(theme) {
      const defaults = window.LifeSpaceDefaults.homeTheme;
      const clean = {
        backgroundType: theme.backgroundType === "custom" ? "custom" : "preset",
        backgroundValue: String(theme.backgroundValue || defaults.backgroundValue),
        title: String(theme.title || "").trim().slice(0, 20) || defaults.title,
        description: String(theme.description || "").trim().slice(0, 60) || defaults.description,
        textColor: String(theme.textColor || defaults.textColor)
      };
      write(scopedKey(KEYS.homeTheme), clean);
      return clean;
    },
    resetHomeTheme() {
      localStorage.removeItem(scopedKey(KEYS.homeTheme));
      return Object.assign({}, window.LifeSpaceDefaults.homeTheme);
    },
    getProfile() {
      return Object.assign({}, window.LifeSpaceDefaults.profile, read(scopedKey(KEYS.profile), read(KEYS.profile, {})));
    },
    saveProfile(profile) {
      const clean = {
        nickname: String(profile.nickname || "").trim() || window.LifeSpaceDefaults.profile.nickname,
        quote: String(profile.quote || "").trim().slice(0, 30) || window.LifeSpaceDefaults.profile.quote,
        bio: String(profile.bio || "").trim() || window.LifeSpaceDefaults.profile.bio,
        theme: String(profile.theme || window.LifeSpaceDefaults.profile.theme),
        textColor: String(profile.textColor || window.LifeSpaceDefaults.profile.textColor),
        avatar: typeof profile.avatar === "string" && profile.avatar.startsWith("data:image/")
          ? profile.avatar
          : ""
      };
      write(scopedKey(KEYS.profile), clean);
      return clean;
    },
    getCards(moduleType) {
      const cards = read(scopedKey(KEYS.cards), []).map(normalizeCard);
      return cards
        .filter((card) => !moduleType || card.moduleType === moduleType)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    getCard(id) {
      return this.getCards().find((card) => card.id === id) || null;
    },
    saveCard(input) {
      const cards = read(scopedKey(KEYS.cards), []).map(normalizeCard);
      const now = new Date().toISOString();
      const existingIndex = cards.findIndex((card) => card.id === input.id);
      const original = existingIndex >= 0 ? cards[existingIndex] : {};
      const card = normalizeCard(Object.assign({}, original, input, {
        userId: currentUserId() || input.userId || "local-user",
        moduleType: input.moduleType || input.channelId || original.moduleType || original.channelId || "life",
        id: input.id || `life-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: input.createdAt || original.createdAt || now,
        updatedAt: now
      }));

      if (existingIndex >= 0) cards[existingIndex] = card;
      else cards.push(card);
      write(scopedKey(KEYS.cards), cards);
      return card;
    },
    deleteCard(id) {
      const cards = read(scopedKey(KEYS.cards), []);
      const next = cards.filter((card) => card.id !== id);
      if (next.length === cards.length) return false;
      write(scopedKey(KEYS.cards), next);
      return true;
    },
    getPublicSpace(userId) {
      const user = this.getUser(userId);
      if (!user) return null;
      return {
        user,
        profile: Object.assign({}, window.LifeSpaceDefaults.profile, read(scopedKey(KEYS.profile, userId), {
          nickname: user.nickname
        })),
        cards: read(scopedKey(KEYS.cards, userId), []).map(normalizeCard).filter((card) => card.status !== "draft")
      };
    },
    getInteractions() {
      return read(KEYS.interactions, { hearts: [], replies: [], follows: [] });
    },
    toggleHeart(ownerId, cardId) {
      const actor = this.getCurrentUser();
      if (!actor) throw new Error("请先登录后点亮心星");
      if (actor.id === ownerId) throw new Error("不能给自己的空间点心星");
      const data = this.getInteractions();
      const index = data.hearts.findIndex((item) => item.ownerId === ownerId && item.cardId === cardId && item.actorId === actor.id);
      if (index >= 0) data.hearts.splice(index, 1);
      else {
        data.hearts.push({ id: `heart-${Date.now()}`, ownerId, cardId, actorId: actor.id, createdAt: new Date().toISOString() });
        this.addNotification(ownerId, "heart", actor.id, cardId, "点亮了你的心星");
      }
      write(KEYS.interactions, data);
      return { active: index < 0, count: data.hearts.filter((item) => item.ownerId === ownerId && item.cardId === cardId).length };
    },
    addReply(ownerId, cardId, content, parentId) {
      const actor = this.getCurrentUser();
      if (!actor) throw new Error("请先登录后回应");
      const text = String(content || "").trim().slice(0, 500);
      if (!text) throw new Error("请写下回应内容");
      const data = this.getInteractions();
      const reply = { id: `reply-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, ownerId, cardId, actorId: actor.id, content: text, parentId: parentId || "", createdAt: new Date().toISOString() };
      data.replies.push(reply);
      write(KEYS.interactions, data);
      if (ownerId !== actor.id) this.addNotification(ownerId, "reply", actor.id, cardId, "回应了你的记录");
      return reply;
    },
    toggleFollow(ownerId) {
      const actor = this.getCurrentUser();
      if (!actor) throw new Error("请先登录后关注");
      if (actor.id === ownerId) throw new Error("不能关注自己");
      const data = this.getInteractions();
      const index = data.follows.findIndex((item) => item.ownerId === ownerId && item.actorId === actor.id);
      if (index >= 0) data.follows.splice(index, 1);
      else {
        data.follows.push({ id: `follow-${Date.now()}`, ownerId, actorId: actor.id, createdAt: new Date().toISOString() });
        this.addNotification(ownerId, "follow", actor.id, "", "关注了你的生命空间");
      }
      write(KEYS.interactions, data);
      return index < 0;
    },
    addNotification(ownerId, type, actorId, cardId, message) {
      const list = read(KEYS.notifications, []);
      list.unshift({ id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, ownerId, type, actorId, cardId, message, read: false, createdAt: new Date().toISOString() });
      write(KEYS.notifications, list.slice(0, 200));
    },
    getNotifications() {
      const ownerId = currentUserId();
      return read(KEYS.notifications, []).filter((item) => item.ownerId === ownerId);
    },
    markNotificationsRead() {
      const ownerId = currentUserId();
      const list = read(KEYS.notifications, []);
      list.forEach((item) => { if (item.ownerId === ownerId) item.read = true; });
      write(KEYS.notifications, list);
    }
  };

  window.LifeSpaceStorage = Object.freeze(api);
})();
