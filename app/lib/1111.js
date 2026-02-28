_initApproverDialogModel: function () {
  const oDlgModel = new sap.ui.model.json.JSONModel({
    token: 0,
    busy: false,
    selected: {
      approver1: { id: "", name: "" },
      approver2: { id: "", name: "" },
      approver3: { id: "", name: "" }
    },
    options: {
      approver1: [],
      approver2: [],
      approver3: []
    }
  });

  this.getView().setModel(oDlgModel, "dlg");
},

/* =========================================================== */
/* 承認者ダイアログ用Model初期化                                */
/* =========================================================== */
_initApproverDialogModel: function () {

  // ダイアログ専用JSONModel作成
  const oDlgModel = new sap.ui.model.json.JSONModel({

    token: 0, // 非同期競合防止用トークン

    busy: false, // BusyIndicator表示制御

    // 選択された承認者（初期値・ユーザー選択値）
    selected: {

      approver1: { id: "", name: "" },

      approver2: { id: "", name: "" },

      approver3: { id: "", name: "" }

    },

    // DBから取得した候補一覧（Selectのitems用）
    options: {

      approver1: [],

      approver2: [],

      approver3: []

    }

  });

  this.getView().setModel(oDlgModel, "dlg");

},

/* =========================================================== */
/* ダイアログ表示処理                                          */
/* =========================================================== */
onOpenApproverDialog: async function () {

  // Fragment存在保証
  await this._ensureApproverDialog();

  const oDM = this.getView().getModel("dlg");

  // 新しいトークン生成（非同期競合防止）
  const token = (oDM.getProperty("/token") || 0) + 1;

  oDM.setProperty("/token", token);

  oDM.setProperty("/busy", true);

  // 一覧画面の選択行取得
  const aSelectedRows = this._getSelectedRows();

  // ローカルキャッシュ取得
  const oCache = this._loadApproverCache();

  // 初期表示用承認者決定
  const oDefaultSelected =
    this._calcDefaultApprovers(aSelectedRows, oCache);

  // 即時表示（DB取得前に表示する）
  oDM.setProperty("/selected", oDefaultSelected);

  /* ======================================================= */
  /* DBから候補取得                                          */
  /* ======================================================= */

  let oDbOptions;

  try {

    oDbOptions =
      await this._fetchApproverCandidatesFromBackend(aSelectedRows);

  }
  catch (e) {

    // エラー時は空
    oDbOptions = {

      approver1: [],

      approver2: [],

      approver3: []

    };

  }

  // 古いリクエスト結果を破棄
  if (oDM.getProperty("/token") !== token) return;

  // DB候補のみ設定（キャッシュ値は含めない）
  oDM.setProperty(
    "/options",
    this._mergeOptions(oDbOptions)
  );

  oDM.setProperty("/busy", false);

  // ダイアログ表示
  this._byId("ApproverDialog").open();

},

/* =========================================================== */
/* ダイアログ閉じる                                            */
/* =========================================================== */
onApproverDialogClose: function () {

  this._byId("ApproverDialog").close();

},

/* =========================================================== */
/* 保存ボタン処理                                              */
/* =========================================================== */
onApproverDialogSubmit: function () {

  // 入力チェック
  const v = this._validateApproversBeforeSubmit();

  if (!v.ok) {

    sap.m.MessageToast.show(v.msg);

    return;

  }

  // 候補一覧からID+Name取得
  const a1 = this._pickIdNameFromOptions("approver1");

  const a2 = this._pickIdNameFromOptions("approver2");

  const a3 = this._pickIdNameFromOptions("approver3");

  // Backend送信用Payload
  const payload = {

    approver1Id: a1.id,

    approver1Name: a1.name,

    approver2Id: a2.id,

    approver2Name: a2.name,

    approver3Id: a3.id,

    approver3Name: a3.name

  };

  // キャッシュ保存
  this._saveApproverCache({

    approver1: a1,

    approver2: a2,

    approver3: a3

  });

  // Backend送信処理（既存処理呼び出し）
  this._submitApply(payload);

  this._byId("ApproverDialog").close();

},

/* =========================================================== */
/* 入力チェック                                                */
/* =========================================================== */
_validateApproversBeforeSubmit: function () {

  const oDM = this.getView().getModel("dlg");

  const id1 =
    oDM.getProperty("/selected/approver1/id") || "";

  // 承認者1必須チェック
  if (!id1)
    return { ok: false, msg: "承認者1は必須です。" };

  // 候補内存在チェック
  if (!this._isSelectedInOptions("approver1"))
    return { ok: false, msg: "承認者1は候補から選択してください。" };

  const id2 =
    oDM.getProperty("/selected/approver2/id") || "";

  if (id2 &&
      !this._isSelectedInOptions("approver2"))
    return { ok: false, msg: "承認者2は候補から選択してください。" };

  const id3 =
    oDM.getProperty("/selected/approver3/id") || "";

  if (id3 &&
      !this._isSelectedInOptions("approver3"))
    return { ok: false, msg: "承認者3は候補から選択してください。" };

  return { ok: true };

},

/* =========================================================== */
/* 候補内存在チェック                                          */
/* =========================================================== */
_isSelectedInOptions: function (slot) {

  const oDM = this.getView().getModel("dlg");

  const id =
    oDM.getProperty(`/selected/${slot}/id`);

  if (!id) return true;

  const list =
    oDM.getProperty(`/options/${slot}`) || [];

  return list.some(x => x.id === id);

},

/* =========================================================== */
/* 候補一覧からID+Name取得                                     */
/* =========================================================== */
_pickIdNameFromOptions: function (slot) {

  const oDM = this.getView().getModel("dlg");

  const id =
    oDM.getProperty(`/selected/${slot}/id`);

  if (!id) return { id: "", name: "" };

  const list =
    oDM.getProperty(`/options/${slot}`);

  const hit =
    list.find(x => x.id === id);

  return hit;

},

/* =========================================================== */
/* 初期承認者決定ロジック                                      */
/* =========================================================== */
_calcDefaultApprovers:
function (rows, cache) {

  const single =
    rows.length === 1;

  const row =
    single ? rows[0] : null;

  const pick = (slot) => {

    // 行データ優先
    const fromRow =
      row && row[slot];

    // キャッシュ
    const fromCache =
      cache && cache[slot];

    const v =
      single && fromRow
        ? fromRow
        : fromCache;

    return v || { id: "", name: "" };

  };

  return {

    approver1: pick("approver1"),

    approver2: pick("approver2"),

    approver3: pick("approver3")

  };

},

/* =========================================================== */
/* 候補一覧重複除去                                            */
/* =========================================================== */
_mergeOptions: function (db) {

  const norm =
    (slot) =>
      this._uniqueById(db[slot] || []);

  return {

    approver1: norm("approver1"),

    approver2: norm("approver2"),

    approver3: norm("approver3")

  };

},

_uniqueById: function (list) {

  const m = new Map();

  list.forEach(o =>
    m.set(o.id, o));

  return Array.from(m.values());

},

/* =========================================================== */
/* キャッシュ処理                                              */
/* =========================================================== */
_loadApproverCache: function () {

  try {

    return JSON.parse(
      localStorage.getItem(
        "APPROVER_CACHE_V1"
      )
    );

  }
  catch {

    return null;

  }

},

_saveApproverCache: function (data) {

  localStorage.setItem(
    "APPROVER_CACHE_V1",
    JSON.stringify(data)
  );

}