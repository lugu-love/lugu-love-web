(function () {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const backup = window.LifeSpaceDataBackup;
  let pendingPayload = null;

  function showStatus(message, type) {
    $("#toolStatus").textContent = message;
    $("#toolStatus").dataset.type = type || "info";
  }

  function renderStatistics(statistics) {
    $("#statistics").hidden = false;
    $("#statistics").innerHTML = Object.entries({
      用户: statistics.users,
      内容: statistics.contents,
      媒体: statistics.mediaFiles,
      心星: statistics.stars,
      回应: statistics.responses,
      关注: statistics.follows,
      通知: statistics.notifications
    }).map(([label, value]) => `<div><strong>${value || 0}</strong><span>${label}</span></div>`).join("");
  }

  $("#exportData").addEventListener("click", async () => {
    showStatus("正在整理 localStorage 与 IndexedDB 数据…");
    try {
      const payload = await backup.createExportPayload();
      const file = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = backup.filename();
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      renderStatistics(payload.statistics);
      showStatus(`导出完成，文件大小约 ${(file.size / 1024 / 1024).toFixed(2)} MB。`, "success");
    } catch (error) {
      showStatus(error.message, "error");
    }
  });

  $("#importFile").addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    showStatus("正在检查备份文件…");
    try {
      pendingPayload = backup.validatePayload(JSON.parse(await file.text()));
      renderStatistics(pendingPayload.statistics || {});
      $("#importActions").hidden = false;
      $("#importSummary").textContent = `备份时间：${pendingPayload.exportedAt || "未知"}；来源：${pendingPayload.sourceOrigin || "未知"}。请选择覆盖或合并。`;
      showStatus("文件检查通过，尚未写入任何数据。", "success");
    } catch (error) {
      pendingPayload = null;
      $("#importActions").hidden = true;
      showStatus(`无法导入：${error.message}`, "error");
    }
  });

  async function restore(mode) {
    if (!pendingPayload) return;
    const label = mode === "replace" ? "完全覆盖恢复" : "合并导入";
    if (!window.confirm(`${label}将写入当前项目数据。${mode === "replace" ? "现有 life-space-v1 数据会先被清空。" : "同 ID 数据会按更新时间合并。"}是否继续？`)) return;
    showStatus(`正在执行${label}…`);
    try {
      const statistics = await backup.restorePayload(pendingPayload, mode);
      renderStatistics(statistics);
      showStatus(`${label}完成，即将重新加载。`, "success");
      setTimeout(() => location.reload(), 700);
    } catch (error) {
      showStatus(`${label}失败：${error.message}`, "error");
    }
  }

  $("#replaceImport").addEventListener("click", () => restore("replace"));
  $("#mergeImport").addEventListener("click", () => restore("merge"));

  $("#clearData").addEventListener("click", async () => {
    const keys = window.DataService.backupAdapter.projectKeys();
    const first = window.confirm(`将删除 ${keys.length} 项 life-space-v1 localStorage 数据，以及 IndexedDB 中的全部项目媒体。不会删除其他项目信息。是否继续？`);
    if (!first) return;
    const second = window.confirm("这是最后确认：清空后只能通过已导出的备份文件恢复。确定清空吗？");
    if (!second) return;
    showStatus("正在清空项目数据…");
    try {
      await backup.clearProjectData();
      location.href = "auth.html";
    } catch (error) {
      showStatus(`清空失败：${error.message}`, "error");
    }
  });
})();
