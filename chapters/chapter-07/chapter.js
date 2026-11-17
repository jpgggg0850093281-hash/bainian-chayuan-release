(() => {
  const key = "bainian-chapter-07";
  const status = document.querySelector("#chapter-status");
  const complete = document.querySelector("#complete-chapter");

  try {
    if (localStorage.getItem(key) === "done") status.textContent = "已完成";
  } catch {
    // Storage can be unavailable when opening a local file.
  }

  complete.addEventListener("click", () => {
    try {
      localStorage.setItem(key, "done");
      status.textContent = "已完成";
    } catch {
      status.textContent = "瀏覽器無法寫入進度，請檢查本機儲存權限。";
    }
  });
})();
