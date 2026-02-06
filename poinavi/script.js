// ============================================
// ぽいナビ MVP - メインスクリプト
// ============================================

// グローバル変数
let map;
let userLocation = null;
let placesService;
let selectedTags = [];
let searchQuery = "";
let resultCount = 3;
let openOnly = false;
let markers = [];
let currentResults = [];
let infoWindow = null; // 情報ウィンドウ
let directionsService = null; // 経路検索サービス
let directionsRenderer = null; // 経路表示レンダラー
let currentLocationMarker = null; // 現在地マーカー
let geocoder = null; // ジオコーダー
let selectedMarkerIndex = null; // 選択中のマーカーのインデックス
let markerPulseInterval = null; // マーカー点滅用インターバル
let transportMode = "walk"; // 移動手段（walk, bicycle, car）

// RainViewer 関連
let rainViewerLayer = null; // RainViewer レイヤー
let rainViewerEnabled = false; // RainViewer 有効フラグ
let rainViewerLayerIndex = -1; // overlayMapTypes での位置

// 鉄道レイヤー関連
let railwayEnabled = false; // 鉄道レイヤー有効フラグ
let railwayPolylines = []; // 鉄道路線のポリライン
let stationMarkers = []; // 駅マーカー
let railwayInfoWindow = null; // 鉄道用InfoWindow
let railwayDataCache = null; // 鉄道データキャッシュ
let railwayCacheLocation = null; // キャッシュ時の位置
const RAILWAY_RADIUS = 8000; // 取得半径（8km）

// ============================================
// タグ管理
// ============================================
// デフォルトタグ（初期タグ）
const DEFAULT_TAGS = [
  { id: "restaurant", name: "レストラン", type: "restaurant" },
  { id: "cafe", name: "カフェ", type: "cafe" },
  { id: "convenience_store", name: "コンビニ", type: "convenience_store" },
  { id: "gas_station", name: "ガソリンスタンド", type: "gas_station" },
  { id: "parking", name: "駐車場", type: "parking" },
  { id: "pharmacy", name: "薬局", type: "pharmacy" },
  { id: "atm", name: "ATM", type: "atm" },
  { id: "hospital", name: "病院", type: "hospital" },
  { id: "train_station", name: "駅", type: "train_station" },
];

// カスタムタグ（ユーザーが追加したタグ）
let customTags = [];

// 削除されたデフォルトタグのID
let deletedDefaultTagIds = [];

// タグを読み込む
function loadTags() {
  // カスタムタグを読み込む
  const savedCustom = localStorage.getItem("poinavi_custom_tags");
  if (savedCustom) {
    try {
      customTags = JSON.parse(savedCustom);
    } catch (e) {
      console.warn("カスタムタグの読み込みに失敗しました:", e);
      customTags = [];
    }
  }
  
  // 削除されたデフォルトタグを読み込む
  const savedDeleted = localStorage.getItem("poinavi_deleted_default_tags");
  if (savedDeleted) {
    try {
      deletedDefaultTagIds = JSON.parse(savedDeleted);
    } catch (e) {
      console.warn("削除タグ情報の読み込みに失敗しました:", e);
      deletedDefaultTagIds = [];
    }
  }
}

// タグを保存する
function saveTags() {
  localStorage.setItem("poinavi_custom_tags", JSON.stringify(customTags));
  localStorage.setItem("poinavi_deleted_default_tags", JSON.stringify(deletedDefaultTagIds));
}

// 全タグを取得（削除されたデフォルトタグを除外）
function getAllTags() {
  const activeDefaultTags = DEFAULT_TAGS.filter(tag => !deletedDefaultTagIds.includes(tag.id));
  return [...activeDefaultTags, ...customTags];
}

// タグを追加
function addTag(name) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return { success: false, message: "タグ名を入力してください" };
  }
  if (trimmedName.length > 20) {
    return { success: false, message: "タグ名は20文字以内にしてください" };
  }
  
  // 重複チェック
  const allTags = getAllTags();
  const exists = allTags.some(tag => tag.name === trimmedName);
  if (exists) {
    return { success: false, message: "同じ名前のタグが既に存在します" };
  }
  
  // カスタムタグとして追加（typeはテキスト検索で使用）
  const newTag = {
    id: `custom_${Date.now()}`,
    name: trimmedName,
    type: null, // カスタムタグはtypeを持たない（テキスト検索を使用）
    isCustom: true,
  };
  customTags.push(newTag);
  saveTags();
  
  return { success: true, tag: newTag };
}

// タグを削除
function deleteTag(tagId) {
  // デフォルトタグかどうかをチェック
  const isDefaultTag = DEFAULT_TAGS.some(tag => tag.id === tagId);
  
  if (isDefaultTag) {
    // デフォルトタグの場合は削除リストに追加
    if (!deletedDefaultTagIds.includes(tagId)) {
      deletedDefaultTagIds.push(tagId);
    }
  } else {
    // カスタムタグの場合は配列から削除
    const index = customTags.findIndex(tag => tag.id === tagId);
    if (index === -1) {
      return { success: false, message: "タグが見つかりません" };
    }
    customTags.splice(index, 1);
  }
  
  saveTags();
  
  // 選択中のタグだった場合は選択解除
  const tagIndex = selectedTags.indexOf(tagId);
  if (tagIndex !== -1) {
    selectedTags.splice(tagIndex, 1);
  }
  
  return { success: true };
}

// ============================================
// APIキャッシュ設定
// ============================================
const CACHE_EXPIRATION_MS = 15 * 60 * 1000; // 15分（ミリ秒）
const CACHE_LOCATION_THRESHOLD = 100; // 100m以上移動したらキャッシュ無効
let searchCache = {}; // 検索結果キャッシュ
let lastCachedLocation = null; // キャッシュ時の位置

// ============================================
// 初期化
// ============================================
document.addEventListener("DOMContentLoaded", function () {
  loadTags(); // タグを読み込む
  renderMainTagList(); // メインUIにタグを描画
  
  initSettingsToggle();
  initThemeToggle();
  initTagSelection();
  initSearchInput();
  initControls();
  initLocationModal();
  initSettingsModal();
  initTagManagement(); // タグ管理機能を初期化
  initStartPageSelect(); // 起動ページ設定を初期化
  // initRainViewer と initRailwayLayer は initGoogleMaps 内で呼び出し
  
  // Google Maps API が読み込まれるまで待つ
  // initGoogleMaps コールバックで initMap() と requestUserLocation() が呼ばれる
  if (typeof google !== "undefined" && typeof google.maps !== "undefined") {
    initMap();
    requestUserLocation();
  }
});

// ============================================
// 起動ページ設定
// ============================================
function initStartPageSelect() {
  const select = document.getElementById("mapStartPageSelect");
  if (!select) return;

  // 保存された値を読み込み
  const savedStartPage = localStorage.getItem("poinavi_start_page") || "index.html";
  select.value = savedStartPage;

  // 変更時に保存
  select.addEventListener("change", function() {
    localStorage.setItem("poinavi_start_page", this.value);
  });
}

// ============================================
// タグUI描画
// ============================================

// メインUIのタグリストを描画
function renderMainTagList() {
  const tagList = document.getElementById("tagList");
  if (!tagList) return;
  
  tagList.innerHTML = "";
  const allTags = getAllTags();
  
  allTags.forEach(tag => {
    const btn = document.createElement("button");
    btn.className = "tag-btn";
    btn.dataset.tag = tag.id;
    btn.dataset.type = tag.type || "";
    btn.textContent = tag.name;
    if (tag.isCustom) {
      btn.dataset.custom = "true";
    }
    tagList.appendChild(btn);
  });
  
  // タグ選択イベントは initTagSelection で一度だけ設定（イベント委譲）
}

// 設定モーダルのタグ管理リストを描画
function renderTagManageList() {
  const tagManageList = document.getElementById("tagManageList");
  if (!tagManageList) return;
  
  tagManageList.innerHTML = "";
  const allTags = getAllTags();
  
  if (allTags.length === 0) {
    tagManageList.innerHTML = '<div class="tag-manage-empty">タグがありません</div>';
    return;
  }
  
  allTags.forEach(tag => {
    const item = document.createElement("div");
    item.className = "tag-manage-item";
    if (tag.isCustom) {
      item.classList.add("tag-manage-item--custom");
    }
    
    const nameSpan = document.createElement("span");
    nameSpan.className = "tag-manage-item__name";
    nameSpan.textContent = tag.name;
    nameSpan.title = tag.name;
    item.appendChild(nameSpan);
    
    // 全てのタグに削除ボタンを表示
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "tag-manage-item__delete";
    deleteBtn.title = "削除";
    deleteBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    deleteBtn.addEventListener("click", function() {
      handleDeleteTag(tag.id, tag.name);
    });
    item.appendChild(deleteBtn);
    
    tagManageList.appendChild(item);
  });
}

// タグ管理機能の初期化
function initTagManagement() {
  const addButton = document.getElementById("addTagButton");
  const newTagInput = document.getElementById("newTagInput");
  
  if (!addButton || !newTagInput) return;
  
  // 追加ボタンクリック
  addButton.addEventListener("click", function() {
    handleAddTag();
  });
  
  // Enterキーで追加（keydownとkeypressの両方で対応）
  newTagInput.addEventListener("keydown", function(e) {
    if (e.key === "Enter" || e.keyCode === 13) {
      e.preventDefault();
      newTagInput.blur(); // キーボードを閉じる
      handleAddTag();
    }
  });
  
  newTagInput.addEventListener("keypress", function(e) {
    if (e.key === "Enter" || e.keyCode === 13) {
      e.preventDefault();
      newTagInput.blur(); // キーボードを閉じる
      handleAddTag();
    }
  });
  
  // 初期描画
  renderTagManageList();
}

// タグ追加処理
function handleAddTag() {
  const input = document.getElementById("newTagInput");
  if (!input) return;
  
  const result = addTag(input.value);
  
  if (result.success) {
    input.value = "";
    // キーボードを閉じる（Android対応）
    input.blur();
    // 少し遅延してから再度blur（Androidで確実に閉じるため）
    setTimeout(function() {
      if (document.activeElement === input) {
        input.blur();
      }
    }, 100);
    renderMainTagList(); // メインUIを更新
    renderTagManageList(); // 設定モーダルを更新
  } else {
    alert(result.message);
  }
}

// タグ削除処理
function handleDeleteTag(tagId, tagName) {
  if (!confirm(`「${tagName}」を削除しますか？`)) {
    return;
  }
  
  const result = deleteTag(tagId);
  
  if (result.success) {
    renderMainTagList(); // メインUIを更新
    renderTagManageList(); // 設定モーダルを更新
  } else {
    alert(result.message);
  }
}

// ============================================
// 設定バーの開閉
// ============================================
function initSettingsToggle() {
  const settingsBar = document.querySelector(".settings-bar");
  const settingsToggle = document.getElementById("settingsToggle");
  const settingsContent = document.getElementById("settingsContent");
  
  if (!settingsBar || !settingsToggle || !settingsContent) {
    console.warn("設定バーの要素が見つかりません");
    return;
  }
  
  // 初期表示時は必ず開いた状態にする（localStorageの状態に関係なく）
  settingsBar.classList.remove("collapsed");
  
  settingsToggle.addEventListener("click", function() {
    settingsBar.classList.toggle("collapsed");
    const isNowCollapsed = settingsBar.classList.contains("collapsed");
    localStorage.setItem("settingsBarCollapsed", isNowCollapsed.toString());
  });
}

// ============================================
// ライト／ダークモード切替
// ============================================
function initThemeToggle() {
  const themeToggle = document.getElementById("themeToggle");
  const themeIcon = themeToggle.querySelector(".theme-icon");
  const themeText = themeToggle.querySelector(".theme-text");

  // 保存されたテーマを読み込み
  const savedTheme = localStorage.getItem("poinavi_theme") || "light";
  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
    themeIcon.textContent = "🌙";
    themeText.textContent = "ダークモード";
  } else {
    themeIcon.textContent = "☀️";
    themeText.textContent = "ライトモード";
  }

  themeToggle.addEventListener("click", function () {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    // htmlタグのクラスも更新（FOUC対策との整合性）
    if (isDark) {
      document.documentElement.classList.remove("light-mode");
      document.documentElement.classList.add("dark-mode");
    } else {
      document.documentElement.classList.remove("dark-mode");
      document.documentElement.classList.add("light-mode");
    }
    localStorage.setItem("poinavi_theme", isDark ? "dark" : "light");
    themeIcon.textContent = isDark ? "🌙" : "☀️";
    themeText.textContent = isDark ? "ダークモード" : "ライトモード";
    
    // 地図のテーマも更新
    applyMapTheme();
    
    // 経路が表示されている場合は、経路線の色も更新
    if (directionsRenderer) {
      const directions = directionsRenderer.getDirections();
      if (directions && directions.routes && directions.routes.length > 0) {
        // 赤丸の配色を取得（50%透過）
        const markerColor = isDark ? "#ff0080" : "#ff1744";
        
        // 経路線のスタイルを更新
        directionsRenderer.setOptions({
          polylineOptions: {
            strokeColor: markerColor,
            strokeOpacity: 0.5,
            strokeWeight: 5
          }
        });
        
        // 経路を再表示（色を更新するため）
        directionsRenderer.setDirections(directions);
      }
    }
    
    // InfoWindowが開いている場合は閉じて再表示
    if (infoWindow) {
      // 開いているマーカーを探す
      let currentMarker = null;
      let currentPlace = null;
      
      markers.forEach((marker, index) => {
        if (marker.infoPlace) {
          currentMarker = marker;
          currentPlace = marker.infoPlace;
        }
      });
      
      if (currentPlace && currentMarker) {
        infoWindow.close();
        
        // 少し遅延させてから再表示（スタイルが適用されるのを待つ）
        setTimeout(() => {
          showInfoWindow(currentPlace, currentMarker);
        }, 150);
      } else {
        infoWindow.close();
      }
    }
    
    // マーカーの色も更新（既存のマーカーを再描画）
    // テーマ切り替え時は自動ズームを実行しない
    if (currentResults && currentResults.length > 0) {
      displayMarkers(currentResults, true);
    }
  });
}

// ライトモード用の地図スタイル（POIを控えめに）
const lightMapStyle = [
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#999999" }], // 控えめなグレー
  },
  {
    featureType: "poi",
    elementType: "labels.icon",
    stylers: [{ saturation: -80 }, { lightness: 50 }], // アイコンを控えめに
  },
  {
    featureType: "poi.business",
    elementType: "labels.text.fill",
    stylers: [{ color: "#999999" }], // ビジネスPOIも控えめに
  },
  {
    featureType: "poi.business",
    elementType: "labels.icon",
    stylers: [{ saturation: -80 }, { lightness: 50 }], // ビジネスアイコンも控えめに
  },
];

