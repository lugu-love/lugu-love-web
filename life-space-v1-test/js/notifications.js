(function () {
  "use strict";
  if (!window.DataService.legacy.requireUser("notifications.html")) return;
  const list = window.DataService.legacy.getNotifications();
  const container = document.querySelector("#notificationList");
  const icons = { heart: "✦", reply: "↩", follow: "＋" };
  container.innerHTML = list.length ? list.map((item) => {
    const actor = window.DataService.legacy.getUser(item.actorId);
    const time = new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(item.createdAt));
    return `<article class="notification-item${item.read ? "" : " unread"}"><span class="notification-icon">${icons[item.type] || "•"}</span><div><strong>${actor ? actor.nickname : "一位朋友"}</strong><p>${item.message}</p><time>${time}</time></div></article>`;
  }).join("") : '<div class="empty-social"><span>✦</span><h2>还没有新通知</h2><p>当朋友点亮心星、回应或关注你时，这里会出现消息。</p></div>';
  window.DataService.legacy.markNotificationsRead();
})();
