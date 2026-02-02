const cds = require('@sap/cds');

/**
 * BPA連携サービス
 * BPAとの通信を共通化
 */
class BPAService {
  constructor() {
    this.destination = null;
  }

  /**
   * 初期化（Destinationを取得）
   */
  async init() {
    if (!this.destination) {
      this.destination = await cds.connect.to('BPAService');
    }
    return this.destination;
  }

  /**
   * 申請一覧を取得
   * @param {Object} query - 検索条件
   * @returns {Array} 申請データ配列
   */
  async getApplications(query) {
    await this.init();
    
    try {
      // BPAのOData APIを呼び出し
      const filter = this.buildFilter(query);
      const response = await this.destination.run(
        SELECT.from('Applications').where(filter)
      );
      
      return this.transformApplicationList(response);
    } catch (error) {
      console.error('BPA申請一覧取得エラー:', error);
      throw new Error(`BPAからの申請一覧取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * 申請詳細を取得
   * @param {String} applicationId - 申請ID
   * @returns {Object} 申請詳細データ
   */
  async getApplicationDetail(applicationId) {
    await this.init();
    
    try {
      const response = await this.destination.run(
        SELECT.one.from('Applications').where({ applicationId })
      );
      
      if (!response) {
        throw new Error(`申請ID ${applicationId} が見つかりません`);
      }
      
      return this.transformApplicationDetail(response);
    } catch (error) {
      console.error('BPA申請詳細取得エラー:', error);
      throw new Error(`BPAからの申請詳細取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * 申請検索
   * @param {Object} filters - 検索フィルタ
   * @returns {Array} 検索結果
   */
  async searchApplications(filters) {
    await this.init();
    
    try {
      const filter = this.buildSearchFilter(filters);
      const response = await this.destination.run(
        SELECT.from('Applications').where(filter)
      );
      
      return this.transformApplicationList(response);
    } catch (error) {
      console.error('BPA申請検索エラー:', error);
      throw new Error(`申請検索に失敗しました: ${error.message}`);
    }
  }

  /**
   * コメント取得
   * @param {String} applicationId - 申請ID
   * @returns {Array} コメント配列
   */
  async getComments(applicationId) {
    await this.init();
    
    try {
      const response = await this.destination.run(
        SELECT.from('Comments').where({ applicationId })
      );
      
      return response || [];
    } catch (error) {
      console.error('BPAコメント取得エラー:', error);
      return [];
    }
  }

  /**
   * 承認履歴取得
   * @param {String} applicationId - 申請ID
   * @returns {Array} 承認履歴配列
   */
  async getApprovalHistory(applicationId) {
    await this.init();
    
    try {
      const response = await this.destination.run(
        SELECT.from('ApprovalHistory').where({ applicationId }).orderBy('actionDate desc')
      );
      
      return response || [];
    } catch (error) {
      console.error('BPA承認履歴取得エラー:', error);
      return [];
    }
  }

  /**
   * 承認者設定情報取得
   * @param {String} applicationId - 申請ID
   * @returns {Array} 承認者配列
   */
  async getApprovers(applicationId) {
    await this.init();
    
    try {
      const response = await this.destination.run(
        SELECT.from('Approvers').where({ applicationId }).orderBy('sequence')
      );
      
      return response || [];
    } catch (error) {
      console.error('BPA承認者情報取得エラー:', error);
      return [];
    }
  }

  /**
   * 申請提出
   * @param {String} applicationId - 申請ID
   * @returns {Object} 結果
   */
  async submitApplication(applicationId) {
    await this.init();
    
    try {
      // BPAのカスタムアクションを呼び出し
      const response = await this.destination.send({
        method: 'POST',
        path: `/Applications('${applicationId}')/Submit`,
        data: {}
      });
      
      return response;
    } catch (error) {
      console.error('BPA申請提出エラー:', error);
      throw new Error(`申請の提出に失敗しました: ${error.message}`);
    }
  }

  /**
   * 引き戻し
   * @param {String} applicationId - 申請ID
   * @returns {Object} 結果
   */
  async withdrawApplication(applicationId) {
    await this.init();
    
    try {
      const response = await this.destination.send({
        method: 'POST',
        path: `/Applications('${applicationId}')/Withdraw`,
        data: {}
      });
      
      return response;
    } catch (error) {
      console.error('BPA引き戻しエラー:', error);
      throw new Error(`引き戻しに失敗しました: ${error.message}`);
    }
  }

  /**
   * 破棄
   * @param {String} applicationId - 申請ID
   * @returns {Object} 結果
   */
  async discardApplication(applicationId) {
    await this.init();
    
    try {
      const response = await this.destination.send({
        method: 'POST',
        path: `/Applications('${applicationId}')/Discard`,
        data: {}
      });
      
      return response;
    } catch (error) {
      console.error('BPA破棄エラー:', error);
      throw new Error(`破棄に失敗しました: ${error.message}`);
    }
  }

  /**
   * 承認
   * @param {String} applicationId - 申請ID
   * @param {String} comment - コメント
   * @returns {Object} 結果
   */
  async approveApplication(applicationId, comment) {
    await this.init();
    
    try {
      const response = await this.destination.send({
        method: 'POST',
        path: `/Applications('${applicationId}')/Approve`,
        data: { comment }
      });
      
      return response;
    } catch (error) {
      console.error('BPA承認エラー:', error);
      throw new Error(`承認に失敗しました: ${error.message}`);
    }
  }

  /**
   * 却下
   * @param {String} applicationId - 申請ID
   * @param {String} comment - コメント
   * @returns {Object} 結果
   */
  async rejectApplication(applicationId, comment) {
    await this.init();
    
    try {
      const response = await this.destination.send({
        method: 'POST',
        path: `/Applications('${applicationId}')/Reject`,
        data: { comment }
      });
      
      return response;
    } catch (error) {
      console.error('BPA却下エラー:', error);
      throw new Error(`却下に失敗しました: ${error.message}`);
    }
  }

  /**
   * 申請同期
   * @param {String} applicationId - 申請ID
   * @returns {Object} 結果
   */
  async syncApplication(applicationId) {
    await this.init();
    
    try {
      // BPAから最新データを取得して同期
      const detail = await this.getApplicationDetail(applicationId);
      const comments = await this.getComments(applicationId);
      const history = await this.getApprovalHistory(applicationId);
      const approvers = await this.getApprovers(applicationId);
      
      return {
        detail,
        comments,
        history,
        approvers
      };
    } catch (error) {
      console.error('BPA同期エラー:', error);
      throw new Error(`同期に失敗しました: ${error.message}`);
    }
  }

  // ==================== プライベートメソッド ====================

  /**
   * クエリからフィルタを構築
   */
  buildFilter(query) {
    const filters = [];
    
    if (query.SELECT?.where) {
      return query.SELECT.where;
    }
    
    return filters;
  }

  /**
   * 検索フィルタを構築
   */
  buildSearchFilter(filters) {
    const conditions = [];
    
    if (filters.status) {
      conditions.push({ status: filters.status });
    }
    if (filters.type) {
      conditions.push({ type: filters.type });
    }
    if (filters.companyCode) {
      conditions.push({ companyCode: filters.companyCode });
    }
    if (filters.startDate) {
      conditions.push({ startDate: { '>=': filters.startDate } });
    }
    if (filters.endDate) {
      conditions.push({ endDate: { '<=': filters.endDate } });
    }
    if (filters.requester) {
      conditions.push({ requester: { like: `%${filters.requester}%` } });
    }
    
    return conditions.length > 0 ? { and: conditions } : {};
  }

  /**
   * 申請一覧データを変換
   */
  transformApplicationList(data) {
    if (!Array.isArray(data)) {
      return [];
    }
    
    return data.map(item => ({
      ID: item.ID,
      applicationId: item.applicationId,
      status_code: item.status,
      type_code: item.type,
      companyCode: item.companyCode,
      companyName: item.companyName,
      fiscalYear: item.fiscalYear,
      startDate: item.startDate,
      endDate: item.endDate,
      dueDate: item.dueDate,
      requester: item.requester,
      amount: item.amount,
      currency: item.currency,
      hasDocuments: item.hasDocuments,
      attachmentCount: item.attachmentCount
    }));
  }

  /**
   * 申請詳細データを変換
   */
  transformApplicationDetail(data) {
    return {
      ID: data.ID,
      applicationId: data.applicationId,
      status_code: data.status,
      type_code: data.type,
      companyCode: data.companyCode,
      companyName: data.companyName,
      fiscalYear: data.fiscalYear,
      startDate: data.startDate,
      endDate: data.endDate,
      dueDate: data.dueDate,
      requester: data.requester,
      amount: data.amount,
      currency: data.currency,
      hasDocuments: data.hasDocuments,
      attachmentCount: data.attachmentCount
    };
  }
}

module.exports = BPAService;