// 地図のテーマを適用
function applyMapTheme() {
  if (!map) return;
  
  // bodyまたはhtmlのどちらかにdark-modeクラスがあればダークモード
  const isDark = document.body.classList.contains("dark-mode") || 
                 document.documentElement.classList.contains("dark-mode");
  if (isDark) {
    map.setMapTypeId("dark_mode");
  } else {
    // ライトモード用のスタイルを適用
    if (!map.mapTypes.get("light_mode")) {
      const lightMapType = new google.maps.StyledMapType(lightMapStyle, {
        name: "ライトモード",
      });
      map.mapTypes.set("light_mode", lightMapType);
    }
    map.setMapTypeId("light_mode");
  }
}

// ============================================
// タグ選択（単一選択）
// ============================================
// タグ選択のイベント委譲（一度だけ設定）
let tagSelectionInitialized = false;

function initTagSelection() {
  // 既に初期化済みの場合はスキップ（イベント委譲を使用するため）
  if (tagSelectionInitialized) return;
  tagSelectionInitialized = true;
  
  const tagList = document.getElementById("tagList");
  if (!tagList) return;
  
  // タップ処理用の変数
  let lastProcessedTime = 0;
  let touchStartTarget = null;
  let isProcessing = false;
  
  // タグボタンのタップ処理（共通関数）
  function handleTagTap(btn) {
    if (isProcessing) return;
    
    const now = Date.now();
    
    // 500ms以内の連続タップは無視（ダブルタップ防止）
    if (now - lastProcessedTime < 500) {
      return;
    }
    
    isProcessing = true;
    lastProcessedTime = now;
    
    // 既に選択されている場合は選択解除
    const wasActive = btn.classList.contains("active");
    
    if (wasActive) {
      btn.classList.remove("active");
    } else {
      // 他のタグの選択を解除
      const allTagButtons = tagList.querySelectorAll(".tag-btn");
      allTagButtons.forEach((otherBtn) => {
        otherBtn.classList.remove("active");
      });
      // このタグを選択
      btn.classList.add("active");
    }
    
    // タグを選択した場合、検索フィルタをクリア
    if (!wasActive) {
      const searchInput = document.getElementById("searchInput");
      if (searchInput) {
        searchInput.value = "";
        searchQuery = "";
      }
    }
    
    updateSelectedTags();
    searchPlaces();
    
    // 処理完了後にフラグをリセット
    setTimeout(() => {
      isProcessing = false;
    }, 100);
  }
  
  // タッチ開始時にターゲットを記録
  tagList.addEventListener("touchstart", function(event) {
    const btn = event.target.closest(".tag-btn");
    if (btn) {
      touchStartTarget = btn;
    }
  }, { passive: true });
  
  // タッチ終了時に処理
  tagList.addEventListener("touchend", function(event) {
    const btn = event.target.closest(".tag-btn");
    if (!btn || btn !== touchStartTarget) {
      touchStartTarget = null;
      return;
    }
    
    event.preventDefault();
    event.stopPropagation();
    
    touchStartTarget = null;
    handleTagTap(btn);
  }, { passive: false });
  
  // マウスクリック（PC用フォールバック）
  tagList.addEventListener("click", function(event) {
    // タッチデバイスの場合はtouchendで処理済みなのでスキップ
    if (event.sourceCapabilities && event.sourceCapabilities.firesTouchEvents) {
      return;
    }
    
    const btn = event.target.closest(".tag-btn");
    if (!btn) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    handleTagTap(btn);
  });
}

function updateSelectedTags() {
  // 単一選択なので、最初の1つだけ取得
  const activeTag = document.querySelector(".tag-btn.active");
  selectedTags = activeTag ? [activeTag.dataset.tag] : [];
}

// ============================================
// 検索入力と検索ボタン
// ============================================
function initSearchInput() {
  const searchInput = document.getElementById("searchInput");
  const searchButton = document.getElementById("searchButton");
  
  if (!searchInput || !searchButton) {
    console.warn("検索入力または検索ボタンが見つかりません");
    return;
  }

  // 検索ボタンクリックで検索
  searchButton.addEventListener("click", function () {
    performSearch();
  });

  // Enterキーで検索（keydownを使用してAndroidでも動作するように）
  searchInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.keyCode === 13) {
      e.preventDefault();
      searchInput.blur(); // キーボードを閉じる
      performSearch();
    }
  });

  // IME確定時の検索対応（Android日本語入力用）
  searchInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter" || e.keyCode === 13) {
      e.preventDefault();
      searchInput.blur(); // キーボードを閉じる
      performSearch();
    }
  });
}

// 検索実行
function performSearch() {
  const searchInput = document.getElementById("searchInput");
  const inputValue = searchInput.value.trim();
  
  // 検索を入力した場合、タグを解除
  if (inputValue.length > 0) {
    clearSelectedTags();
  }
  
  // 視点を現在地に戻す
  resetMapToCurrentLocation();
  
  searchQuery = inputValue;
  searchPlaces();
}

// マップの視点を現在地に戻す
function resetMapToCurrentLocation() {
  if (map && userLocation) {
    map.setCenter(userLocation);
    map.setZoom(15);
  } else if (map) {
    // 現在地が取得できていない場合はデフォルト位置に戻す
    const defaultLocation = { lat: 35.6812, lng: 139.7671 };
    map.setCenter(defaultLocation);
    map.setZoom(15);
  }
}

// タグ選択を解除
function clearSelectedTags() {
  const tagButtons = document.querySelectorAll(".tag-btn");
  tagButtons.forEach((btn) => {
    btn.classList.remove("active");
  });
  updateSelectedTags();
}

// ============================================
// コントロール（表示件数・営業中のみ）
// ============================================
function initControls() {
  const resultCountSelect = document.getElementById("resultCount");
  const openOnlyCheckbox = document.getElementById("openOnly");

  resultCountSelect.addEventListener("change", function () {
    resultCount = parseInt(this.value, 10);
    searchPlaces();
  });

  openOnlyCheckbox.addEventListener("change", function () {
    openOnly = this.checked;
    searchPlaces();
  });
}

// ============================================
// Google Maps API の初期化コールバック
// ============================================
window.initGoogleMaps = function() {
  console.log("Google Maps API が正常に読み込まれました");
  initMap();
  requestUserLocation();
  // Google Maps初期化後にレイヤー機能を有効化
  initRainViewer();
  initRailwayLayer();
};

// ============================================
// マップ初期化
// ============================================
// ダークモード用の地図スタイル
const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b6b6b" }], // 控えめなグレー
  },
  {
    featureType: "poi",
    elementType: "labels.icon",
    stylers: [
      { saturation: -80 }, 
      { lightness: -10 }, // アイコンを少し暗く（枠も含む）
      { gamma: 0.8 } // ガンマ値を少し下げて控えめに
    ],
  },
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [
      { visibility: "on" },
      { lightness: -15 } // ラベル全体（枠を含む）を少し暗く
    ],
  },
  {
    featureType: "poi.business",
    elementType: "labels.icon",
    stylers: [
      { saturation: -80 }, 
      { lightness: -10 }, // ビジネスアイコンを少し暗く（枠も含む）
      { gamma: 0.8 } // ガンマ値を少し下げて控えめに
    ],
  },
  {
    featureType: "poi.business",
    elementType: "labels",
    stylers: [
      { visibility: "on" },
      { lightness: -15 } // ラベル全体（枠を含む）を少し暗く
    ],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#263c3f" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b9a76" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#38414e" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#212a37" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca5b3" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#746855" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1f2835" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f3d19c" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#2f3948" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#17263c" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#515c6d" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#17263c" }],
  },
];

