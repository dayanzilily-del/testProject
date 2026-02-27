
class IASService {
  constructor() {
    this.destination = null;

    // ===== 調整可能パラメータ =====
    this.DEST_NAME = "IAS_DEST"; // Destination 名
    this.PAGE_SIZE = 100;        // IAS 最大値は 100
    this.CACHE_TTL_MS = 5 * 60 * 1000; // キャッシュ有効時間（5分）
    // ===========================

    // IAS カスタム拡張スキーマ
    this.EXT_CUSTOM = "urn:sap:cloud:scim:schemas:extension:custom:2.0:User";

    // 取得する項目（通信量削減のため必要最小限）
    this.USER_ATTRS = [
      "userName",
      "displayName",
      this.EXT_CUSTOM
    ];

    // キャッシュ領域
    this._cache = {
      ts: 0,
      users: null
    };
  }

  // Destination 初期化
  async init() {
    if (!this.destination) {
      const cds = require("@sap/cds");
      this.destination = await cds.connect.to(this.DEST_NAME);
    }
    return this.destination;
  }

  // 共通ヘッダ
  _headers() {
    return { Accept: "application/scim+json" };
  }

  // Users API 用パス作成
  _buildUsersPath(paramsObj) {
    const qs = Object.entries(paramsObj)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join("&");
    return `/Users?${qs}`;
  }

  // customAttribute1 から会社名取得
  _getCompanyValue(user) {
    const ext = user?.[this.EXT_CUSTOM];
    const attrs = ext?.attributes || [];
    const a = attrs.find(x => x?.name === "customAttribute1");
    return a?.value;
  }

  // 返却用フォーマット変換
  _mapLite(user) {
    return {
      displayName: user.displayName,
      userName: user.userName
    };
  }

  // キャッシュ有効判定
  _isCacheValid() {
    return (
      this._cache.users &&
      Date.now() - this._cache.ts < this.CACHE_TTL_MS
    );
  }

  // キャッシュ保存
  _setCache(users) {
    this._cache.ts = Date.now();
    this._cache.users = users;
  }

  // キャッシュクリア
  _clearCache() {
    this._cache.ts = 0;
    this._cache.users = null;
  }

  // HTTP 実行
  async _send(path) {
    await this.init();
    return await this.destination.send({
      method: "GET",
      path,
      headers: this._headers()
    });
  }

  // ========= cursor ページング（推奨方式） =========
  async _fetchAllUsersByCursor() {

    const attrs = this.USER_ATTRS.join(",");
    const all = [];

    let cursor = ""; // 初回は空
    let safety = 0;

    while (true) {

      safety++;
      if (safety > 200) break; // 異常時の無限ループ防止

      const path = this._buildUsersPath({
        cursor,
        count: this.PAGE_SIZE,
        attributes: attrs
      });

      const res = await this._send(path);

      const users = res?.Resources || [];
      all.push(...users);

      // 次ページ cursor 取得
      const nextCursor =
        res?.nextCursor ||
        res?.NextCursor ||
        res?.next_cursor ||
        null;

      if (nextCursor) {
        cursor = nextCursor;
        continue;
      }

      // 最終ページ判定
      if (users.length < this.PAGE_SIZE) break;

      // cursor 非対応の可能性 → fallback
      if (users.length === this.PAGE_SIZE && safety === 1) {

        const err = new Error("Cursor pagination unsupported");
        err.code = "CURSOR_UNSUPPORTED";
        throw err;

      }
    }

    return all;
  }

  // ========= startIndex ページング（フォールバック） =========
  async _fetchAllUsersByStartIndex() {

    const attrs = this.USER_ATTRS.join(",");
    const all = [];

    let startIndex = 1;
    let totalResults = Infinity;
    let safety = 0;

    while (startIndex <= totalResults) {

      safety++;
      if (safety > 200) break;

      const path = this._buildUsersPath({
        startIndex,
        count: this.PAGE_SIZE,
        attributes: attrs
      });

      const res = await this._send(path);

      const users = res?.Resources || [];
      all.push(...users);

      totalResults = Number(res?.totalResults ?? 0);

      if (users.length === 0) break;

      startIndex += this.PAGE_SIZE;

    }

    return all;
  }

  // ========= 全ユーザ取得（キャッシュ対応） =========
  async getAllUsers({ forceRefresh = false } = {}) {

    if (!forceRefresh && this._isCacheValid()) {
      return this._cache.users;
    }

    let users;

    try {

      users = await this._fetchAllUsersByCursor();

    } catch {

      users = await this._fetchAllUsersByStartIndex();

    }

    this._setCache(users);

    return users;
  }

  // ========= 会社名でユーザ検索 =========
  async getUsersByCompany(companyName, { forceRefresh = false } = {}) {

    if (!companyName) return [];

    const users = await this.getAllUsers({ forceRefresh });

    return users
      .filter(u => this._getCompanyValue(u) === companyName)
      .map(u => this._mapLite(u));
  }

  // キャッシュ無効化
  invalidateCache() {
    this._clearCache();
  }
}

module.exports = IASService;




