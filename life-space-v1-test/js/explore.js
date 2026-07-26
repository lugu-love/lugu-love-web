(function () {
  "use strict";
  const current = window.DataService.legacy.getCurrentUser();
  const interactions = window.DataService.legacy.getInteractions();
  const users = window.DataService.legacy.getUsers().filter((user) => !current || user.id !== current.id);
  const container = document.querySelector("#spaceDirectory");

  function render() {
    container.innerHTML = users.length ? users.map((user) => {
      const space = window.DataService.legacy.getPublicSpace(user.id);
      const profile = space.profile;
      const followed = Boolean(current && interactions.follows.some((item) => item.ownerId === user.id && item.actorId === current.id));
      const avatar = profile.avatar ? `<img src="${profile.avatar}" alt="">` : (profile.nickname || user.nickname).slice(0, 1);
      return `<article class="space-card"><div class="space-avatar">${avatar}</div><div class="space-copy"><h2>${profile.nickname || user.nickname}</h2><p>${profile.bio || "记录生活，也记录成为自己的过程。"}</p><span class="space-id">${user.id}</span></div><div class="space-actions"><a href="index.html?mode=visitor&id=${encodeURIComponent(user.id)}">进入空间</a><button class="${followed ? "active" : ""}" type="button" data-follow="${user.id}">${followed ? "已关注" : "关注"}</button></div></article>`;
    }).join("") : '<div class="empty-social"><span>🌍</span><h2>展馆正在等待新朋友</h2><p>注册第二个账号后，就可以从这里进入彼此的空间。</p></div>';
  }

  container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-follow]");
    if (!button) return;
    if (!current) {
      location.href = `auth.html?returnTo=${encodeURIComponent("explore.html")}`;
      return;
    }
    try {
      const active = window.DataService.legacy.toggleFollow(button.dataset.follow);
      button.classList.toggle("active", active);
      button.textContent = active ? "已关注" : "关注";
    } catch (error) {
      const notice = document.querySelector("#notice");
      notice.textContent = error.message;
      notice.classList.add("show");
      setTimeout(() => notice.classList.remove("show"), 2200);
    }
  });
  render();
})();