function initMap() {
  // Google Maps API が読み込まれているかチェック
  if (typeof google === "undefined" || typeof google.maps === "undefined") {
    console.error("Google Maps API が読み込まれていません");
    return;
  }

  // デフォルト位置（東京駅）
  const defaultLocation = { lat: 35.6812, lng: 139.7671 };

  try {
    map = new google.maps.Map(document.getElementById("map"), {
      center: defaultLocation,
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    // ダークモード用のスタイルを追加
    const darkMapType = new google.maps.StyledMapType(darkMapStyle, {
      name: "ダークモード",
    });
    map.mapTypes.set("dark_mode", darkMapType);

    // ライトモード用のスタイルを追加
    const lightMapType = new google.maps.StyledMapType(lightMapStyle, {
      name: "ライトモード",
    });
    map.mapTypes.set("light_mode", lightMapType);

    // 初期テーマに応じてスタイルを適用
    applyMapTheme();

    placesService = new google.maps.places.PlacesService(map);
    
    // 経路検索サービスとレンダラーを初期化
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
      map: map,
      suppressMarkers: true, // デフォルトのマーカーを非表示（既存のマーカーを使用）
      preserveViewport: false // 経路に合わせてビューを調整
    });

    // Geocoder を初期化
    geocoder = new google.maps.Geocoder();
    
    // 地図クリックでマーカー選択を解除
    map.addListener("click", function() {
      // InfoWindowを閉じる
      if (infoWindow) {
        infoWindow.close();
      }
      // マーカー選択を解除
      clearMarkerSelection();
      // リストのアクティブ状態も解除
      const resultItems = document.querySelectorAll(".result-item");
      resultItems.forEach((item) => {
        item.classList.remove("active");
      });
    });
    
    // グローバル関数として経路表示関数を登録（InfoWindow内のボタンから呼び出せるように）
    window.showRouteOnMap = function(originLat, originLng, destLat, destLng) {
      console.log("showRouteOnMap呼び出し:", { originLat, originLng, destLat, destLng });
      if (!originLat || !originLng || !destLat || !destLng) {
        console.warn("経路表示に必要な座標が不足しています", { originLat, originLng, destLat, destLng });
        return;
      }
      const origin = { lat: parseFloat(originLat), lng: parseFloat(originLng) };
      const destination = { lat: parseFloat(destLat), lng: parseFloat(destLng) };
      console.log("経路表示開始:", { origin, destination });
      displayRoute(origin, destination);
    };
    
    // グローバル関数としてメモ追加関数を登録（InfoWindow内のボタンから呼び出せるように）
    window.addPlaceToMemo = function(encodedName, encodedAddress, distance) {
      const MEMO_STORAGE_KEY = "poinavi_memos";
      const MEMO_MAX_COUNT = 50;
      
      const name = decodeURIComponent(encodedName);
      const address = decodeURIComponent(encodedAddress);
      
      // メモを取得
      let memos = [];
      try {
        const data = localStorage.getItem(MEMO_STORAGE_KEY);
        memos = data ? JSON.parse(data) : [];
      } catch (e) {
        console.error("メモの読み込みに失敗:", e);
        memos = [];
      }
      
      // 上限チェック
      if (memos.length >= MEMO_MAX_COUNT) {
        alert("上限（" + MEMO_MAX_COUNT + "件）に達しています。\n不要なメモを整理して再度追加してください。");
        return;
      }
      
      // メモの内容を作成
      const memoContent = `📍 ${name}\n${address}\n現在地からの距離: ${distance}`;
      
      const newMemo = {
        id: Date.now().toString(),
        content: memoContent,
        createdAt: new Date().toISOString()
      };
      memos.unshift(newMemo);
      
      // 保存
      try {
        localStorage.setItem(MEMO_STORAGE_KEY, JSON.stringify(memos));
        alert("メモに追加しました");
      } catch (e) {
        console.error("メモの保存に失敗:", e);
        alert("メモの保存に失敗しました。ストレージ容量を確認してください。");
      }
    };
    
    // グローバル関数として鉄道メモ追加関数を登録（InfoWindow内のボタンから呼び出せるように）
    window.addRailwayToMemo = function(encodedType, encodedContent) {
      const MEMO_STORAGE_KEY = "poinavi_memos";
      const MEMO_MAX_COUNT = 50;
      
      const type = decodeURIComponent(encodedType);
      const content = decodeURIComponent(encodedContent);
      
      // メモを取得
      let memos = [];
      try {
        const data = localStorage.getItem(MEMO_STORAGE_KEY);
        memos = data ? JSON.parse(data) : [];
      } catch (e) {
        console.error("メモの読み込みに失敗:", e);
        memos = [];
      }
      
      // 上限チェック
      if (memos.length >= MEMO_MAX_COUNT) {
        alert("上限（" + MEMO_MAX_COUNT + "件）に達しています。\n不要なメモを整理して再度追加してください。");
        return;
      }
      
      // メモの内容を作成
      const icon = type === "駅" ? "🚉" : "🚃";
      const memoContent = `${icon} [${type}]\n${content}`;
      
      const newMemo = {
        id: Date.now().toString(),
        content: memoContent,
        createdAt: new Date().toISOString()
      };
      memos.unshift(newMemo);
      
      // 保存
      try {
        localStorage.setItem(MEMO_STORAGE_KEY, JSON.stringify(memos));
        alert("メモに追加しました");
      } catch (e) {
        console.error("メモの保存に失敗:", e);
        alert("メモの保存に失敗しました。ストレージ容量を確認してください。");
      }
    };
  } catch (error) {
    console.error("マップの初期化に失敗しました:", error);
    const mapContainer = document.getElementById("map");
    if (mapContainer) {
      mapContainer.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 20px;
          text-align: center;
          background-color: #f5f5f5;
          color: #d32f2f;
        ">
          <div>
            <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">マップの初期化に失敗しました</div>
            <div style="font-size: 14px;">${error.message}</div>
          </div>
        </div>
      `;
    }
  }
}

// ============================================
// ローディング画面の表示/非表示
// ============================================
function showLoading() {
  // ローディング画面は削除済み - 何もしない
}

function hideLoading() {
  // ローディング画面は削除済み - 何もしない
}

// ============================================
// 現在地取得
// ============================================
const LOCATION_CACHE_KEY = "poinavi_cached_location";
const LOCATION_CACHE_DURATION = 10 * 60 * 1000; // 10分間キャッシュ

function requestUserLocation() {
  console.log("requestUserLocation 開始");
  
  // セッションストレージからキャッシュを確認
  const cachedData = sessionStorage.getItem(LOCATION_CACHE_KEY);
  if (cachedData) {
    try {
      const cached = JSON.parse(cachedData);
      const now = Date.now();
      
      // キャッシュが有効期限内かチェック
      if (cached.timestamp && (now - cached.timestamp) < LOCATION_CACHE_DURATION) {
        // キャッシュされた位置情報を使用
        console.log("キャッシュから位置情報を使用");
        applyUserLocation(cached.lat, cached.lng);
        return;
      }
    } catch (e) {
      // キャッシュのパースに失敗した場合は無視
      console.warn("キャッシュパース失敗:", e);
    }
  }
  
  // キャッシュがない場合は新たに取得
  fetchUserLocation(null);
}

function fetchUserLocation(safetyTimeout) {
  if (navigator.geolocation) {
    // タイムアウト設定（10秒）
    const geolocationOptions = {
      enableHighAccuracy: false, // 高精度モードをオフにして高速化
      timeout: 10000, // 10秒でタイムアウト
      maximumAge: 300000 // 5分以内のキャッシュを使用
    };
    
    console.log("位置情報を取得中...");
    
    navigator.geolocation.getCurrentPosition(
      function (position) {
        if (safetyTimeout) clearTimeout(safetyTimeout);
        
        console.log("位置情報取得成功");
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        // セッションストレージにキャッシュ
        const cacheData = {
          lat: lat,
          lng: lng,
          timestamp: Date.now()
        };
        sessionStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(cacheData));
        
        // 位置情報を適用
        try {
          applyUserLocation(lat, lng);
        } catch (e) {
          console.error("位置情報の適用に失敗:", e);
        }
      },
      function (error) {
        if (safetyTimeout) clearTimeout(safetyTimeout);
        
        console.warn("位置情報の取得に失敗しました:", error);
        // エラーコードに応じたメッセージ
        let errorMessage = "位置情報を取得できませんでした";
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "位置情報の使用が許可されていません";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "位置情報を取得できませんでした";
            break;
          case error.TIMEOUT:
            errorMessage = "位置情報の取得がタイムアウトしました";
            break;
        }
        console.warn(errorMessage);
      },
      geolocationOptions
    );
  } else {
    if (safetyTimeout) clearTimeout(safetyTimeout);
    console.warn("このブラウザは位置情報をサポートしていません");
  }
}

function applyUserLocation(lat, lng) {
  userLocation = { lat: lat, lng: lng };
  map.setCenter(userLocation);
  map.setZoom(15);

  // 現在地マーカー
  // ダークモードかどうかを判定
  const isDarkMode = document.body.classList.contains("dark-mode");
  const currentLocationColor = isDarkMode ? "#00ff00" : "#39ff14"; // ダークモード時はより強い蛍光グリーン
  
  currentLocationMarker = new google.maps.Marker({
    position: userLocation,
    map: map,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 12, // 1.5倍サイズ（8 * 1.5 = 12）
      fillColor: currentLocationColor,
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2,
    },
    title: "現在地",
  });

  // 現在地マーカーのクリックイベント
  currentLocationMarker.addListener("click", function() {
    showLocationModal();
  });

  // ローディング画面を非表示
  hideLoading();
}

// ============================================
// 現在地住所モーダル
// ============================================
function initLocationModal() {
  const modal = document.getElementById("locationModal");
  const closeButton = document.getElementById("locationModalClose");
  const overlay = modal?.querySelector(".location-modal__overlay");

  if (!modal || !closeButton) {
    console.warn("現在地モーダルの要素が見つかりません");
    return;
  }

  // 閉じるボタンのクリックイベント
  closeButton.addEventListener("click", function() {
    hideLocationModal();
  });

  // オーバーレイのクリックイベント
  if (overlay) {
    overlay.addEventListener("click", function() {
      hideLocationModal();
    });
  }

  // ESCキーで閉じる
  document.addEventListener("keydown", function(event) {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) {
      hideLocationModal();
    }
  });
}

function showLocationModal() {
  const modal = document.getElementById("locationModal");
  const addressElement = document.getElementById("locationModalAddress");

  if (!modal || !addressElement || !userLocation || !geocoder) {
    console.warn("現在地モーダルの表示に必要な要素がありません");
    return;
  }

  // モーダルを表示
  modal.classList.remove("hidden");
  addressElement.textContent = "住所を取得中...";

  // 逆ジオコーディングで住所を取得
  geocoder.geocode(
    { location: userLocation },
    function(results, status) {
      if (status === "OK" && results && results.length > 0) {
        // 最初の結果の住所を使用
        const address = results[0].formatted_address || results[0].address_components.map(ac => ac.long_name).join(" ");
        addressElement.textContent = address;
      } else {
        addressElement.textContent = "住所を取得できませんでした";
        console.warn("逆ジオコーディングエラー:", status);
      }
    }
  );
}

function hideLocationModal() {
  const modal = document.getElementById("locationModal");
  if (modal) {
    modal.classList.add("hidden");
  }
}

// ============================================
// 設定モーダル
// ============================================
function initSettingsModal() {
  const modal = document.getElementById("settingsModal");
  const settingsButton = document.getElementById("settingsButton");
  const mapSettingsButton = document.getElementById("mapSettingsButton");
  const closeButton = document.getElementById("settingsModalClose");
  const overlay = modal?.querySelector(".settings-modal__overlay");

  console.log("initSettingsModal called", { modal: !!modal, mapSettingsButton: !!mapSettingsButton, closeButton: !!closeButton });

  if (!modal || !closeButton) {
    console.warn("設定モーダルの要素が見つかりません");
    return;
  }

  // 設定ボタンのクリックイベント（設定バー内）
  if (settingsButton) {
    settingsButton.addEventListener("click", function() {
      console.log("settingsButton clicked");
      showSettingsModal();
    });
  }

  // 設定ボタンのクリックイベント（地図右上）
  if (mapSettingsButton) {
    console.log("mapSettingsButton event listener added");
    mapSettingsButton.addEventListener("click", function(e) {
      console.log("mapSettingsButton clicked");
      e.preventDefault();
      e.stopPropagation();
      // 直接モーダルを開く
      const m = document.getElementById("settingsModal");
      console.log("Modal element:", m);
      if (m) {
        m.classList.remove("hidden");
        m.style.display = "flex";
        m.style.opacity = "1";
        m.style.visibility = "visible";
        console.log("Modal should be visible now");
      }
    });
  } else {
    console.warn("mapSettingsButton not found");
  }

  // 閉じるボタンのクリックイベント
  closeButton.addEventListener("click", function() {
    hideSettingsModal();
  });

  // オーバーレイのクリックイベント
  if (overlay) {
    overlay.addEventListener("click", function() {
      hideSettingsModal();
    });
  }

  // ESCキーで閉じる
  document.addEventListener("keydown", function(event) {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) {
      hideSettingsModal();
    }
  });
  
  // 移動手段ボタンの初期化
  initTransportMode();
}

// 移動手段の初期化
function initTransportMode() {
  // localStorageから読み込み
  const savedMode = localStorage.getItem("poinavi_transport_mode");
  if (savedMode && ["walk", "bicycle", "car"].includes(savedMode)) {
    transportMode = savedMode;
  }
  
  // 設定バー内のボタン
  const settingsBarButtons = document.querySelectorAll(".settings-bar .transport-mode-btn");
  setupTransportButtons(settingsBarButtons);
  
  // 設定モーダル内のボタン（イベント委譲で対応）
  document.addEventListener("click", function(e) {
    const btn = e.target.closest(".settings-modal .transport-mode-btn");
    if (btn) {
      const allModalButtons = document.querySelectorAll(".settings-modal .transport-mode-btn");
      allModalButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      transportMode = btn.dataset.mode;
      localStorage.setItem("poinavi_transport_mode", transportMode);
      // 設定バーのボタンも同期
      settingsBarButtons.forEach(b => {
        if (b.dataset.mode === transportMode) {
          b.classList.add("active");
        } else {
          b.classList.remove("active");
        }
      });
      // 結果を再表示
      if (currentResults && currentResults.length > 0) {
        displayResultsList(currentResults);
      }
    }
  });
}

// 移動手段ボタンのセットアップ
function setupTransportButtons(buttons) {
  // 初期状態を反映
  buttons.forEach(btn => {
    if (btn.dataset.mode === transportMode) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
  
  // クリックイベント
  buttons.forEach(btn => {
    btn.addEventListener("click", function() {
      // すべてのボタンからactiveを削除
      buttons.forEach(b => b.classList.remove("active"));
      // クリックされたボタンにactiveを追加
      this.classList.add("active");
      // モードを更新
      transportMode = this.dataset.mode;
      // localStorageに保存
      localStorage.setItem("poinavi_transport_mode", transportMode);
      // 結果を再表示（移動時間を更新）
      if (currentResults && currentResults.length > 0) {
        displayResultsList(currentResults);
      }
    });
  });
}

// 移動手段を選択（onclick用）
function selectTransportMode(btn, mode) {
  // すべてのボタンからactiveを削除
  const allButtons = document.querySelectorAll(".transport-mode-btn");
  allButtons.forEach(b => b.classList.remove("active"));
  
  // クリックされたボタンにactiveを追加
  btn.classList.add("active");
  
  // モードを更新
  transportMode = mode;
  
  // localStorageに保存
  localStorage.setItem("poinavi_transport_mode", mode);
  
  // 結果を再表示（移動時間を更新）
  if (typeof currentResults !== 'undefined' && currentResults && currentResults.length > 0) {
    displayResultsList(currentResults);
  }
}

// 設定を初期化
function resetAllSettings() {
  if (!confirm("すべての設定を初期化しますか？\\n（タグ、テーマ、移動手段、起動ページなどがリセットされます）")) {
    return;
  }
  
  // localStorageから設定を削除
  localStorage.removeItem("poinavi_theme");
  localStorage.removeItem("poinavi_transport_mode");
  localStorage.removeItem("poinavi_start_page");
  localStorage.removeItem("poinavi_result_count");
  localStorage.removeItem("poinavi_custom_tags");
  localStorage.removeItem("poinavi_search_cache");
  
  // sessionStorageもクリア
  sessionStorage.removeItem("poinavi_session_started");
  
  alert("設定を初期化しました。ページを再読み込みします。");
  window.location.reload();
}

function showSettingsModal() {
  const modal = document.getElementById("settingsModal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.style.display = "flex";
    // タグ管理リストを更新
    renderTagManageList();
    // 移動手段ボタンの状態を更新
    updateTransportModeButtons();
    // 起動ページセレクトの状態を更新
    updateStartPageSelect();
  }
}

function hideSettingsModal() {
  const modal = document.getElementById("settingsModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.style.display = "none";
  }
}

// 移動手段ボタンの状態を更新
function updateTransportModeButtons() {
  const buttons = document.querySelectorAll(".settings-modal .transport-mode-btn");
  const savedMode = localStorage.getItem("poinavi_transport_mode") || "walk";
  
  buttons.forEach(btn => {
    if (btn.dataset.mode === savedMode) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

// 起動ページセレクトの状態を更新
function updateStartPageSelect() {
  const select = document.getElementById("mapStartPageSelect");
  if (select) {
    const savedStartPage = localStorage.getItem("poinavi_start_page") || "index.html";
    select.value = savedStartPage;
  }
}

// ============================================
// キャッシュ関連関数
// ============================================

// キャッシュバージョン（検索ロジック変更時にインクリメント）
const CACHE_VERSION = 2;

// キャッシュキーを生成
function generateCacheKey(tag, query, location) {
  // 位置を100m単位で丸める（近い位置では同じキーになる）
  const roundedLat = Math.round(location.lat * 100) / 100;
  const roundedLng = Math.round(location.lng * 100) / 100;
  return `v${CACHE_VERSION}_${tag || 'all'}_${query || ''}_${roundedLat}_${roundedLng}`;
}

// キャッシュが有効かチェック
function isCacheValid(cacheEntry) {
  if (!cacheEntry) return false;
  
  const now = Date.now();
  const isExpired = (now - cacheEntry.timestamp) > CACHE_EXPIRATION_MS;
  
  if (isExpired) {
    console.log("キャッシュ期限切れ");
    return false;
  }
  
  // 位置が大きく変わった場合はキャッシュ無効
  if (lastCachedLocation && userLocation) {
    const distance = calculateDistance(
      lastCachedLocation.lat,
      lastCachedLocation.lng,
      userLocation.lat,
      userLocation.lng
    );
    if (distance > CACHE_LOCATION_THRESHOLD) {
      console.log(`位置が${Math.round(distance)}m移動したためキャッシュ無効`);
      return false;
    }
  }
  
  return true;
}

// キャッシュに保存
function saveToCache(key, results) {
  searchCache[key] = {
    results: results,
    timestamp: Date.now()
  };
  lastCachedLocation = userLocation ? { ...userLocation } : null;
  console.log(`キャッシュに保存: ${key} (${results.length}件)`);
  
  // キャッシュサイズを制限（最大20件）
  const keys = Object.keys(searchCache);
  if (keys.length > 20) {
    // 最も古いエントリを削除
    let oldestKey = keys[0];
    let oldestTime = searchCache[keys[0]].timestamp;
    keys.forEach(k => {
      if (searchCache[k].timestamp < oldestTime) {
        oldestTime = searchCache[k].timestamp;
        oldestKey = k;
      }
    });
    delete searchCache[oldestKey];
    console.log(`古いキャッシュを削除: ${oldestKey}`);
  }
}

// キャッシュから取得
function getFromCache(key) {
  const cacheEntry = searchCache[key];
  if (isCacheValid(cacheEntry)) {
    console.log(`キャッシュヒット: ${key} (${cacheEntry.results.length}件)`);
    return cacheEntry.results;
  }
  return null;
}

// キャッシュをクリア
function clearCache() {
  searchCache = {};
  lastCachedLocation = null;
  console.log("キャッシュをクリア");
}

// ============================================
// カタカナをひらがなに変換
// ============================================
function katakanaToHiragana(str) {
  return str.replace(/[\u30A1-\u30F6]/g, function(match) {
    return String.fromCharCode(match.charCodeAt(0) - 0x60);
  });
}

// ============================================
// カタカナ分割（スマート再検索用）
// ============================================
function splitKatakana(query) {
  console.log("splitKatakana 入力:", query);
  
  // カタカナのみで構成されているか確認
  const katakanaOnly = /^[ァ-ヶー]+$/;
  if (!katakanaOnly.test(query)) {
    console.log("splitKatakana: カタカナのみでないため分割しない");
    return null; // カタカナのみでない場合は分割しない
  }
  
  // 既にスペースが含まれている場合は分割しない
  if (query.includes(' ') || query.includes('　')) {
    console.log("splitKatakana: スペースが含まれているため分割しない");
    return null;
  }
  
  // 短すぎる場合は分割しない（4文字以下）
  if (query.length <= 4) {
    console.log("splitKatakana: 短すぎるため分割しない");
    return null;
  }
  
  // 2〜3文字ごとにスペースを挿入
  // 長音「ー」は前の文字とくっつける
  let result = '';
  let chunk = '';
  
  for (let i = 0; i < query.length; i++) {
    const char = query[i];
    chunk += char;
    
    // 長音は次の文字とセットにしない
    if (char === 'ー') {
      continue;
    }
    
    // 2〜3文字たまったらスペースを入れる
    // ただし、次が長音の場合は待つ
    const nextChar = query[i + 1];
    if (chunk.length >= 2 && nextChar !== 'ー') {
      result += chunk + ' ';
      chunk = '';
    }
  }
  
  // 残りを追加
  if (chunk) {
    result += chunk;
  }
  
  const splitResult = result.trim();
  console.log("splitKatakana 結果:", splitResult);
  return splitResult;
}

// ============================================
// 場所検索
// ============================================
function searchPlaces() {
  if (!placesService) return;

  // 既存のマーカーを削除
  clearMarkers();
  
  // 既存の経路を削除
  if (directionsRenderer) {
    directionsRenderer.setDirections({ routes: [] });
  }
  
  // タグも検索クエリもない場合は検索しない（ニュートラル状態）
  if (selectedTags.length === 0 && (!searchQuery || searchQuery.trim() === "")) {
    displayNoResults(true); // true = ニュートラル状態（メッセージなし）
    return;
  }

  const location = userLocation || { lat: 35.6812, lng: 139.7671 };
  
  // キャッシュキーを生成
  const tag = selectedTags.length > 0 ? selectedTags[0] : null;
  const cacheKey = generateCacheKey(tag, searchQuery, location);
  
  // キャッシュをチェック
  const cachedResults = getFromCache(cacheKey);
  if (cachedResults) {
    // キャッシュから結果を処理（APIコール不要）
    processResults(cachedResults);
    return;
  }

  // カスタムタグかどうかをチェック
  let useTextSearch = false;
  let textSearchQuery = searchQuery;
  
  if (selectedTags.length > 0) {
    const selectedTagId = selectedTags[0];
    const selectedTag = getAllTags().find(t => t.id === selectedTagId);
    
    // カスタムタグの場合はテキスト検索を使用
    if (selectedTag && selectedTag.isCustom) {
      useTextSearch = true;
      textSearchQuery = selectedTag.name;
    }
  }

  // テキスト検索がある場合またはカスタムタグの場合は textSearch を使用
  if ((searchQuery && searchQuery.trim() !== "") || useTextSearch) {
    const originalQuery = textSearchQuery || searchQuery;
    
    // textSearch を使用（テキスト検索）
    const request = {
      query: originalQuery,
      location: location,
      radius: 3000, // 2km範囲
    };

    console.log("テキスト検索リクエスト:", { query: request.query, useTextSearch });

    placesService.textSearch(request, function (results, status) {
      if (status === google.maps.places.PlacesServiceStatus.OK) {
        // 結果を現在地から近い順にソート
        results.forEach((place) => {
          if (place.geometry && place.geometry.location) {
            const distance = calculateDistance(
              location.lat,
              location.lng,
              place.geometry.location.lat(),
              place.geometry.location.lng()
            );
            place.distance = distance;
          }
        });
        results.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));

        // 検索結果の上位N件（表示件数）にクエリが含まれているかチェック
        const queryLower = originalQuery.toLowerCase();
        const queryNoSpace = originalQuery.replace(/\s/g, '');
        const topResults = results.slice(0, resultCount); // 上位N件のみチェック
        
        const hasRelevantResult = topResults.some(place => {
          const nameLower = (place.name || '').toLowerCase();
          const nameNoSpace = (place.name || '').replace(/\s/g, '');
          // クエリが名前に含まれているか（スペース無視）
          return nameNoSpace.includes(queryNoSpace) || 
                 queryNoSpace.includes(nameNoSpace);
        });
        
        console.log(`検索結果の関連性チェック: クエリ="${originalQuery}", 上位${resultCount}件に関連結果あり=${hasRelevantResult}`);
        
        // 結果が少ない場合、または関連する結果がない場合、カタカナ分割またはひらがな変換で再検索
        if (results.length < resultCount || !hasRelevantResult) {
          // まずカタカナ分割を試す
          let alternativeQuery = splitKatakana(originalQuery);
          
          // 分割できなかった場合、ひらがな変換を試す
          if (!alternativeQuery || alternativeQuery === originalQuery) {
            const katakanaOnly = /^[ァ-ヶー]+$/;
            if (katakanaOnly.test(originalQuery)) {
              alternativeQuery = katakanaToHiragana(originalQuery);
              console.log("ひらがな変換:", alternativeQuery);
            }
          }
          
          if (alternativeQuery && alternativeQuery !== originalQuery) {
            console.log(`結果が少ない(${results.length}件)または関連なしのため、代替クエリで再検索:`, alternativeQuery);
            
            // 代替クエリで再検索
            const retryRequest = {
              query: alternativeQuery,
              location: location,
              radius: 3000,
            };
            
            placesService.textSearch(retryRequest, function (retryResults, retryStatus) {
              let mergedResults = results;
              
              if (retryStatus === google.maps.places.PlacesServiceStatus.OK && retryResults.length > 0) {
                // 距離を計算
                retryResults.forEach((place) => {
                  if (place.geometry && place.geometry.location) {
                    const distance = calculateDistance(
                      location.lat,
                      location.lng,
                      place.geometry.location.lat(),
                      place.geometry.location.lng()
                    );
                    place.distance = distance;
                  }
                });
                
                // 関連する結果のみをフィルタリング（クエリが名前に含まれているもの）
                const relevantRetryResults = retryResults.filter(place => {
                  const nameLower = (place.name || '').toLowerCase().replace(/\s/g, '');
                  const origLower = originalQuery.toLowerCase();
                  const altLower = alternativeQuery.toLowerCase().replace(/\s/g, '');
                  return nameLower.includes(origLower) || 
                         nameLower.includes(altLower) ||
                         origLower.includes(nameLower) ||
                         altLower.includes(nameLower);
                });
                
                console.log(`関連結果フィルタ: ${retryResults.length}件 → ${relevantRetryResults.length}件`);
                
                // 結果をマージ（重複排除、関連結果を優先）
                const existingIds = new Set(results.map(p => p.place_id));
                const newResults = relevantRetryResults.filter(p => !existingIds.has(p.place_id));
                
                // 元の結果から関連するものを抽出
                const relevantFromOriginal = results.filter(place => {
                  const nameNoSpace = (place.name || '').replace(/\s/g, '');
                  return nameNoSpace.includes(queryNoSpace) || queryNoSpace.includes(nameNoSpace);
                });
                
                // 元の結果から関連しないものを抽出
                const nonRelevantFromOriginal = results.filter(place => {
                  const nameNoSpace = (place.name || '').replace(/\s/g, '');
                  return !nameNoSpace.includes(queryNoSpace) && !queryNoSpace.includes(nameNoSpace);
                });
                
                // すべての関連結果を一つにまとめて距離順にソート
                const allRelevant = [...newResults, ...relevantFromOriginal];
                allRelevant.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
                
                // 非関連結果も距離順にソート
                nonRelevantFromOriginal.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
                
                // 関連結果（距離順）を先頭に、非関連結果（距離順）を後ろに
                mergedResults = [...allRelevant, ...nonRelevantFromOriginal];
                
                console.log(`マージ結果: ${allRelevant.length}件(関連・距離順) + ${nonRelevantFromOriginal.length}件(非関連) = ${mergedResults.length}件`);
              }
              
              // opening_hours の詳細情報を取得
              // スマート再検索の結果は既にソート済みなので、再ソートをスキップ
              enrichPlacesWithDetails(mergedResults, function (enrichedResults) {
                saveToCache(cacheKey, enrichedResults);
                processResults(enrichedResults, true); // skipSort=true
              });
            });
            return;
          }
        }

        // 関連結果を先頭に並べ替え（再検索しない場合でも）
        const relevantResults = results.filter(place => {
          const nameNoSpace = (place.name || '').replace(/\s/g, '');
          return nameNoSpace.includes(queryNoSpace) || queryNoSpace.includes(nameNoSpace);
        });
        const nonRelevantResults = results.filter(place => {
          const nameNoSpace = (place.name || '').replace(/\s/g, '');
          return !nameNoSpace.includes(queryNoSpace) && !queryNoSpace.includes(nameNoSpace);
        });
        
        // 関連結果がある場合は先頭に配置
        let sortedResults = results;
        if (relevantResults.length > 0) {
          relevantResults.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
          nonRelevantResults.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
          sortedResults = [...relevantResults, ...nonRelevantResults];
          console.log(`関連結果を先頭に配置: ${relevantResults.length}件(関連) + ${nonRelevantResults.length}件(非関連)`);
        }

        // opening_hours の詳細情報を取得するため、getDetails を呼び出す
        enrichPlacesWithDetails(sortedResults, function (enrichedResults) {
          // キャッシュに保存
          saveToCache(cacheKey, enrichedResults);
          // 関連結果がある場合はソートをスキップ
          processResults(enrichedResults, relevantResults.length > 0);
        });
      } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        // 結果が0件の場合、カタカナ分割で再検索
        const splitQuery = splitKatakana(originalQuery);
        if (splitQuery && splitQuery !== originalQuery) {
          console.log(`結果0件のため、分割クエリで再検索:`, splitQuery);
          
          const retryRequest = {
            query: splitQuery,
            location: location,
            radius: 3000,
          };
          
          placesService.textSearch(retryRequest, function (retryResults, retryStatus) {
            if (retryStatus === google.maps.places.PlacesServiceStatus.OK) {
              // 距離を計算してソート
              retryResults.forEach((place) => {
                if (place.geometry && place.geometry.location) {
                  const distance = calculateDistance(
                    location.lat,
                    location.lng,
                    place.geometry.location.lat(),
                    place.geometry.location.lng()
                  );
                  place.distance = distance;
                }
              });
              retryResults.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
              
              enrichPlacesWithDetails(retryResults, function (enrichedResults) {
                saveToCache(cacheKey, enrichedResults);
                processResults(enrichedResults);
              });
            } else {
              displayNoResults();
            }
          });
          return;
        }
        displayNoResults();
      } else {
        console.error("検索エラー:", status);
        displayNoResults();
      }
    });
  } else {
    // nearbySearch を使用（タグ検索または全件検索）
    // タグをGoogle Places APIの正しいtypeにマッピング
    const tagToTypeMap = {
      restaurant: "restaurant",
      cafe: "cafe",
      convenience: "convenience_store", // 正しいtype名
      convenience_store: "convenience_store",
      gas_station: "gas_station",
      parking: "parking",
      pharmacy: "pharmacy",
      atm: "atm",
      hospital: "hospital",
      train_station: "train_station",
    };

    // 検索キーワードのマッピング（より正確な検索のため）
    const tagToKeywordMap = {
      convenience_store: "コンビニ",
      gas_station: "ガソリンスタンド",
      pharmacy: "薬局 ドラッグストア",
      hospital: "病院 クリニック",
      train_station: "駅",
    };

    const placeType = selectedTags.length > 0 
      ? (tagToTypeMap[selectedTags[0]] || selectedTags[0])
      : undefined;

    const keyword = placeType ? tagToKeywordMap[placeType] : undefined;

    let request;
    
    if (placeType) {
      // カテゴリ検索の場合は距離順（rankBy: DISTANCE）を使用
      // 注意: rankBy: DISTANCE を使う場合、radius は使用不可
      request = {
        location: location,
        rankBy: google.maps.places.RankBy.DISTANCE,
        type: placeType,
      };
      // キーワードがある場合は追加
      if (keyword) {
        request.keyword = keyword;
      }
    } else {
      // カテゴリなしの場合は範囲検索
      request = {
        location: location,
        radius: 3000,
      };
    }

    console.log("検索リクエスト:", { selectedTags, placeType, keyword, request });

    placesService.nearbySearch(request, function (results, status) {
      if (status === google.maps.places.PlacesServiceStatus.OK) {
        // タグでフィルタリング（types配列で確認）
        if (selectedTags.length > 0 && placeType) {
          const filteredResults = results.filter((place) => {
            if (!place.types || !Array.isArray(place.types)) {
              return false;
            }
            // types配列に指定したtypeが含まれているか確認
            const hasType = place.types.includes(placeType);
            if (!hasType) {
              console.log(`${place.name} は ${placeType} ではないため除外:`, place.types);
            }
            return hasType;
          });
          console.log(`フィルタリング: ${results.length}件 → ${filteredResults.length}件`);
          results = filteredResults;
        }

        // opening_hours の詳細情報を取得するため、getDetails を呼び出す
        enrichPlacesWithDetails(results, function (enrichedResults) {
          // キャッシュに保存
          saveToCache(cacheKey, enrichedResults);
          processResults(enrichedResults);
        });
      } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        displayNoResults();
      } else {
        console.error("検索エラー:", status);
        displayNoResults();
      }
    });
  }
}

// ============================================
// 場所の詳細情報を取得（営業時間情報を含む）
// ============================================
function enrichPlacesWithDetails(results, callback) {
  if (!results || results.length === 0) {
    callback(results);
    return;
  }

  // 表示件数分だけ詳細情報を取得（パフォーマンス向上）
  const limit = Math.min(resultCount, results.length);
  const resultsToEnrich = results.slice(0, limit);
  const remainingResults = results.slice(limit);

  let completed = 0;

  // 詳細情報を取得する結果がない場合は、そのまま返す
  if (resultsToEnrich.length === 0) {
    callback(results);
    return;
  }

  // インデックスで順序を保持するための配列を初期化
  const enrichedResults = new Array(resultsToEnrich.length);
  
  resultsToEnrich.forEach((place, index) => {
    // 詳細情報を取得
    const detailsRequest = {
      placeId: place.place_id,
      fields: [
        "opening_hours",
        "name",
        "geometry",
        "place_id",
        "formatted_address",
        "rating",
      ],
    };

    placesService.getDetails(detailsRequest, function (placeDetails, status) {
        if (status === google.maps.places.PlacesServiceStatus.OK && placeDetails) {
          // 詳細情報をマージ
          if (placeDetails.opening_hours) {
            place.opening_hours = placeDetails.opening_hours;
            // isOpen() メソッドが利用可能か確認
            if (typeof place.opening_hours.isOpen === "function") {
              try {
                const isOpenResult = place.opening_hours.isOpen();
                console.log(`営業時間情報を取得: ${place.name}`, {
                  isOpen: isOpenResult,
                  weekday_text: place.opening_hours.weekday_text
                });
              } catch (e) {
                console.log(`営業時間情報を取得: ${place.name}`, {
                  weekday_text: place.opening_hours.weekday_text
                });
              }
            } else {
              console.log(`営業時間情報を取得: ${place.name}`, {
                weekday_text: place.opening_hours.weekday_text
              });
            }
          } else {
            console.log(`営業時間情報なし: ${place.name}`);
          }
        } else {
          console.warn(`詳細情報の取得に失敗: ${place.name}`, status);
        }

      // インデックスを使って順序を保持
      enrichedResults[index] = place;
      completed++;

      // すべての詳細情報が取得できたらコールバック
      if (completed === resultsToEnrich.length) {
        // 残りの結果も追加（詳細情報なし）
        const allResults = enrichedResults.concat(remainingResults);
        callback(allResults);
      }
    });
  });
}

// ============================================
// 検索結果の処理
// ============================================
function processResults(results, skipSort = false) {
  console.log("=== 処理開始 ===");
  console.log(`1. タグ判定後のデータ: ${results.length}件`);
  
  // 距離を計算（まだ計算されていない場合）
  const location = userLocation || { lat: 35.6812, lng: 139.7671 };
  results.forEach((place) => {
    if (place.distance === undefined) {
      const distance = calculateDistance(
        location.lat,
        location.lng,
        place.geometry.location.lat(),
        place.geometry.location.lng()
      );
      place.distance = distance;
    }
  });

  // スマート再検索の結果でない場合のみ距離ソート
  if (!skipSort) {
    results.sort((a, b) => a.distance - b.distance);
  } else {
    console.log("スマート再検索の結果のため、ソートをスキップ");
  }

  // 2. 営業中のみフィルタ（時間判定のみ）
  console.log(`2. 営業中判定前: ${results.length}件`);
  if (openOnly) {
    const beforeFilterCount = results.length;
    results = results.filter((place) => {
      if (!place.opening_hours) {
        return false; // 営業時間情報がない場合は除外
      }
      
      try {
        // weekday_text から時間判定のみで判定
        if (place.opening_hours.weekday_text && place.opening_hours.weekday_text.length > 0) {
          // 24時間営業を先にチェック（念のため）
          const allText = place.opening_hours.weekday_text.join(" ").toLowerCase();
          const is24Hours = 
            allText.includes("24 hours") || 
            allText.includes("24時間") || 
            allText.includes("24時間営業") ||
            allText.includes("24 時間") ||
            allText.includes("24 時間営業") ||
            allText.match(/24\s*時間/);
          
          if (is24Hours) {
            console.log(`${place.name} は24時間営業として判定 (フィルタ通過)`);
            return true;
          }
          
          const isOpen = checkIfOpenFromWeekdayText(place.opening_hours.weekday_text);
          console.log(`${place.name} の営業時間判定:`, {
            isOpen: isOpen,
            weekdayText: place.opening_hours.weekday_text,
            allText: allText
          });
          
          // true の場合のみ通過（false や null は除外）
          if (isOpen === true) {
            return true;
          } else {
            console.log(`${place.name} は営業中ではないためフィルタ除外 (isOpen: ${isOpen})`);
            return false;
          }
        } else {
          // weekday_text がない場合は除外
          console.log(`${place.name} は営業時間情報がないためフィルタ除外`);
          return false;
        }
      } catch (error) {
        console.warn(`${place.name} の営業状況判定エラー:`, error);
        return false;
      }
    });
    
    console.log(`2. 営業中判定後: ${results.length}件 (判定前: ${beforeFilterCount}件)`);
    if (results.length === 0 && beforeFilterCount > 0) {
      console.warn("⚠️ すべての結果がフィルタで除外されました。フィルタリングロジックを確認してください。");
    }
    
    // フィルタ結果後のデータに対して時間判定の詳細を表示
    console.log("=== 営業中判定の詳細 ===");
    results.forEach((place) => {
      if (place.opening_hours && place.opening_hours.weekday_text && place.opening_hours.weekday_text.length > 0) {
        const isOpen = checkIfOpenFromWeekdayText(place.opening_hours.weekday_text);
        console.log(`${place.name}:`, {
          isOpen: isOpen,
          weekdayText: place.opening_hours.weekday_text,
          distance: `${(place.distance / 1000).toFixed(2)}km`
        });
      }
    });
    console.log("========================");
  } else {
    console.log(`2. 営業中判定: スキップ（営業中のみ表示がOFF）`);
  }

  // 3. 表示件数で制限
  console.log(`3. 表示件数制限前: ${results.length}件 → 制限後: ${Math.min(results.length, resultCount)}件`);
  currentResults = results.slice(0, resultCount);
  console.log(`最終結果: ${currentResults.length}件`);
  console.log("===================");

  // マーカーとリストを更新
  // displayMarkers内で自動ズームが実行される
  displayMarkers(currentResults);
  displayResultsList(currentResults);
}

// ============================================
// マーカー表示
// ============================================
function displayMarkers(results, skipAutoZoom = false) {
  // 既存のマーカーをクリア
  markers.forEach((marker) => {
    marker.setMap(null);
  });
  markers = [];
  
  // 選択状態をリセット
  clearMarkerSelection();
  
  // ダークモードかどうかを判定
  const isDarkMode = document.body.classList.contains("dark-mode");
  
  // 重複位置を検出してオフセットを計算
  const usedPositions = [];
  
  results.forEach((place, index) => {
    // ダークモード時はより強い蛍光色、ライトモード時は通常の蛍光色
    const markerColor = isDarkMode ? "#ff0080" : "#ff1744"; // ダークモード時はより強い蛍光ピンク/レッド

    // 1〜3番目のマーカーにはラベル（番号）を表示
    // 各マーカーに独立したラベルオブジェクトを作成
    const markerLabel = index < 3 ? {
      text: String(index + 1),
      color: "#ffffff",
      fontSize: "14px",
      fontWeight: "bold",
      className: `marker-label-${index}`,
    } : null;

    // 位置を取得
    let lat = place.geometry.location.lat();
    let lng = place.geometry.location.lng();
    
    // 同じ位置にマーカーがあるか確認し、あればオフセット
    const offset = 0.00015; // 約15mのオフセット
    let offsetIndex = 0;
    for (const pos of usedPositions) {
      const distance = Math.sqrt(Math.pow(lat - pos.lat, 2) + Math.pow(lng - pos.lng, 2));
      if (distance < 0.0001) { // 約10m以内なら重複とみなす
        offsetIndex++;
      }
    }
    
    // 重複があればオフセットを適用（円形に配置）
    if (offsetIndex > 0) {
      const angle = (offsetIndex * 120) * (Math.PI / 180); // 120度ずつずらす
      lat += offset * Math.cos(angle);
      lng += offset * Math.sin(angle);
    }
    
    usedPositions.push({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });

    const marker = new google.maps.Marker({
      position: { lat, lng },
      map: map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 15, // 1.5倍サイズ（10 * 1.5 = 15）
        fillColor: markerColor,
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
        labelOrigin: new google.maps.Point(0, 0), // ラベルの位置
      },
      label: markerLabel,
      title: place.name,
    });
    
    // マーカーに元の色とラベルを保存
    marker.originalColor = markerColor;
    marker.originalLabel = markerLabel;
    marker.markerIndex = index;

    // クリックイベント
    marker.addListener("click", function () {
      selectResult(index);
    });

    markers.push(marker);
  });
  
  // 自動ズームをスキップしない場合のみ実行
  if (!skipAutoZoom) {
    adjustMapToFitResults(results);
  }
}

// ============================================
// マーカー選択状態の管理
// ============================================
function selectMarker(index) {
  const isDarkMode = document.body.classList.contains("dark-mode");
  const markerColor = isDarkMode ? "#ff0080" : "#ff1744";
  
  // 既に同じマーカーが選択されている場合は解除
  if (selectedMarkerIndex === index) {
    clearMarkerSelection();
    return;
  }
  
  // 前の選択をクリア
  clearMarkerSelection();
  
  // 新しいマーカーを選択
  selectedMarkerIndex = index;
  
  // 他のマーカーを50%透過に
  markers.forEach((marker, i) => {
    if (i !== index) {
      marker.setIcon({
        path: google.maps.SymbolPath.CIRCLE,
        scale: 15,
        fillColor: marker.originalColor || markerColor,
        fillOpacity: 0.5, // 50%透過
        strokeColor: "#ffffff",
        strokeWeight: 2,
        strokeOpacity: 0.5, // 枠線も50%透過
        labelOrigin: new google.maps.Point(0, 0),
      });
      // ラベルも50%透過風に（新しいオブジェクトを作成）
      if (marker.originalLabel && marker.markerIndex < 3) {
        marker.setLabel({
          text: String(marker.markerIndex + 1),
          color: "rgba(255, 255, 255, 0.5)",
          fontSize: "14px",
          fontWeight: "bold",
        });
      }
    }
  });
  
  // 選択されたマーカーを点滅させる
  startMarkerPulse(index);
}

function clearMarkerSelection() {
  // 点滅を停止
  stopMarkerPulse();
  
  // すべてのマーカーを元の状態に戻す
  const isDarkMode = document.body.classList.contains("dark-mode");
  const markerColor = isDarkMode ? "#ff0080" : "#ff1744";
  
  markers.forEach((marker) => {
    marker.setIcon({
      path: google.maps.SymbolPath.CIRCLE,
      scale: 15,
      fillColor: marker.originalColor || markerColor,
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2,
      labelOrigin: new google.maps.Point(0, 0),
    });
    // ラベルを元に戻す（新しいオブジェクトを作成）
    if (marker.markerIndex < 3) {
      marker.setLabel({
        text: String(marker.markerIndex + 1),
        color: "#ffffff",
        fontSize: "14px",
        fontWeight: "bold",
      });
    }
  });
  
  selectedMarkerIndex = null;
}

function startMarkerPulse(index) {
  const marker = markers[index];
  if (!marker) return;
  
  const isDarkMode = document.body.classList.contains("dark-mode");
  const markerColor = marker.originalColor || (isDarkMode ? "#ff0080" : "#ff1744");
  
  let pulsePhase = 0;
  
  // 点滅アニメーション（ふわっと）- サイズのみ変化、透過なし
  markerPulseInterval = setInterval(() => {
    pulsePhase += 0.15; // アニメーション速度
    
    // サイン波で滑らかにサイズ変化（15 〜 18）
    const scale = 15 + Math.sin(pulsePhase) * 3;
    
    marker.setIcon({
      path: google.maps.SymbolPath.CIRCLE,
      scale: scale,
      fillColor: markerColor,
      fillOpacity: 1, // 常に不透明
      strokeColor: "#ffffff",
      strokeWeight: 2,
      labelOrigin: new google.maps.Point(0, 0),
    });
  }, 50); // 50msごとに更新（滑らかなアニメーション）
}

function stopMarkerPulse() {
  if (markerPulseInterval) {
    clearInterval(markerPulseInterval);
    markerPulseInterval = null;
  }
}

// ============================================
// 結果リスト表示
// ============================================
function displayResultsList(results) {
  const resultsList = document.getElementById("resultsList");
  resultsList.innerHTML = "";
  resultsList.style.display = ''; // 結果リストを表示

  if (results.length === 0) {
    resultsList.innerHTML = '<div class="result-item">結果が見つかりませんでした</div>';
    return;
  }

  results.forEach((place, index) => {
    const item = document.createElement("div");
    item.className = "result-item";
    item.dataset.index = index;

    // 営業状況
    let statusText = "営業時間の情報なし";
    let statusClass = "unknown";
    
    if (place.opening_hours) {
      try {
        let isOpen = null;
        
        // 方法0: 24時間営業を優先的にチェック（weekday_textから）
        if (place.opening_hours.weekday_text && place.opening_hours.weekday_text.length > 0) {
          const allText = place.opening_hours.weekday_text.join(" ").toLowerCase();
          if (allText.includes("24 hours") || allText.includes("24時間") || allText.includes("24時間営業")) {
            isOpen = true;
          }
        }
        
        // 方法1: isOpen() メソッドを試す（最優先、ただし24時間営業でない場合のみ）
        if (isOpen === null && typeof place.opening_hours.isOpen === "function") {
          try {
            isOpen = place.opening_hours.isOpen();
            // isOpen() が正しく動作している場合は、その結果を使用
            if (isOpen !== null && isOpen !== undefined) {
              // 結果を使用（そのまま）
            }
          } catch (error) {
            console.warn(`${place.name} の isOpen() エラー:`, error);
            // エラーが発生した場合は次の方法を試す
          }
        }
        
        // 方法2: weekday_text から現在時刻を判定
        // 24時間営業でない場合、またはisOpenがnull/falseの場合に判定
        if ((isOpen === null || isOpen === false) && place.opening_hours.weekday_text && place.opening_hours.weekday_text.length > 0) {
          const weekdayTextResult = checkIfOpenFromWeekdayText(place.opening_hours.weekday_text);
          if (weekdayTextResult !== null) {
            isOpen = weekdayTextResult;
          }
        }

        if (isOpen === true) {
          statusText = "営業中";
          statusClass = "open";
        } else if (isOpen === false) {
          statusText = "営業時間外";
          statusClass = "closed";
        } else {
          // isOpen が null または undefined の場合
          // weekday_text があれば今日の営業時間を表示
          if (place.opening_hours.weekday_text && place.opening_hours.weekday_text.length > 0) {
            const todayHours = getTodayOpeningHours(place.opening_hours.weekday_text);
            console.log(`${place.name} の営業時間抽出:`, {
              weekdayText: place.opening_hours.weekday_text,
              todayHours: todayHours
            });
            if (todayHours) {
              statusText = todayHours;
              statusClass = "hours"; // 営業時間が表示されている場合
            } else {
              // 抽出できなかった場合、全営業時間を表示
              const allHours = place.opening_hours.weekday_text.join(" / ");
              if (allHours.length > 50) {
                statusText = allHours.substring(0, 50) + "...";
              } else {
                statusText = allHours;
              }
              statusClass = "hours"; // 営業時間が表示されている場合
            }
          }
        }
      } catch (error) {
        console.warn(`${place.name} の営業状況判定エラー:`, error, place.opening_hours);
        // エラーが発生した場合は情報なしとして扱う
      }
    } else {
      console.log(`${place.name}: opening_hours が存在しません`);
    }

    // 距離
    const distance = place.distance < 1000
      ? `${Math.round(place.distance)}m`
      : `${(place.distance / 1000).toFixed(1)}km`;

    // ルート情報（簡易版）
    const routeInfo = estimateRoute(place.distance);

    item.innerHTML = `
      <div class="result-item__name">${place.name}</div>
      <div class="result-item__distance">${distance}</div>
      <span class="result-item__status ${statusClass}">${statusText}</span>
      <div class="result-item__route">${routeInfo}</div>
    `;

    item.addEventListener("click", function () {
      selectResult(index);
      // 対応するマーカーを取得してInfoWindowを表示
      if (markers[index]) {
        showInfoWindow(place, markers[index]);
      }
    });

    resultsList.appendChild(item);
  });
}

// ============================================
// マップを現在地と全ての結果マーカーが画面内に収まるように調整
// ============================================
function adjustMapToFitResults(results) {
  if (!map || !results || results.length === 0) return;
  
  // 現在地と全ての結果マーカーを含む範囲を計算
  const bounds = new google.maps.LatLngBounds();
  
  // 現在地を追加
  if (userLocation) {
    bounds.extend(userLocation);
  }
  
  // 全ての結果マーカーを追加
  results.forEach((place) => {
    if (place.geometry && place.geometry.location) {
      bounds.extend(place.geometry.location);
    }
  });
  
  // 現在地がない場合は、結果の中心を計算
  if (!userLocation && results.length > 0) {
    // 結果のみで調整
    const resultBounds = new google.maps.LatLngBounds();
    results.forEach((place) => {
      if (place.geometry && place.geometry.location) {
        resultBounds.extend(place.geometry.location);
      }
    });
    
    if (!resultBounds.isEmpty()) {
      map.fitBounds(resultBounds, {
        top: 70,
        right: 70,
        bottom: 70,
        left: 70
      });
      
      // ズームレベルが大きすぎる場合は制限（拡大率を上げる）
      google.maps.event.addListenerOnce(map, 'bounds_changed', function() {
        const zoom = map.getZoom();
        if (zoom > 19) {
          map.setZoom(19); // 最大ズームレベルを上げる
        } else if (zoom < 16) {
          // 最小ズームを上げる
          map.setZoom(17);
        }
      });
    }
    return;
  }
  
  // 現在地がある場合は、現在地と全ての結果を含む範囲に調整
  if (!bounds.isEmpty()) {
    // 距離に応じてパディングを調整
    let maxDistance = 0;
    if (userLocation && results.length > 0) {
      results.forEach((place) => {
        if (place.geometry && place.geometry.location) {
          const distance = calculateDistance(
            userLocation.lat,
            userLocation.lng,
            place.geometry.location.lat(),
            place.geometry.location.lng()
          );
          if (distance > maxDistance) {
            maxDistance = distance;
          }
        }
      });
    }
    
    // 距離に応じてパディングを調整（拡大率を上げるため、パディングを小さく）
    let padding = 80;
    if (maxDistance < 200) {
      padding = 50; // 近い場合はより小さめのパディングで拡大
    } else if (maxDistance < 500) {
      padding = 70;
    } else {
      padding = 100; // 遠い場合もパディングを小さく
    }
    
    map.fitBounds(bounds, {
      top: padding,
      right: padding,
      bottom: padding,
      left: padding
    });
    
    // ズームレベルが大きすぎる場合は制限、小さすぎる場合は拡大（拡大率を上げる）
    google.maps.event.addListenerOnce(map, 'bounds_changed', function() {
      const zoom = map.getZoom();
      if (zoom > 19) {
        map.setZoom(19); // 最大ズームレベルを上げる
      } else if (zoom < 16 && maxDistance < 1000) {
        // 距離が近いのにズームが小さすぎる場合は拡大（最小ズームを上げる）
        map.setZoom(17);
      } else if (zoom < 15 && maxDistance < 500) {
        // さらに近い場合はより拡大
        map.setZoom(18);
      }
    });
  }
}

// ============================================
// 結果選択
// ============================================
function selectResult(index) {
  const place = currentResults[index];
  if (!place) return;

  // マーカーを選択状態にする（点滅 + 他を透過）
  selectMarker(index);

  // InfoWindowを表示（showInfoWindow内でマップ調整も行うため、ここでは調整しない）
  if (markers[index]) {
    showInfoWindow(place, markers[index]);
  }

  // リストのアクティブ状態を更新
  const resultItems = document.querySelectorAll(".result-item");
  resultItems.forEach((item, i) => {
    item.classList.toggle("active", i === index);
  });

  // 選択された項目を画面内にスクロール
  const activeItem = resultItems[index];
  if (activeItem) {
    activeItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
    
    // 結果リストを表示（非表示になっている場合）
    const resultsList = document.getElementById("resultsList");
    if (resultsList && resultsList.parentElement) {
      resultsList.parentElement.style.display = "block";
    }
  }
  
  // ルート表示（InfoWindow表示後に実行）
  if (userLocation) {
    // 少し遅延させてから経路を表示（InfoWindowが確実に表示された後）
    setTimeout(function() {
      displayRoute(userLocation, place.geometry.location);
    }, 200);
  }
  
  console.log("選択された店舗:", place.name, place);
}

// 情報ウィンドウを表示
function showInfoWindow(place, marker) {
  if (!map || !place) return;

  // InfoWindowが存在しない場合は作成
  if (!infoWindow) {
    infoWindow = new google.maps.InfoWindow();
    
    // InfoWindowが閉じられたときにマーカー選択を解除
    infoWindow.addListener('closeclick', function() {
      clearMarkerSelection();
      
      // リストのアクティブ状態も解除
      const resultItems = document.querySelectorAll(".result-item");
      resultItems.forEach((item) => {
        item.classList.remove("active");
      });
    });
  }
  
  // 現在のplaceとmarkerを保存（テーマ切り替え時に再表示するため）
  if (marker) {
    marker.infoPlace = place;
  }

  // 営業状況を取得
  let statusText = "営業時間の情報なし";
  let statusClass = "unknown"; // デフォルトは「営業時間の情報なし」
  
  if (place.opening_hours) {
    if (place.opening_hours.weekday_text && place.opening_hours.weekday_text.length > 0) {
      const allText = place.opening_hours.weekday_text.join(" ").toLowerCase();
      const is24Hours = 
        allText.includes("24 hours") || 
        allText.includes("24時間") || 
        allText.includes("24時間営業") ||
        allText.includes("24 時間") ||
        allText.includes("24 時間営業") ||
        allText.match(/24\s*時間/);
      
      if (is24Hours) {
        statusText = "24時間営業";
        statusClass = "hours"; // 営業時間が表示されている場合
      } else {
        const isOpen = checkIfOpenFromWeekdayText(place.opening_hours.weekday_text);
        if (isOpen === true) {
          statusText = "営業中";
          statusClass = "open";
        } else if (isOpen === false) {
          statusText = "営業時間外";
          statusClass = "closed";
        } else {
          const todayHours = getTodayOpeningHours(place.opening_hours.weekday_text);
          statusText = todayHours || "営業時間あり";
          statusClass = "hours"; // 営業時間が表示されている場合
        }
      }
    }
  }

  // 距離を計算
  const location = userLocation || { lat: 35.6812, lng: 139.7671 };
  const distance = place.distance || calculateDistance(
    location.lat,
    location.lng,
    place.geometry.location.lat(),
    place.geometry.location.lng()
  );
  const distanceText = distance < 1000 
    ? `${Math.round(distance)}m`
    : `${(distance / 1000).toFixed(1)}km`;

  // 移動時間を計算
  let travelModeLabel = "";
  let travelTimeText = "";
  switch (transportMode) {
    case "walk":
      travelModeLabel = "徒歩";
      travelTimeText = `約${Math.max(1, Math.round(distance / 80))}分`;
      break;
    case "bicycle":
      travelModeLabel = "自転車";
      travelTimeText = `約${Math.max(1, Math.round(distance / 250))}分`;
      break;
    case "car":
      travelModeLabel = "車";
      travelTimeText = `約${Math.max(1, Math.round(distance / 500))}分`;
      break;
    default:
      travelModeLabel = "徒歩";
      travelTimeText = `約${Math.max(1, Math.round(distance / 80))}分`;
  }

  // 住所を取得
  const address = place.formatted_address || place.vicinity || "住所情報なし";

  // ダークモードかどうかを判定
  const isDarkMode = document.body.classList.contains("dark-mode");
  
  // ダークモード用のスタイル
  const bgColor = isDarkMode ? "#2d2d2d" : "#ffffff";
  const textColor = isDarkMode ? "#e0e0e0" : "#1a1a1a";
  const subTextColor = isDarkMode ? "#b0b0b0" : "#666666";
  // 「情報なし」の場合のグレー色
  const unknownStatusColor = isDarkMode ? "#9e9e9e" : "#757575";
  // 営業時間が表示されている場合の黄色
  const hoursStatusBgColor = "#b8860b"; // 落ち着いた黄色
  const hoursStatusTextColor = "#ffffff"; // 白文字
  
  // ステータス表示のスタイルを決定
  let statusBgColor = "";
  let statusTextColor = "";
  if (statusClass === "hours") {
    // 営業時間が表示されている場合（黄色）
    statusBgColor = hoursStatusBgColor;
    statusTextColor = hoursStatusTextColor;
  } else if (statusClass === "open") {
    // 営業中の場合（緑）
    statusBgColor = isDarkMode ? "#2e7d32" : "#4caf50";
    statusTextColor = "#ffffff";
  } else if (statusClass === "closed") {
    // 営業時間外の場合（赤/オレンジ）
    statusBgColor = isDarkMode ? "#c62828" : "#e53935";
    statusTextColor = "#ffffff";
  } else if (statusClass === "unknown") {
    // 情報なしの場合（グレー）
    statusBgColor = isDarkMode ? "#616161" : "#b0b0b0";
    statusTextColor = isDarkMode ? "#e0e0e0" : "#ffffff";
  } else {
    // その他
    statusBgColor = isDarkMode ? "#424242" : "#9e9e9e";
    statusTextColor = "#ffffff";
  }
  
  // InfoWindowのコンテンツを作成（poinavi-infowindow クラスで識別）
  const content = `
    <div class="poinavi-infowindow" style="
      padding: 16px 16px 20px 16px;
      min-width: 240px;
      max-width: 280px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Hiragino Sans', sans-serif;
      background-color: ${bgColor};
      color: ${textColor};
      border-radius: 12px;
    ">
      <div style="
        font-size: 17px;
        font-weight: 600;
        margin-bottom: 8px;
        color: ${textColor};
        line-height: 1.4;
        word-break: break-word;
        padding-right: 24px;
      ">
        ${place.name}
      </div>
      <div style="
        font-size: 14px;
        color: ${subTextColor};
        margin-bottom: 6px;
        line-height: 1.5;
        word-break: break-word;
      ">
        ${address}
      </div>
      <div style="
        font-size: 14px;
        color: ${subTextColor};
        margin-bottom: 6px;
      ">
        現在地からの距離 <span class="distance-value" style="font-size: 21px; color: ${isDarkMode ? '#5a9cff' : '#4285f4'} !important; font-weight: bold;">${distanceText}</span>
      </div>
      <div style="
        font-size: 14px;
        color: ${subTextColor};
        margin-bottom: 10px;
      ">
        ${travelModeLabel} <span class="distance-value" style="font-size: 21px; color: ${isDarkMode ? '#5a9cff' : '#4285f4'} !important; font-weight: bold;">${travelTimeText}</span>
      </div>
      <div style="
        display: inline-block;
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 500;
        background-color: ${statusBgColor};
        color: ${statusTextColor};
        margin-bottom: 12px;
      ">
        ${statusText}
      </div>
      <div style="
        display: flex;
        justify-content: flex-end;
        margin-top: 8px;
      ">
        <button onclick="addPlaceToMemo('${encodeURIComponent(place.name)}', '${encodeURIComponent(address)}', '${distanceText}')" style="
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background-color: ${isDarkMode ? '#34d399' : '#10b981'};
          color: ${isDarkMode ? '#1a1a1a' : '#ffffff'};
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          font-family: inherit;
        ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="12" y1="18" x2="12" y2="12"></line>
            <line x1="9" y1="15" x2="15" y2="15"></line>
          </svg>
          メモに追加
        </button>
      </div>
    </div>
  `;

  // InfoWindowを表示
  infoWindow.setContent(content);
  infoWindow.open(map, marker);
  
  // InfoWindowが画面外に出た場合、見えるように調整
  // Google Mapsの自動調整が完了してから実行するため、idle イベントを使用
  google.maps.event.addListenerOnce(infoWindow, 'domready', function() {
    // Google Mapsの自動パンが完了するのを待つ
    google.maps.event.addListenerOnce(map, 'idle', function() {
      const infoWindowElement = document.querySelector('.gm-style-iw-c');
      if (!infoWindowElement) return;
      
      const infoWindowRect = infoWindowElement.getBoundingClientRect();
      
      // 画面上部に隠れている場合（上端が10px未満）
      if (infoWindowRect.top < 10) {
        const panAmount = Math.abs(infoWindowRect.top) + 30;
        map.panBy(0, -panAmount);
      }
    });
  });
  
  // マーカーにplace情報を保存（テーマ切り替え時に使用）
  if (marker) {
    marker.infoPlace = place;
  }
}

// ============================================
// ルート表示
// ============================================
function displayRoute(origin, destination) {
  console.log("displayRoute呼び出し:", { origin, destination, directionsService: !!directionsService, directionsRenderer: !!directionsRenderer });
  
  if (!directionsService || !directionsRenderer || !origin || !destination) {
    console.error("経路表示に必要な要素が不足しています", {
      directionsService: !!directionsService,
      directionsRenderer: !!directionsRenderer,
      origin: !!origin,
      destination: !!destination
    });
    return;
  }

  // 既存のルートを削除
  directionsRenderer.setDirections({ routes: [] });

  // ダークモードかどうかを判定
  const isDarkMode = document.body.classList.contains("dark-mode");
  
  // 赤丸の配色を取得（50%透過）
  const markerColor = isDarkMode ? "#ff0080" : "#ff1744";
  
  // 経路線のスタイルを設定（赤丸の配色の50%透過）
  directionsRenderer.setOptions({
    polylineOptions: {
      strokeColor: markerColor,
      strokeOpacity: 0.5,
      strokeWeight: 5
    }
  });

  // 経路リクエスト（最短経路のみ）
  const request = {
    origin: origin,
    destination: destination,
    travelMode: google.maps.TravelMode.WALKING, // 徒歩で検索
    unitSystem: google.maps.UnitSystem.METRIC // メートル法
    // alternativesプロパティはDirectionsServiceでは使用できないため削除
  };

  console.log("経路リクエスト送信:", request);
  
  directionsService.route(request, function(result, status) {
    console.log("経路検索結果:", { status, result: !!result });
    if (status === google.maps.DirectionsStatus.OK) {
      // 経路を地図上に表示
      directionsRenderer.setDirections(result);
      console.log("経路を地図上に表示しました");
      
      // 経路表示時はマップのビューを調整しない（InfoWindowが隠れないようにする）
      // InfoWindowが表示されている場合は、その位置を保持するためfitBoundsを実行しない
      if (!infoWindow || !infoWindow.getMap()) {
        // InfoWindowが表示されていない場合のみ、経路に合わせてマップのビューを調整
        const bounds = new google.maps.LatLngBounds();
        // 現在地を追加
        if (userLocation) {
          bounds.extend(userLocation);
        }
        // 経路の各ステップを追加
        result.routes[0].legs[0].steps.forEach((step) => {
          bounds.extend(step.start_location);
          bounds.extend(step.end_location);
        });
        // 目的地も追加
        bounds.extend(destination);
        
        // 設定バーの高さを考慮したパディング
        const settingsBar = document.querySelector('.settings-bar');
        let settingsBarHeight = 0;
        if (settingsBar && !settingsBar.classList.contains('collapsed')) {
          settingsBarHeight = settingsBar.offsetHeight;
        }
        
        map.fitBounds(bounds, {
          top: settingsBarHeight + 20,
          bottom: 20,
          left: 20,
          right: 20
        });
      }
    } else if (status === google.maps.DirectionsStatus.REQUEST_DENIED) {
      console.error("経路検索が拒否されました。Directions APIが有効になっているか確認してください。");
      // アラートを表示せず、Googleマップの経路URLを開く
      const originStr = `${origin.lat},${origin.lng}`;
      const destStr = `${destination.lat},${destination.lng}`;
      const routeUrl = `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destStr}&travelmode=walking`;
      window.open(routeUrl, '_blank');
    } else {
      console.error("経路検索に失敗しました:", status);
      // エラーが発生した場合は、Googleマップの経路URLを開く
      const originStr = `${origin.lat},${origin.lng}`;
      const destStr = `${destination.lat},${destination.lng}`;
      const routeUrl = `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destStr}&travelmode=walking`;
      window.open(routeUrl, '_blank');
    }
  });
}

// ============================================
// ルートをクリア
// ============================================
function clearRoute() {
  if (directionsRenderer) {
    directionsRenderer.setDirections({ routes: [] });
  }
}

// ============================================
// 営業時間から現在時刻と比較して営業中か判定
// ============================================
function checkIfOpenFromWeekdayText(weekdayText) {
  if (!weekdayText || weekdayText.length === 0) {
    return null;
  }

  // 24時間営業を最優先でチェック（全曜日を確認）
  const allText = weekdayText.join(" ").toLowerCase();
  // スペースの有無や全角半角を考慮した判定
  const is24Hours = 
    allText.includes("24 hours") || 
    allText.includes("24時間") || 
    allText.includes("24時間営業") ||
    allText.includes("24 時間") ||  // スペースあり
    allText.includes("24 時間営業") ||  // スペースあり
    allText.match(/24\s*時間/);  // 正規表現で柔軟に検出
  
  if (is24Hours) {
    console.log("24時間営業を検出:", weekdayText, "allText:", allText);
    return true;
  }

  // 「営業中」という文字列が含まれている場合は true を返す
  if (allText.includes("営業中") && !allText.includes("営業終了")) {
    return true;
  }

  const now = new Date();
  const currentDay = now.getDay(); // 0=日曜, 1=月曜, ..., 6=土曜
  const currentTime = now.getHours() * 60 + now.getMinutes(); // 分単位

  // 今日の曜日に対応するテキストを探す
  const dayNameMap = {
    0: ["sunday", "日曜"],
    1: ["monday", "月曜"],
    2: ["tuesday", "火曜"],
    3: ["wednesday", "水曜"],
    4: ["thursday", "木曜"],
    5: ["friday", "金曜"],
    6: ["saturday", "土曜"],
  };

  const todayKeywords = dayNameMap[currentDay];
  const todayText = weekdayText.find((text) => {
    const lowerText = text.toLowerCase();
    return todayKeywords.some((keyword) => lowerText.includes(keyword.toLowerCase()));
  });

  if (!todayText) {
    return null; // 今日の営業時間情報がない
  }

  // 「営業中」という文字列が含まれている場合
  if (todayText.includes("営業中")) {
    // 「営業終了: XX:XX」の形式をチェック
    const closingTimeMatch = todayText.match(/営業終了[：:]\s*(\d{1,2}):(\d{2})/);
    if (closingTimeMatch) {
      const closeHour = parseInt(closingTimeMatch[1], 10);
      const closeMin = parseInt(closingTimeMatch[2], 10);
      const closeTime = closeHour * 60 + closeMin;
      // 現在時刻が営業終了時刻より前なら営業中
      return currentTime < closeTime;
    }
    // 営業終了時刻がなければ営業中と判定
    return true;
  }

  // 営業時間をパース
  // 例: "Monday: 9:00 AM – 5:00 PM" または "月曜: 9:00 – 17:00" または "Monday: Closed"
  
  // 閉店している場合
  if (todayText.toLowerCase().includes("closed") || todayText.includes("閉店") || todayText.includes("定休")) {
    return false;
  }

  // 今日のテキストで24時間営業を再チェック（念のため）
  if (todayText.toLowerCase().includes("24 hours") || todayText.includes("24時間") || todayText.includes("24時間営業")) {
    console.log("今日のテキストで24時間営業を検出:", todayText);
    return true;
  }

  // 時間パターンを抽出
  // パターン1: "9:00 AM – 5:00 PM" 形式
  let timeMatch = todayText.match(/(\d{1,2}):(\d{2})\s*(AM|PM|午前|午後)?\s*[–\-~～]\s*(\d{1,2}):(\d{2})\s*(AM|PM|午前|午後)?/i);
  
  if (!timeMatch) {
    // パターン2: "9:00 – 17:00" 形式（24時間表記）
    timeMatch = todayText.match(/(\d{1,2}):(\d{2})\s*[–\-~～]\s*(\d{1,2}):(\d{2})/);
  }
  
  if (!timeMatch) {
    // パターン3: "8時00分～20時00分" 形式（日本語表記）
    timeMatch = todayText.match(/(\d{1,2})時(\d{2})分\s*[–\-~～]\s*(\d{1,2})時(\d{2})分/);
  }
  
  let isJapaneseFormat = false;
  if (!timeMatch) {
    // パターン4: "8時～20時" 形式（分なし）
    const timeMatch4 = todayText.match(/(\d{1,2})時\s*[–\-~～]\s*(\d{1,2})時/);
    if (timeMatch4) {
      // 分を0として扱う（配列を再構築）
      timeMatch = [timeMatch4[0], timeMatch4[1], "00", timeMatch4[2], "00"];
      isJapaneseFormat = true;
    }
  }

  if (!timeMatch) {
    console.warn("営業時間のパースに失敗:", todayText);
    return null;
  }

  // 時間を抽出
  // 日本語形式（"8時00分～20時00分"）の場合と通常形式（"9:00 AM – 5:00 PM"）の場合で処理を分ける
  let openHour, openMin, openPeriod, closeHour, closeMin, closePeriod;
  
  // 日本語形式かどうかを判定
  // パターン3（"8時00分～20時00分"）の場合: timeMatch[3]は数字（20）
  // パターン4（"8時～20時"）の場合: 既にisJapaneseFormat = trueに設定済み
  if (!isJapaneseFormat) {
    // パターン3でマッチした場合、timeMatch[3]は数字（閉店時刻の時）
    // 通常形式の場合、timeMatch[3]は"AM"や"PM"などの文字列
    isJapaneseFormat = timeMatch[3] && /^\d+$/.test(timeMatch[3]);
  }
  
  if (isJapaneseFormat) {
    // 日本語形式: "8時00分～20時00分" → timeMatch[1]=8, timeMatch[2]=00, timeMatch[3]=20, timeMatch[4]=00
    openHour = parseInt(timeMatch[1], 10);
    openMin = parseInt(timeMatch[2], 10);
    openPeriod = null;
    closeHour = parseInt(timeMatch[3], 10);
    closeMin = parseInt(timeMatch[4], 10);
    closePeriod = null;
  } else {
    // 通常形式: "9:00 AM – 5:00 PM" または "9:00 – 17:00"
    openHour = parseInt(timeMatch[1], 10);
    openMin = parseInt(timeMatch[2], 10);
    openPeriod = timeMatch[3] ? timeMatch[3].toUpperCase() : null;
    closeHour = parseInt(timeMatch[4], 10);
    closeMin = parseInt(timeMatch[5], 10);
    closePeriod = timeMatch[6] ? timeMatch[6].toUpperCase() : null;
  }

  // AM/PM または 午前/午後 を考慮して24時間表記に変換
  if (openPeriod) {
    if (openPeriod.includes("PM") || openPeriod.includes("午後")) {
      if (openHour !== 12) openHour += 12;
    } else if (openPeriod.includes("AM") || openPeriod.includes("午前")) {
      if (openHour === 12) openHour = 0;
    }
  }

  if (closePeriod) {
    if (closePeriod.includes("PM") || closePeriod.includes("午後")) {
      if (closeHour !== 12) closeHour += 12;
    } else if (closePeriod.includes("AM") || closePeriod.includes("午前")) {
      if (closeHour === 12) closeHour = 0;
    }
  }

  const openTime = openHour * 60 + openMin;
  const closeTime = closeHour * 60 + closeMin;

  // 営業時間内かチェック
  // 現在時刻は既に690行目で計算済み（currentTime変数を使用）
  
  console.log(`営業時間判定:`, {
    weekdayText: todayText,
    openTime: `${openHour}:${String(openMin).padStart(2, '0')}`,
    closeTime: `${closeHour}:${String(closeMin).padStart(2, '0')}`,
    currentTime: `${Math.floor(currentTime / 60)}:${String(currentTime % 60).padStart(2, '0')}`,
    openTimeMinutes: openTime,
    closeTimeMinutes: closeTime,
    currentTimeMinutes: currentTime,
    isInRange: closeTime < openTime 
      ? (currentTime >= openTime || currentTime < closeTime)
      : (currentTime >= openTime && currentTime < closeTime)
  });
  
  // 営業時間内かチェック
  if (closeTime < openTime) {
    // 翌日まで営業する場合（深夜営業など）
    const result = currentTime >= openTime || currentTime < closeTime;
    console.log(`営業時間判定結果（深夜営業）: ${result} (${openHour}:${String(openMin).padStart(2, '0')} ～ ${closeHour}:${String(closeMin).padStart(2, '0')}, 現在: ${Math.floor(currentTime / 60)}:${String(currentTime % 60).padStart(2, '0')})`);
    return result;
  } else {
    // 通常の営業時間
    const result = currentTime >= openTime && currentTime < closeTime;
    console.log(`営業時間判定結果: ${result} (${openHour}:${String(openMin).padStart(2, '0')} ～ ${closeHour}:${String(closeMin).padStart(2, '0')}, 現在: ${Math.floor(currentTime / 60)}:${String(currentTime % 60).padStart(2, '0')})`);
    return result;
  }
}

// ============================================
// 今日の営業時間を取得して表示用テキストに変換
// ============================================
function getTodayOpeningHours(weekdayText) {
  if (!weekdayText || weekdayText.length === 0) {
    return null;
  }

  const now = new Date();
  const currentDay = now.getDay(); // 0=日曜, 1=月曜, ..., 6=土曜

  // 今日の曜日に対応するテキストを探す
  const dayNameMap = {
    0: ["sunday", "日曜"],
    1: ["monday", "月曜"],
    2: ["tuesday", "火曜"],
    3: ["wednesday", "水曜"],
    4: ["thursday", "木曜"],
    5: ["friday", "金曜"],
    6: ["saturday", "土曜"],
  };

  const todayKeywords = dayNameMap[currentDay];
  const todayText = weekdayText.find((text) => {
    const lowerText = text.toLowerCase();
    return todayKeywords.some((keyword) => lowerText.includes(keyword.toLowerCase()));
  });

  if (!todayText) {
    return null;
  }

  // 営業時間部分を抽出
  // 例: "Monday: 9:00 AM – 5:00 PM" → "9:00 AM – 5:00 PM"
  // 例: "月曜: 9:00 – 17:00" → "9:00 – 17:00"
  
  // 曜日名とコロンを除去
  let hoursText = todayText;
  
  // 英語の曜日名を除去（より柔軟に）
  hoursText = hoursText.replace(/^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)[：:]\s*/i, "");
  
  // 日本語の曜日名を除去（より柔軟に）
  hoursText = hoursText.replace(/^[日月火水木金土]曜[日]?[：:]\s*/, "");
  
  // 「営業中」などの文字列が含まれている場合も処理
  // 例: "月曜: 営業中 · 営業終了: 15:30" → "営業中 · 営業終了: 15:30"
  
  // 先頭の空白を除去
  hoursText = hoursText.trim();
  
  // 閉店や定休の場合
  if (hoursText.toLowerCase().includes("closed") || 
      (hoursText.includes("閉店") && !hoursText.includes("営業終了")) || 
      hoursText.includes("定休")) {
    return "定休日";
  }
  
  // 24時間営業の場合
  if (hoursText.toLowerCase().includes("24 hours") || 
      hoursText.includes("24時間") || 
      hoursText.includes("24時間営業")) {
    return "24時間営業";
  }
  
  // 「営業中 · 営業終了: XX:XX」の形式の場合
  if (hoursText.includes("営業中")) {
    const closingTimeMatch = hoursText.match(/営業終了[：:]\s*(\d{1,2}):(\d{2})/);
    if (closingTimeMatch) {
      return `営業中（終了: ${closingTimeMatch[1]}:${closingTimeMatch[2]}）`;
    }
    return "営業中";
  }
  
  // 営業時間が抽出できた場合（時間パターンが含まれている）
  if (hoursText.length > 0 && hoursText.match(/\d{1,2}:\d{2}/)) {
    return hoursText;
  }
  
  // 抽出できなかった場合は、元のテキストを返す（短縮版）
  if (hoursText.length > 0) {
    // 長すぎる場合は短縮
    if (hoursText.length > 30) {
      return hoursText.substring(0, 30) + "...";
    }
    return hoursText;
  }
  
  return null;
}

// ============================================
// 距離計算（Haversine formula）
// ============================================
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3; // 地球の半径（メートル）
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // メートル
}

// ============================================
// ルート所要時間の推定
// ============================================
function estimateRoute(distanceMeters) {
  // 移動手段に応じた時間計算
  // 徒歩: 80m/分, 自転車: 250m/分, 車: 500m/分（市街地想定）
  switch (transportMode) {
    case "walk":
      const walkTime = Math.max(1, Math.round(distanceMeters / 80));
      return `徒歩 約${walkTime}分`;
    case "bicycle":
      const bicycleTime = Math.max(1, Math.round(distanceMeters / 250));
      return `自転車 約${bicycleTime}分`;
    case "car":
      const carTime = Math.max(1, Math.round(distanceMeters / 500));
      return `車 約${carTime}分`;
    default:
      const defaultTime = Math.max(1, Math.round(distanceMeters / 80));
      return `徒歩 約${defaultTime}分`;
  }
}

// ============================================
// マーカー削除
// ============================================
function clearMarkers() {
  markers.forEach((marker) => {
    marker.setMap(null);
  });
  markers = [];
}

// ============================================
// 結果なし表示
// ============================================
function displayNoResults(isNeutral = false) {
  const resultsList = document.getElementById("resultsList");
  if (isNeutral) {
    // ニュートラル状態：結果リスト自体を非表示
    resultsList.innerHTML = '';
    resultsList.style.display = 'none';
  } else {
    resultsList.style.display = '';
    resultsList.innerHTML = '<div class="result-item">該当する場所が見つかりませんでした</div>';
  }
  clearMarkers();
}

// ============================================
// RainViewer 雨雲レーダー機能
// ============================================

// RainViewer レイヤーを追加
async function addRainViewerLayer() {
  if (!map) {
    console.warn("マップが初期化されていません");
    return null;
  }

  try {
    // RainViewer API から最新のレーダーフレームを取得
    const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const data = await res.json();

    // radar.past の最後の要素（最新の観測データ）を取得
    const frames = data.radar.past;
    if (!frames || frames.length === 0) {
      console.warn("RainViewer: レーダーフレームが見つかりません");
      return null;
    }
    const frame = frames[frames.length - 1];

    // ImageMapType を作成
    rainViewerLayer = new google.maps.ImageMapType({
      getTileUrl: function(coord, zoom) {
        return `https://tilecache.rainviewer.com/v2/radar/${frame.path}/${zoom}/${coord.x}/${coord.y}/256/png`;
      },
      tileSize: new google.maps.Size(256, 256),
      opacity: 0.5,
      name: "RainViewer"
    });

    // overlayMapTypes に追加
    map.overlayMapTypes.push(rainViewerLayer);
    rainViewerLayerIndex = map.overlayMapTypes.getLength() - 1;

    console.log("RainViewer レイヤーを追加しました", {
      framePath: frame.path,
      timestamp: new Date(frame.time * 1000).toLocaleString()
    });

    return rainViewerLayer;
  } catch (error) {
    console.error("RainViewer レイヤーの追加に失敗しました:", error);
    return null;
  }
}

