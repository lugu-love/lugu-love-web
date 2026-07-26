(function () {
  "use strict";
  let mode = "login";
  const $ = (selector) => document.querySelector(selector);
  const returnTo = new URLSearchParams(location.search).get("returnTo") || "index.html";

  function setMode(next) {
    mode = next;
    document.querySelectorAll("[data-auth-mode]").forEach((button) => {
      button.classList.toggle("active", button.dataset.authMode === mode);
    });
    $(".auth-nickname").hidden = mode !== "register";
    $("#authSubmit").textContent = mode === "register" ? "注册并创建空间" : "登录并进入空间";
    $("#authMessage").textContent = "";
  }

  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.authMode));
  });

  $("#sendCode").addEventListener("click", () => {
    const phone = $("#authPhone").value.replace(/\D/g, "");
    if (!/^1\d{10}$/.test(phone)) {
      $("#authMessage").textContent = "请先输入正确的手机号";
      return;
    }
    $("#authCode").value = "123456";
    $("#authMessage").textContent = "验证码已发送";
  });

  $("#authForm").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      if ($("#authCode").value.trim() !== "123456") throw new Error("验证码不正确");
      if (mode === "register") window.DataService.legacy.register($("#authPhone").value, $("#authNickname").value);
      else window.DataService.legacy.login($("#authPhone").value);
      location.href = returnTo;
    } catch (error) {
      $("#authMessage").textContent = error.message;
    }
  });

  $("#demoLogin").addEventListener("click", () => {
    window.DataService.legacy.login("13800000000");
    location.href = returnTo;
  });
})();
