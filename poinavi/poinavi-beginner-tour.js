/**
 * ぽいナビ 初心者ツアー
 * 画面内の項目をステップ式で説明するオーバーレイ
 */
(function() {
  "use strict";
  var STORAGE_KEY = "poinavi_show_beginner_icon";

  window.PoinaviBeginner = {
    /** 初心者アイコンを表示すべきか（研究室設定で非表示にできる） */
    shouldShowIcon: function() {
      var v = localStorage.getItem(STORAGE_KEY);
      return v !== "0"; // 未設定または "1" = 表示
    },

    /** 初心者アイコンの表示設定を保存 */
    setShowIcon: function(show) {
      localStorage.setItem(STORAGE_KEY, show ? "1" : "0");
    },

    /** ツアーを開始 */
    startTour: function(steps) {
      if (!steps || steps.length === 0) return;
      var overlay = document.createElement("div");
      overlay.className = "beginner-tour-overlay";
      overlay.id = "beginnerTourOverlay";
      overlay.innerHTML = [
        '<div class="beginner-tour__spotlight" id="beginnerTourSpotlight"></div>',
        '<div class="beginner-tour__card" id="beginnerTourCard">',
        '  <button type="button" id="beginnerTourClose" class="beginner-tour__close" aria-label="閉じる"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>',
        '  <div class="beginner-tour__step">STEP <span id="beginnerTourStepNum">1</span> / ' + steps.length + '</div>',
        '  <p class="beginner-tour__text" id="beginnerTourText"></p>',
        '  <div class="beginner-tour__actions">',
        '    <button type="button" id="beginnerTourPrev" class="beginner-tour__btn">戻る</button>',
        '    <button type="button" id="beginnerTourNext" class="beginner-tour__btn beginner-tour__btn--primary">次へ</button>',
        '  </div>',
        '</div>'
      ].join("");
      document.body.appendChild(overlay);
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          overlay.classList.add("beginner-tour-overlay--visible");
        });
      });

      var idx = 0;
      var prevBtn = document.getElementById("beginnerTourPrev");
      var nextBtn = document.getElementById("beginnerTourNext");
      var closeBtn = document.getElementById("beginnerTourClose");
      var stepNum = document.getElementById("beginnerTourStepNum");
      var textEl = document.getElementById("beginnerTourText");
      var spotlight = document.getElementById("beginnerTourSpotlight");
      var card = document.getElementById("beginnerTourCard");
      var resizeTimer;
      var scrollHandler = function() { updateSpotlight(); };
      var resizeHandler = function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(updateSpotlight, 100);
      };

      function updateSpotlight() {
        var s = steps[idx];
        var target = s && s.selector && document.querySelector(s.selector);
        if (!target) {
          spotlight.style.display = "none";
          overlay.dataset.cardPosition = "bottom";
          return;
        }
        var rect = target.getBoundingClientRect();
        var pad = 8;
        spotlight.style.display = "block";
        spotlight.style.top = (rect.top - pad) + "px";
        spotlight.style.left = (rect.left - pad) + "px";
        spotlight.style.width = (rect.width + pad * 2) + "px";
        spotlight.style.height = (rect.height + pad * 2) + "px";
        updateCardPosition(rect);
      }

      function updateCardPosition(spotlightRect) {
        var vh = window.innerHeight;
        var cardHeight = 180;
        var padding = 40;
        var cardBottomArea = vh - cardHeight - padding;
        var spotlightBottom = spotlightRect.bottom + 16;
        if (spotlightBottom > cardBottomArea - 20) {
          overlay.dataset.cardPosition = "top";
        } else {
          overlay.dataset.cardPosition = "bottom";
        }
      }

      function showStep() {
        var s = steps[idx];
        stepNum.textContent = String(idx + 1);
        textEl.textContent = s.text || s;
        prevBtn.style.display = idx === 0 ? "none" : "";
        nextBtn.textContent = idx === steps.length - 1 ? "終了" : "次へ";

        // 先にスポットライト・カード位置を更新（レイアウト確定後にアニメーション）
        var target = s.selector && document.querySelector(s.selector);
        if (target) {
          updateSpotlight();
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(updateSpotlight, 480);
        } else {
          spotlight.style.display = "none";
          overlay.dataset.cardPosition = "bottom";
        }

        // ステップ切り替えごとにふわっと表示：クラスを外して新フレームで再適用（確実に再再生）
        card.classList.remove("beginner-tour__card--animate");
        spotlight.classList.remove("beginner-tour__spotlight--animate");
        void card.offsetWidth;
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            card.classList.add("beginner-tour__card--animate");
            spotlight.classList.add("beginner-tour__spotlight--animate");
          });
        });
      }

      function closeTour() {
        window.removeEventListener("scroll", scrollHandler, true);
        window.removeEventListener("resize", resizeHandler);
        overlay.remove();
      }

      overlay.addEventListener("click", function(e) {
        if (e.target === overlay || (e.target.id === "beginnerTourSpotlight")) {
          closeTour();
        }
      });

      card.addEventListener("click", function(e) { e.stopPropagation(); });

      prevBtn.addEventListener("click", function(e) {
        e.stopPropagation();
        if (idx > 0) { idx--; showStep(); }
      });
      nextBtn.addEventListener("click", function(e) {
        e.stopPropagation();
        if (idx < steps.length - 1) { idx++; showStep(); }
        else { closeTour(); }
      });
      closeBtn.addEventListener("click", function(e) {
        e.stopPropagation();
        closeTour();
      });

      window.addEventListener("scroll", scrollHandler, true);
      window.addEventListener("resize", resizeHandler);

      showStep();
    }
  };
})();