// RainViewer レイヤーを削除
function removeRainViewerLayer() {
  if (!map) return;

  // overlayMapTypes から削除
  if (rainViewerLayerIndex >= 0 && rainViewerLayerIndex < map.overlayMapTypes.getLength()) {
    map.overlayMapTypes.setAt(rainViewerLayerIndex, null);
  }

  // 配列全体をクリアして null を除去
  const length = map.overlayMapTypes.getLength();
  for (let i = length - 1; i >= 0; i--) {
    if (map.overlayMapTypes.getAt(i) === null) {
      map.overlayMapTypes.removeAt(i);
    }
  }

  rainViewerLayer = null;
  rainViewerLayerIndex = -1;

  console.log("RainViewer レイヤーを削除しました");
}

// RainViewer 表示/非表示をトグル
async function toggleRainViewer() {
  const toggleBtn = document.getElementById("rainViewerToggle");
  const statusPanel = document.getElementById("rainViewerStatus");

  if (rainViewerEnabled) {
    // 非表示にする
    removeRainViewerLayer();
    rainViewerEnabled = false;

    // UI を更新
    if (toggleBtn) {
      toggleBtn.classList.remove("active");
      toggleBtn.setAttribute("aria-pressed", "false");
    }
    if (statusPanel) {
      statusPanel.classList.add("hidden");
    }

    console.log("雨雲レーダーをOFFにしました");
  } else {
    // 表示する
    if (toggleBtn) {
      toggleBtn.classList.add("loading");
    }

    const layer = await addRainViewerLayer();

    if (layer) {
      rainViewerEnabled = true;

      // UI を更新
      if (toggleBtn) {
        toggleBtn.classList.add("active");
        toggleBtn.classList.remove("loading");
        toggleBtn.setAttribute("aria-pressed", "true");
      }
      if (statusPanel) {
        statusPanel.classList.remove("hidden");
      }

      console.log("雨雲レーダーをONにしました");
    } else {
      // エラー時
      if (toggleBtn) {
        toggleBtn.classList.remove("loading");
      }
      console.warn("雨雲レーダーの表示に失敗しました");
    }
  }
}

