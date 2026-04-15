/**
 * ぽいナビ 自作アラート/確認モーダル
 * システムの alert/confirm の代替
 */
(function() {
  "use strict";

  function getModal() {
    return document.getElementById("poinaviAlertModal");
  }

  function getMessageEl() {
    return document.getElementById("poinaviAlertMessage");
  }

  function getOkBtn() {
    return document.getElementById("poinaviAlertOk");
  }

  function getCancelBtn() {
    return document.getElementById("poinaviAlertCancel");
  }

  function hideModal() {
    const modal = getModal();
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
    }
  }

  // alert 代替（第2引数 onClose: OKクリック時に呼ぶコールバック）
  window.poinaviAlert = function(message, onClose) {
    const modal = getModal();
    const messageEl = getMessageEl();
    const okBtn = getOkBtn();
    const cancelBtn = getCancelBtn();
    if (!modal || !messageEl || !okBtn) return;

    messageEl.textContent = message;
    if (cancelBtn) cancelBtn.style.display = "none";
    okBtn.textContent = "OK";
    okBtn.onclick = function() {
      hideModal();
      if (typeof onClose === "function") onClose();
    };
    modal.classList.remove("hidden");
    modal.style.display = "flex";
  };

  // confirm 代替（Promiseを返す）
  window.poinaviConfirm = function(message) {
    return new Promise(function(resolve) {
      const modal = getModal();
      const messageEl = getMessageEl();
      const okBtn = getOkBtn();
      const cancelBtn = getCancelBtn();
      if (!modal || !messageEl || !okBtn || !cancelBtn) {
        resolve(false);
        return;
      }

      messageEl.textContent = message;
      cancelBtn.style.display = "inline-block";
      okBtn.textContent = "OK";

      function close(result) {
        hideModal();
        cancelBtn.style.display = "none";
        okBtn.onclick = null;
        cancelBtn.onclick = null;
        resolve(result);
      }

      okBtn.onclick = function() { close(true); };
      cancelBtn.onclick = function() { close(false); };

      modal.classList.remove("hidden");
      modal.style.display = "flex";
    });
  };

  window.hidePoinaviAlert = hideModal;

  // オーバーレイクリックで閉じる（alert時のみ、confirm時はキャンセル扱い）
  document.addEventListener("DOMContentLoaded", function() {
    const modal = getModal();
    if (!modal) return;

    const overlay = modal.querySelector(".poinavi-alert-modal__overlay");
    if (overlay) {
      overlay.addEventListener("click", function() {
        const cancelBtn = getCancelBtn();
        if (cancelBtn && cancelBtn.style.display !== "none") {
          cancelBtn.click();
        } else {
          getOkBtn()?.click();
        }
      });
    }

    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) {
        const cancelBtn = getCancelBtn();
        if (cancelBtn && cancelBtn.style.display !== "none") {
          cancelBtn.click();
        } else {
          getOkBtn()?.click();
        }
      }
    });
  });
})();
