const cds = require('@sap/cds');
const BPAService = require('./lib/bpa-service');
const DMSService = require('./lib/dms-service');
const SAPService = require('./lib/sap-service');

module.exports = cds.service.impl(async function() {
  const { Applications, ApplicationDetails, Statuses, Types, Approvers, Comments, Attachments } = this.entities;
  
  // 初期化
  const bpaService = new BPAService();
  const dmsService = new DMSService();
  const sapService = new SAPService();

  // ==================== READ ハンドラー ====================
  
  // 申請一覧の取得（BPAからデータを取得）
  this.on('READ', Applications, async (req) => {
    try {
      // BPAから申請データを取得
      const bpaData = await bpaService.getApplications(req.query);
      
      // 承認者情報を追加取得（CDS Viewから）
      for (let app of bpaData) {
        app.approvers = await this.getApprovers(app.applicationId);
      }
      
      return bpaData;
    } catch (error) {
      req.error(500, `申請一覧の取得に失敗しました: ${error.message}`);
    }
  });

  // 申請詳細の取得
  this.on('READ', ApplicationDetails, async (req) => {
    try {
      const { applicationId } = req.data;
      
      // BPAから詳細情報を取得
      const applicationData = await bpaService.getApplicationDetail(applicationId);
      
      // 会計伝票情報を取得
      applicationData.accountingDocument = await sapService.getAccountingDocument(applicationId);
      
      // 添付ファイル情報を取得（DMS）
      applicationData.attachments = await dmsService.getAttachments(applicationId);
      
      // コメント情報を取得
      applicationData.comments = await bpaService.getComments(applicationId);
      
      // 承認履歴を取得
      applicationData.approvalHistory = await bpaService.getApprovalHistory(applicationId);
      
      return applicationData;
    } catch (error) {
      req.error(500, `申請詳細の取得に失敗しました: ${error.message}`);
    }
  });

  // ==================== カスタムファンクション ====================
  
  // 申請検索
  this.on('searchApplications', async (req) => {
    const { status, type, companyCode, startDate, endDate, requester } = req.data;
    
    try {
      const filters = {
        status,
        type,
        companyCode,
        startDate,
        endDate,
        requester
      };
      
      return await bpaService.searchApplications(filters);
    } catch (error) {
      req.error(500, `検索に失敗しました: ${error.message}`);
    }
  });

  // 会社マスタ取得
  this.on('getCompanies', async (req) => {
    try {
      return await sapService.getCompanies();
    } catch (error) {
      req.error(500, `会社マスタの取得に失敗しました: ${error.message}`);
    }
  });

  // BPA同期
  this.on('syncFromBPA', async (req) => {
    const { applicationId } = req.data;
    
    try {
      await bpaService.syncApplication(applicationId);
      return `申請 ${applicationId} の同期が完了しました`;
    } catch (error) {
      req.error(500, `BPA同期に失敗しました: ${error.message}`);
    }
  });

  // ==================== アクション ====================
  
  // 申請提出
  this.on('submit', Applications, async (req) => {
    const { applicationId } = req.params[0];
    
    try {
      // BPAに申請を送信
      const result = await bpaService.submitApplication(applicationId);
      
      // ローカルのステータスを更新
      await UPDATE(Applications, applicationId).with({ status_code: 'SUBMITTED' });
      
      return `申請 ${applicationId} を提出しました`;
    } catch (error) {
      req.error(500, `申請の提出に失敗しました: ${error.message}`);
    }
  });

  // 引き戻し
  this.on('withdraw', Applications, async (req) => {
    const { applicationId } = req.params[0];
    
    try {
      // BPAで引き戻し処理
      await bpaService.withdrawApplication(applicationId);
      
      // ローカルのステータスを更新
      await UPDATE(Applications, applicationId).with({ status_code: 'WITHDRAWN' });
      
      return `申請 ${applicationId} を引き戻しました`;
    } catch (error) {
      req.error(500, `引き戻しに失敗しました: ${error.message}`);
    }
  });

  // 破棄
  this.on('discard', Applications, async (req) => {
    const { applicationId } = req.params[0];
    
    try {
      // BPAで破棄処理
      await bpaService.discardApplication(applicationId);
      
      // ローカルのステータスを更新
      await UPDATE(Applications, applicationId).with({ status_code: 'DISCARDED' });
      
      return `申請 ${applicationId} を破棄しました`;
    } catch (error) {
      req.error(500, `破棄に失敗しました: ${error.message}`);
    }
  });

  // 承認
  this.on('approveApplication', async (req) => {
    const { applicationId, comment } = req.data;
    
    try {
      // BPAで承認処理
      await bpaService.approveApplication(applicationId, comment);
      
      // コメントを保存
      if (comment) {
        await INSERT.into(Comments).entries({
          application_ID: applicationId,
          userId: req.user.id,
          userName: req.user.name,
          comment: comment,
          commentDate: new Date()
        });
      }
      
      return `申請 ${applicationId} を承認しました`;
    } catch (error) {
      req.error(500, `承認に失敗しました: ${error.message}`);
    }
  });

  // 却下
  this.on('rejectApplication', async (req) => {
    const { applicationId, comment } = req.data;
    
    try {
      // BPAで却下処理
      await bpaService.rejectApplication(applicationId, comment);
      
      // コメントを保存
      if (comment) {
        await INSERT.into(Comments).entries({
          application_ID: applicationId,
          userId: req.user.id,
          userName: req.user.name,
          comment: comment,
          commentDate: new Date()
        });
      }
      
      return `申請 ${applicationId} を却下しました`;
    } catch (error) {
      req.error(500, `却下に失敗しました: ${error.message}`);
    }
  });

  // ==================== 添付ファイル処理 ====================
  
  // ファイルアップロード
  this.on('upload', Attachments, async (req) => {
    const { content, fileName, mimeType } = req.data;
    const { applicationId } = req.params[0];
    
    try {
      // DMSにアップロード
      const dmsDocumentId = await dmsService.uploadFile({
        content,
        fileName,
        mimeType,
        applicationId
      });
      
      // 添付ファイル情報を保存
      const attachment = await INSERT.into(Attachments).entries({
        application_ID: applicationId,
        fileName,
        fileSize: content.length,
        mimeType,
        dmsDocumentId,
        uploadedBy: req.user.id,
        uploadedAt: new Date()
      });
      
      return attachment;
    } catch (error) {
      req.error(500, `ファイルのアップロードに失敗しました: ${error.message}`);
    }
  });

  // ファイルダウンロード
  this.on('download', Attachments, async (req) => {
    const { ID } = req.params[0];
    
    try {
      // 添付ファイル情報を取得
      const attachment = await SELECT.one.from(Attachments).where({ ID });
      
      if (!attachment) {
        req.error(404, 'ファイルが見つかりません');
      }
      
      // DMSからファイルを取得
      const fileContent = await dmsService.downloadFile(attachment.dmsDocumentId);
      
      return fileContent;
    } catch (error) {
      req.error(500, `ファイルのダウンロードに失敗しました: ${error.message}`);
    }
  });

  // ファイル削除
  this.on('delete', Attachments, async (req) => {
    const { ID } = req.params[0];
    
    try {
      // 添付ファイル情報を取得
      const attachment = await SELECT.one.from(Attachments).where({ ID });
      
      if (!attachment) {
        req.error(404, 'ファイルが見つかりません');
      }
      
      // DMSからファイルを削除
      await dmsService.deleteFile(attachment.dmsDocumentId);
      
      // データベースから削除
      await DELETE.from(Attachments).where({ ID });
      
      return `ファイル ${attachment.fileName} を削除しました`;
    } catch (error) {
      req.error(500, `ファイルの削除に失敗しました: ${error.message}`);
    }
  });

  // ==================== ヘルパーメソッド ====================
  
  this.getApprovers = async (applicationId) => {
    // CDS Viewから承認者情報を取得
    // 実装は環境に応じて調整
    const approvers = await SELECT.from(Approvers).where({ application_ID: applicationId });
    return approvers;
  };
});