// RainViewer 初期化（イベントリスナー設定）
function initRainViewer() {
  const toggleBtn = document.getElementById("rainViewerToggle");

  if (toggleBtn) {
    toggleBtn.addEventListener("click", function() {
      toggleRainViewer();
    });
  }
}

// ============================================
// 鉄道レイヤー機能（Overpass API）
// ============================================

// 鉄道レイヤー初期化
function initRailwayLayer() {
  const toggleBtn = document.getElementById("railwayToggle");

  if (toggleBtn) {
    toggleBtn.addEventListener("click", function() {
      toggleRailwayLayer();
    });
  }
}

// 鉄道レイヤー表示/非表示をトグル
async function toggleRailwayLayer() {
  const toggleBtn = document.getElementById("railwayToggle");
  const statusPanel = document.getElementById("railwayStatus");

  if (railwayEnabled) {
    // 非表示にする
    clearRailwayLayer();
    railwayEnabled = false;

    // UI を更新
    if (toggleBtn) {
      toggleBtn.classList.remove("active");
      toggleBtn.setAttribute("aria-pressed", "false");
    }
    if (statusPanel) {
      statusPanel.classList.add("hidden");
    }

    console.log("鉄道レイヤーをOFFにしました");
  } else {
    // 表示する
    if (!userLocation) {
      alert("現在地を取得してから鉄道レイヤーを表示してください");
      return;
    }

    const loadingPanel = document.getElementById("railwayLoading");
    const loadingOverlay = document.getElementById("railwayLoadingOverlay");

    if (toggleBtn) {
      toggleBtn.classList.add("loading");
    }
    // ローディング表示
    if (loadingPanel) {
      loadingPanel.classList.remove("hidden");
    }
    // オーバーレイ表示（操作を防止）
    if (loadingOverlay) {
      loadingOverlay.classList.remove("hidden");
    }

    try {
      await fetchAndDisplayRailwayData();
      railwayEnabled = true;

      // UI を更新
      if (toggleBtn) {
        toggleBtn.classList.add("active");
        toggleBtn.classList.remove("loading");
        toggleBtn.setAttribute("aria-pressed", "true");
      }
      // ローディング非表示、ステータス表示
      if (loadingPanel) {
        loadingPanel.classList.add("hidden");
      }
      // オーバーレイ非表示
      if (loadingOverlay) {
        loadingOverlay.classList.add("hidden");
      }
      if (statusPanel) {
        statusPanel.classList.remove("hidden");
      }

      console.log("鉄道レイヤーをONにしました");
    } catch (error) {
      console.error("鉄道データの取得に失敗しました:", error);
      if (toggleBtn) {
        toggleBtn.classList.remove("loading");
      }
      // ローディング非表示
      if (loadingPanel) {
        loadingPanel.classList.add("hidden");
      }
      // オーバーレイ非表示
      if (loadingOverlay) {
        loadingOverlay.classList.add("hidden");
      }
      alert("鉄道データの取得に失敗しました。しばらく経ってから再度お試しください。");
    }
  }
}

