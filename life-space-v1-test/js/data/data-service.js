(function () {
  "use strict";

  const adapter = window.LifeSpaceLocalAdapter;
  if (!adapter) throw new Error("LOCAL_ADAPTER_MISSING");

  const ok = (data) => ({ success: true, data, error: null });
  const fail = (code, message, cause) => ({
    success: false,
    data: null,
    error: { code, message: message || "操作失败", cause: cause || null }
  });
  const wrap = (code, operation) => {
    try {
      return ok(operation());
    } catch (error) {
      return fail(code, error.message, error);
    }
  };
  const wrapAsync = async (code, operation) => {
    try {
      return ok(await operation());
    } catch (error) {
      return fail(code, error.message, error);
    }
  };
  const unwrap = (result) => {
    if (result && result.success) return result.data;
    const error = new Error(result && result.error ? result.error.message : "数据操作失败");
    if (result && result.error) error.code = result.error.code;
    throw error;
  };

  const storage = adapter.storage;
  const media = adapter.mediaStorage;

  const auth = Object.freeze({
    register: (phone, nickname) => wrap("AUTH_REGISTER_FAILED", () => storage.register(phone, nickname)),
    login: (phone) => wrap("AUTH_LOGIN_FAILED", () => storage.login(phone)),
    logout: () => wrap("AUTH_LOGOUT_FAILED", () => storage.logout()),
    getCurrentUser: () => wrap("AUTH_CURRENT_USER_FAILED", () => storage.getCurrentUser()),
    requireUser: (returnTo) => wrap("AUTH_REQUIRED", () => storage.requireUser(returnTo)),
    listUsers: () => wrap("USER_LIST_FAILED", () => storage.getUsers()),
    getUser: (id) => wrap("USER_NOT_FOUND", () => storage.getUser(id))
  });

  const profile = Object.freeze({
    get: () => wrap("PROFILE_READ_FAILED", () => storage.getProfile()),
    update: (input) => wrap("PROFILE_UPDATE_FAILED", () => storage.saveProfile(input)),
    getSpaceConfig: () => wrap("SPACE_CONFIG_READ_FAILED", () => storage.getHomeTheme()),
    updateSpaceConfig: (input) => wrap("SPACE_CONFIG_UPDATE_FAILED", () => storage.saveHomeTheme(input)),
    resetSpaceConfig: () => wrap("SPACE_CONFIG_RESET_FAILED", () => storage.resetHomeTheme()),
    getPublicSpace: (userId) => wrap("PUBLIC_SPACE_NOT_FOUND", () => storage.getPublicSpace(userId))
  });

  const content = Object.freeze({
    list: (query) => wrap("CONTENT_LIST_FAILED", () => {
      const options = query || {};
      let cards = options.userId && (!storage.getCurrentUser() || storage.getCurrentUser().id !== options.userId)
        ? ((storage.getPublicSpace(options.userId) || {}).cards || [])
        : storage.getCards(options.moduleType);
      if (options.moduleType) cards = cards.filter((card) => card.moduleType === options.moduleType);
      if (options.status) cards = cards.filter((card) => card.status === options.status);
      return cards;
    }),
    get: (id) => wrap("CONTENT_NOT_FOUND", () => storage.getCard(id)),
    create: (input) => wrap("CONTENT_CREATE_FAILED", () => storage.saveCard(Object.assign({}, input, { id: input.id || "" }))),
    update: (input) => wrap("CONTENT_UPDATE_FAILED", () => storage.saveCard(input)),
    remove: (id) => wrap("CONTENT_DELETE_FAILED", () => storage.deleteCard(id))
  });

  const mediaService = Object.freeze({
    createId: () => media.createId(),
    createAssetsFromFile: (file, options) => media.createAssetsFromFile(file, options),
    createAssetsFromLegacy: (dataUrl, options) => media.createAssetsFromLegacy(dataUrl, options),
    save: (records) => wrapAsync("MEDIA_SAVE_FAILED", () => media.putMany(records)),
    get: (id) => wrapAsync("MEDIA_NOT_FOUND", () => media.get(id)),
    delete: (ids) => wrapAsync("MEDIA_DELETE_FAILED", () => media.deleteMany(ids)),
    deleteByContent: (contentId) => wrapAsync("MEDIA_DELETE_FAILED", () => media.deleteByCard(contentId)),
    variantBlob: (record, variant) => media.variantBlob(record, variant)
  });

  const interaction = Object.freeze({
    getAll: () => wrap("INTERACTION_READ_FAILED", () => storage.getInteractions()),
    toggleStar: (ownerId, contentId) => wrap("STAR_TOGGLE_FAILED", () => storage.toggleHeart(ownerId, contentId)),
    addResponse: (ownerId, contentId, text, parentId) => wrap("RESPONSE_CREATE_FAILED", () => storage.addReply(ownerId, contentId, text, parentId)),
    listResponses: (ownerId, contentId) => wrap("RESPONSE_LIST_FAILED", () => storage.getInteractions().replies.filter((item) => item.ownerId === ownerId && item.cardId === contentId)),
    followUser: (ownerId) => wrap("FOLLOW_FAILED", () => {
      const data = storage.getInteractions();
      const actor = storage.getCurrentUser();
      const exists = actor && data.follows.some((item) => item.ownerId === ownerId && item.actorId === actor.id);
      return exists ? true : storage.toggleFollow(ownerId);
    }),
    unfollowUser: (ownerId) => wrap("UNFOLLOW_FAILED", () => {
      const data = storage.getInteractions();
      const actor = storage.getCurrentUser();
      const exists = actor && data.follows.some((item) => item.ownerId === ownerId && item.actorId === actor.id);
      return exists ? !storage.toggleFollow(ownerId) : false;
    }),
    toggleFollow: (ownerId) => wrap("FOLLOW_TOGGLE_FAILED", () => storage.toggleFollow(ownerId))
  });

  const notification = Object.freeze({
    list: () => wrap("NOTIFICATION_LIST_FAILED", () => storage.getNotifications()),
    markRead: () => wrap("NOTIFICATION_READ_FAILED", () => storage.markNotificationsRead()),
    getUnreadCount: () => wrap("NOTIFICATION_COUNT_FAILED", () => storage.getNotifications().filter((item) => !item.read).length)
  });

  const legacy = Object.freeze({
    getUsers: (...args) => unwrap(auth.listUsers(...args)),
    getCurrentUser: (...args) => unwrap(auth.getCurrentUser(...args)),
    getUser: (...args) => unwrap(auth.getUser(...args)),
    register: (...args) => unwrap(auth.register(...args)),
    login: (...args) => unwrap(auth.login(...args)),
    logout: (...args) => unwrap(auth.logout(...args)),
    requireUser: (...args) => unwrap(auth.requireUser(...args)),
    getHomeTheme: (...args) => unwrap(profile.getSpaceConfig(...args)),
    saveHomeTheme: (...args) => unwrap(profile.updateSpaceConfig(...args)),
    resetHomeTheme: (...args) => unwrap(profile.resetSpaceConfig(...args)),
    getProfile: (...args) => unwrap(profile.get(...args)),
    saveProfile: (...args) => unwrap(profile.update(...args)),
    getCards: (moduleType) => unwrap(content.list({ moduleType })),
    getCard: (...args) => unwrap(content.get(...args)),
    saveCard: (input) => unwrap(input && input.id ? content.update(input) : content.create(input)),
    deleteCard: (...args) => unwrap(content.remove(...args)),
    getPublicSpace: (...args) => unwrap(profile.getPublicSpace(...args)),
    getInteractions: (...args) => unwrap(interaction.getAll(...args)),
    toggleHeart: (...args) => unwrap(interaction.toggleStar(...args)),
    addReply: (...args) => unwrap(interaction.addResponse(...args)),
    toggleFollow: (...args) => unwrap(interaction.toggleFollow(...args)),
    getNotifications: (...args) => unwrap(notification.list(...args)),
    markNotificationsRead: (...args) => unwrap(notification.markRead(...args))
  });

  const mediaLegacy = Object.freeze({
    createId: (...args) => mediaService.createId(...args),
    createAssetsFromFile: (...args) => mediaService.createAssetsFromFile(...args),
    createAssetsFromLegacy: (...args) => mediaService.createAssetsFromLegacy(...args),
    putMany: async (...args) => unwrap(await mediaService.save(...args)),
    get: async (...args) => unwrap(await mediaService.get(...args)),
    deleteMany: async (...args) => unwrap(await mediaService.delete(...args)),
    deleteByCard: async (...args) => unwrap(await mediaService.deleteByContent(...args)),
    variantBlob: (...args) => mediaService.variantBlob(...args)
  });

  window.DataService = Object.freeze({
    adapterId: adapter.id,
    auth,
    profile,
    content,
    media: mediaService,
    interaction,
    notification,
    preferences: adapter.preferences,
    backupAdapter: adapter,
    legacy,
    mediaLegacy,
    ok,
    fail,
    unwrap
  });
})();
