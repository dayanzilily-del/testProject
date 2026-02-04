const { getDestination } = require('@sap-cloud-sdk/connectivity');
const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');

/**
 * BPA連携サービス（Destination使用版）
 * @sap-cloud-sdk/connectivity を使用してDestinationから認証情報を取得
 */
class BPAService {
  constructor() {
    this.destinationName = 'BPA_DEST';
    this.destination = null;
  }

  /**
   * Destinationを取得して初期化
   */
  async init() {
    if (!this.destination) {
      try {
        // Destinationサービスから認証情報を含む設定を取得
        this.destination = await getDestination({
          destinationName: this.destinationName
        });
        
        console.log(`✓ BPA Destination "${this.destinationName}" loaded successfully`);
      } catch (error) {
        console.error('BPA Destination取得エラー:', error);
        throw new Error(`Destination "${this.destinationName}" の取得に失敗しました`);
      }
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
      // executeHttpRequestを使用してOData APIを呼び出し
      // Destinationの認証情報（OAuth, Basic Auth等）が自動的に使用される
      const response = await executeHttpRequest(
        this.destination,
        {
          method: 'GET',
          url: '/Applications',
          params: this.buildQueryParams(query)
        }
      );
      
      return this.transformApplicationList(response.data?.value || response.data?.d?.results || []);
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
      const response = await executeHttpRequest(
        this.destination,
        {
          method: 'GET',
          url: `/Applications('${applicationId}')`,
          params: {
            $expand: 'status,type,approvers,comments,history'
          }
        }
      );
      
      const data = response.data?.d || response.data;
      
      if (!data) {
        throw new Error(`申請ID ${applicationId} が見つかりません`);
      }
      
      return this.transformApplicationDetail(data);
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
      const filterQuery = this.buildFilterQuery(filters);
      
      const response = await executeHttpRequest(
        this.destination,
        {
          method: 'GET',
          url: '/Applications',
          params: {
            $filter: filterQuery,
            $expand: 'status,type'
          }
        }
      );
      
      return this.transformApplicationList(response.data?.value || response.data?.d?.results || []);
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
      const response = await executeHttpRequest(
        this.destination,
        {
          method: 'GET',
          url: '/Comments',
          params: {
            $filter: `applicationId eq '${applicationId}'`,
            $orderby: 'commentDate desc'
          }
        }
      );
      
      return response.data?.value || response.data?.d?.results || [];
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
      const response = await executeHttpRequest(
        this.destination,
        {
          method: 'GET',
          url: '/ApprovalHistory',
          params: {
            $filter: `applicationId eq '${applicationId}'`,
            $orderby: 'actionDate desc'
          }
        }
      );
      
      return response.data?.value || response.data?.d?.results || [];
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
      const response = await executeHttpRequest(
        this.destination,
        {
          method: 'GET',
          url: '/Approvers',
          params: {
            $filter: `applicationId eq '${applicationId}'`,
            $orderby: 'sequence asc'
          }
        }
      );
      
      return response.data?.value || response.data?.d?.results || [];
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
      const response = await executeHttpRequest(
        this.destination,
        {
          method: 'POST',
          url: `/Applications('${applicationId}')/Submit`,
          data: {}
        }
      );
      
      return response.data;
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
      const response = await executeHttpRequest(
        this.destination,
        {
          method: 'POST',
          url: `/Applications('${applicationId}')/Withdraw`,
          data: {}
        }
      );
      
      return response.data;
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
      const response = await executeHttpRequest(
        this.destination,
        {
          method: 'POST',
          url: `/Applications('${applicationId}')/Discard`,
          data: {}
        }
      );
      
      return response.data;
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
      const response = await executeHttpRequest(
        this.destination,
        {
          method: 'POST',
          url: `/Applications('${applicationId}')/Approve`,
          data: { comment }
        }
      );
      
      return response.data;
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
      const response = await executeHttpRequest(
        this.destination,
        {
          method: 'POST',
          url: `/Applications('${applicationId}')/Reject`,
          data: { comment }
        }
      );
      
      return response.data;
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
   * クエリパラメータを構築
   */
  buildQueryParams(query) {
    const params = {};
    
    if (query.SELECT) {
      // CDS queryからODataパラメータに変換
      if (query.SELECT.columns) {
        params.$select = query.SELECT.columns.join(',');
      }
      if (query.SELECT.where) {
        params.$filter = this.convertCDSFilter(query.SELECT.where);
      }
      if (query.SELECT.orderBy) {
        params.$orderby = query.SELECT.orderBy.map(o => `${o.ref} ${o.sort || 'asc'}`).join(',');
      }
      if (query.SELECT.limit) {
        params.$top = query.SELECT.limit.rows;
        if (query.SELECT.limit.offset) {
          params.$skip = query.SELECT.limit.offset.val;
        }
      }
    }
    
    return params;
  }

  /**
   * フィルタクエリを構築
   */
  buildFilterQuery(filters) {
    const conditions = [];
    
    if (filters.status) {
      conditions.push(`status eq '${filters.status}'`);
    }
    if (filters.type) {
      conditions.push(`type eq '${filters.type}'`);
    }
    if (filters.companyCode) {
      conditions.push(`companyCode eq '${filters.companyCode}'`);
    }
    if (filters.startDate) {
      conditions.push(`startDate ge ${filters.startDate}`);
    }
    if (filters.endDate) {
      conditions.push(`endDate le ${filters.endDate}`);
    }
    if (filters.requester) {
      conditions.push(`contains(requester, '${filters.requester}')`);
    }
    
    return conditions.join(' and ');
  }

  /**
   * CDS filterをOData filterに変換
   */
  convertCDSFilter(filter) {
    // 簡易実装 - 実際のプロジェクトでは適切に変換
    if (Array.isArray(filter)) {
      return filter.map(f => this.convertCDSFilter(f)).join(' and ');
    }
    return '';
  }

  /**
   * 申請一覧データを変換
   */
  transformApplicationList(data) {
    if (!Array.isArray(data)) {
      return [];
    }
    
    return data.map(item => ({
      ID: item.ID || item.id,
      applicationId: item.applicationId || item.ApplicationId,
      status_code: item.status || item.Status,
      type_code: item.type || item.Type,
      companyCode: item.companyCode || item.CompanyCode,
      companyName: item.companyName || item.CompanyName,
      fiscalYear: item.fiscalYear || item.FiscalYear,
      startDate: item.startDate || item.StartDate,
      endDate: item.endDate || item.EndDate,
      dueDate: item.dueDate || item.DueDate,
      requester: item.requester || item.Requester,
      amount: item.amount || item.Amount,
      currency: item.currency || item.Currency,
      hasDocuments: item.hasDocuments || item.HasDocuments || false,
      attachmentCount: item.attachmentCount || item.AttachmentCount || 0
    }));
  }

  /**
   * 申請詳細データを変換
   */
  transformApplicationDetail(data) {
    return {
      ID: data.ID || data.id,
      applicationId: data.applicationId || data.ApplicationId,
      status_code: data.status || data.Status,
      type_code: data.type || data.Type,
      companyCode: data.companyCode || data.CompanyCode,
      companyName: data.companyName || data.CompanyName,
      fiscalYear: data.fiscalYear || data.FiscalYear,
      startDate: data.startDate || data.StartDate,
      endDate: data.endDate || data.EndDate,
      dueDate: data.dueDate || data.DueDate,
      requester: data.requester || data.Requester,
      amount: data.amount || data.Amount,
      currency: data.currency || data.Currency,
      hasDocuments: data.hasDocuments || data.HasDocuments || false,
      attachmentCount: data.attachmentCount || data.AttachmentCount || 0
    };
  }
}

module.exports = BPAService;