// Overpass API から鉄道データを取得して表示
async function fetchAndDisplayRailwayData() {
  // キャッシュが有効かチェック（位置が1km以上移動していなければ使用）
  if (railwayDataCache && railwayCacheLocation) {
    const distance = calculateDistance(
      railwayCacheLocation.lat,
      railwayCacheLocation.lng,
      userLocation.lat,
      userLocation.lng
    );
    if (distance < 1000) {
      console.log("キャッシュされた鉄道データを使用");
      displayRailwayData(railwayDataCache);
      return;
    }
  }

  const lat = userLocation.lat;
  const lng = userLocation.lng;

  // Overpass API クエリ
  const query = `
    [out:json][timeout:25];
    (
      way["railway"="rail"](around:${RAILWAY_RADIUS},${lat},${lng});
      node["railway"="station"](around:${RAILWAY_RADIUS},${lat},${lng});
    );
    out geom;
  `;

  const url = "https://overpass-api.de/api/interpreter";

  console.log("Overpass API クエリ送信:", { lat, lng, radius: RAILWAY_RADIUS });

  const response = await fetch(url, {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  console.log("Overpass API レスポンス:", {
    elements: data.elements?.length || 0
  });

  // キャッシュに保存
  railwayDataCache = data;
  railwayCacheLocation = { ...userLocation };

  // データを表示
  displayRailwayData(data);
}

// 鉄道データを地図に表示
function displayRailwayData(data) {
  if (!data || !data.elements) {
    console.warn("鉄道データが空です");
    return;
  }

  // 既存のレイヤーをクリア
  clearRailwayLayer();

  const isDarkMode = document.body.classList.contains("dark-mode");
  
  // 路線の色（複数の色を用意して路線ごとに変える）
  const lineColors = isDarkMode
    ? ["#34d399", "#60a5fa", "#f472b6", "#fbbf24", "#a78bfa"]
    : ["#10b981", "#3b82f6", "#ec4899", "#f59e0b", "#8b5cf6"];

  // 路線をグループ化するためのマップ
  const railwayLines = new Map();
  const stations = [];

  // データを分類
  data.elements.forEach((element) => {
    if (element.type === "way" && element.geometry) {
      // 路線データ
      const lineName = element.tags?.name || element.tags?.ref || "不明な路線";
      if (!railwayLines.has(lineName)) {
        railwayLines.set(lineName, []);
      }
      railwayLines.get(lineName).push(element);
    } else if (element.type === "node" && element.tags?.railway === "station") {
      // 駅データ
      stations.push(element);
    }
  });

  console.log(`路線数: ${railwayLines.size}, 駅数: ${stations.length}`);

  // 路線を描画
  let colorIndex = 0;
  railwayLines.forEach((ways, lineName) => {
    const color = lineColors[colorIndex % lineColors.length];
    colorIndex++;

    ways.forEach((way) => {
      // 座標を間引き（パフォーマンス向上）
      const coordinates = simplifyCoordinates(way.geometry, 0.0002);
      
      const path = coordinates.map((coord) => ({
        lat: coord.lat,
        lng: coord.lon
      }));

      const polyline = new google.maps.Polyline({
        path: path,
        strokeColor: color,
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: map
      });

      // クリックで路線名を表示
      polyline.addListener("click", function(e) {
        showRailwayInfoWindow(e.latLng, lineName, "路線");
      });

      railwayPolylines.push(polyline);
    });
  });

  // 駅を描画
  stations.forEach((station) => {
    const stationName = station.tags?.name || "不明な駅";
    const operator = station.tags?.operator || "";
    const lines = station.tags?.railway_line || station.tags?.["railway:ref"] || "";

    // 駅マーカー
    const marker = new google.maps.Marker({
      position: { lat: station.lat, lng: station.lon },
      map: map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: isDarkMode ? "#ffffff" : "#1a1a1a",
        fillOpacity: 1,
        strokeColor: isDarkMode ? "#10b981" : "#059669",
        strokeWeight: 3
      },
      title: stationName
    });

    // クリックで駅情報を表示
    marker.addListener("click", function() {
      let info = stationName;
      if (operator) info += `<br>事業者: ${operator}`;
      if (lines) info += `<br>路線: ${lines}`;
      showRailwayInfoWindow(marker.getPosition(), info, "駅");
    });

    stationMarkers.push(marker);
  });
}

// 座標を間引き（Douglas-Peucker 簡易版）
function simplifyCoordinates(coords, tolerance) {
  if (!coords || coords.length <= 2) return coords;
  
  const result = [coords[0]];
  let prevCoord = coords[0];
  
  for (let i = 1; i < coords.length - 1; i++) {
    const coord = coords[i];
    const distance = Math.sqrt(
      Math.pow(coord.lat - prevCoord.lat, 2) +
      Math.pow(coord.lon - prevCoord.lon, 2)
    );
    
    if (distance > tolerance) {
      result.push(coord);
      prevCoord = coord;
    }
  }
  
  result.push(coords[coords.length - 1]);
  return result;
}

// 鉄道用InfoWindowを表示
function showRailwayInfoWindow(position, content, type) {
  if (!railwayInfoWindow) {
    railwayInfoWindow = new google.maps.InfoWindow();
  }

  const isDarkMode = document.body.classList.contains("dark-mode");
  const bgColor = isDarkMode ? "#2d2d2d" : "#ffffff";
  const textColor = isDarkMode ? "#e0e0e0" : "#1a1a1a";
  const accentColor = isDarkMode ? "#34d399" : "#10b981";
  
  // メモ用のテキスト（HTMLタグを除去）
  const plainContent = content.replace(/<br>/g, '\n').replace(/<[^>]*>/g, '');

  const html = `
    <div style="
      padding: 12px 16px;
      min-width: 150px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Hiragino Sans', sans-serif;
      background-color: ${bgColor};
      color: ${textColor};
      border-radius: 8px;
    ">
      <div style="
        font-size: 11px;
        font-weight: 600;
        color: ${accentColor};
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      ">${type}</div>
      <div style="
        font-size: 14px;
        font-weight: 500;
        line-height: 1.5;
        margin-bottom: 12px;
      ">${content}</div>
      <div style="
        display: flex;
        justify-content: flex-end;
      ">
        <button onclick="addRailwayToMemo('${encodeURIComponent(type)}', '${encodeURIComponent(plainContent)}')" style="
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background-color: ${isDarkMode ? '#34d399' : '#10b981'};
          color: ${isDarkMode ? '#1a1a1a' : '#ffffff'};
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          font-family: inherit;
        ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="12" y1="18" x2="12" y2="12"></line>
            <line x1="9" y1="15" x2="15" y2="15"></line>
          </svg>
          メモに追加
        </button>
      </div>
    </div>
  `;

  railwayInfoWindow.setContent(html);
  railwayInfoWindow.setPosition(position);
  railwayInfoWindow.open(map);
}

// 鉄道レイヤーをクリア
function clearRailwayLayer() {
  // ポリラインを削除
  railwayPolylines.forEach((polyline) => {
    polyline.setMap(null);
  });
  railwayPolylines = [];

  // 駅マーカーを削除
  stationMarkers.forEach((marker) => {
    marker.setMap(null);
  });
  stationMarkers = [];

  // InfoWindowを閉じる
  if (railwayInfoWindow) {
    railwayInfoWindow.close();
  }
}
