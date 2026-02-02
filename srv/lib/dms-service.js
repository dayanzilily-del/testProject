const cds = require('@sap/cds');
const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');

/**
 * DMS連携サービス
 * Document Management Serviceとの通信を共通化
 */
class DMSService {
  constructor() {
    this.destination = null;
    this.baseUrl = null;
  }

  /**
   * 初期化（Destinationを取得）
   */
  async init() {
    if (!this.destination) {
      try {
        const { DMSService } = cds.env.requires;
        this.destination = DMSService.credentials.destination;
        this.baseUrl = DMSService.credentials.url || '/dms/v1';
      } catch (error) {
        console.error('DMS初期化エラー:', error);
        throw new Error('DMSサービスの初期化に失敗しました');
      }
    }
    return this.destination;
  }

  /**
   * ファイルをアップロード
   * @param {Object} fileData - ファイルデータ
   * @param {Buffer} fileData.content - ファイルコンテンツ
   * @param {String} fileData.fileName - ファイル名
   * @param {String} fileData.mimeType - MIMEタイプ
   * @param {String} fileData.applicationId - 申請ID
   * @returns {String} DMS文書ID
   */
  async uploadFile({ content, fileName, mimeType, applicationId }) {
    await this.init();
    
    try {
      const formData = new FormData();
      formData.append('file', content, {
        filename: fileName,
        contentType: mimeType
      });
      formData.append('cmisaction', 'createDocument');
      formData.append('propertyId[0]', 'cmis:objectTypeId');
      formData.append('propertyValue[0]', 'cmis:document');
      formData.append('propertyId[1]', 'cmis:name');
      formData.append('propertyValue[1]', fileName);
      formData.append('propertyId[2]', 'sap:applicationId');
      formData.append('propertyValue[2]', applicationId);
      
      const response = await executeHttpRequest(
        { destinationName: this.destination },
        {
          method: 'POST',
          url: `${this.baseUrl}/browser/root`,
          data: formData,
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      if (response.data && response.data.succinctProperties) {
        return response.data.succinctProperties['cmis:objectId'];
      }
      
      throw new Error('DMS文書IDの取得に失敗しました');
    } catch (error) {
      console.error('DMSファイルアップロードエラー:', error);
      throw new Error(`ファイルのアップロードに失敗しました: ${error.message}`);
    }
  }

  /**
   * ファイルをダウンロード
   * @param {String} documentId - DMS文書ID
   * @returns {Buffer} ファイルコンテンツ
   */
  async downloadFile(documentId) {
    await this.init();
    
    try {
      const response = await executeHttpRequest(
        { destinationName: this.destination },
        {
          method: 'GET',
          url: `${this.baseUrl}/browser/root`,
          params: {
            cmisselector: 'content',
            objectId: documentId
          },
          responseType: 'arraybuffer'
        }
      );
      
      return Buffer.from(response.data);
    } catch (error) {
      console.error('DMSファイルダウンロードエラー:', error);
      throw new Error(`ファイルのダウンロードに失敗しました: ${error.message}`);
    }
  }

  /**
   * ファイルを削除
   * @param {String} documentId - DMS文書ID
   * @returns {Boolean} 削除成功フラグ
   */
  async deleteFile(documentId) {
    await this.init();
    
    try {
      await executeHttpRequest(
        { destinationName: this.destination },
        {
          method: 'POST',
          url: `${this.baseUrl}/browser/root`,
          params: {
            cmisaction: 'delete',
            objectId: documentId
          }
        }
      );
      
      return true;
    } catch (error) {
      console.error('DMSファイル削除エラー:', error);
      throw new Error(`ファイルの削除に失敗しました: ${error.message}`);
    }
  }

  /**
   * 申請に紐づく添付ファイル一覧を取得
   * @param {String} applicationId - 申請ID
   * @returns {Array} 添付ファイル配列
   */
  async getAttachments(applicationId) {
    await this.init();
    
    try {
      const response = await executeHttpRequest(
        { destinationName: this.destination },
        {
          method: 'GET',
          url: `${this.baseUrl}/browser/root`,
          params: {
            cmisselector: 'children',
            filter: `sap:applicationId='${applicationId}'`
          }
        }
      );
      
      if (!response.data || !response.data.objects) {
        return [];
      }
      
      return response.data.objects.map(obj => ({
        dmsDocumentId: obj.object.succinctProperties['cmis:objectId'],
        fileName: obj.object.succinctProperties['cmis:name'],
        fileSize: obj.object.succinctProperties['cmis:contentStreamLength'],
        mimeType: obj.object.succinctProperties['cmis:contentStreamMimeType'],
        createdBy: obj.object.succinctProperties['cmis:createdBy'],
        createdAt: obj.object.succinctProperties['cmis:creationDate']
      }));
    } catch (error) {
      console.error('DMS添付ファイル一覧取得エラー:', error);
      return [];
    }
  }

  /**
   * ファイルのプレビューURLを取得
   * @param {String} documentId - DMS文書ID
   * @returns {String} プレビューURL
   */
  async getPreviewUrl(documentId) {
    await this.init();
    
    try {
      // DMSのプレビュー機能を使用
      return `${this.baseUrl}/browser/root?cmisselector=content&objectId=${documentId}&rendition=preview`;
    } catch (error) {
      console.error('DMSプレビューURL取得エラー:', error);
      return null;
    }
  }

  /**
   * ファイル情報を取得
   * @param {String} documentId - DMS文書ID
   * @returns {Object} ファイル情報
   */
  async getFileInfo(documentId) {
    await this.init();
    
    try {
      const response = await executeHttpRequest(
        { destinationName: this.destination },
        {
          method: 'GET',
          url: `${this.baseUrl}/browser/root`,
          params: {
            cmisselector: 'object',
            objectId: documentId
          }
        }
      );
      
      if (response.data && response.data.succinctProperties) {
        const props = response.data.succinctProperties;
        return {
          documentId: props['cmis:objectId'],
          fileName: props['cmis:name'],
          fileSize: props['cmis:contentStreamLength'],
          mimeType: props['cmis:contentStreamMimeType'],
          createdBy: props['cmis:createdBy'],
          createdAt: props['cmis:creationDate'],
          modifiedBy: props['cmis:lastModifiedBy'],
          modifiedAt: props['cmis:lastModificationDate']
        };
      }
      
      return null;
    } catch (error) {
      console.error('DMSファイル情報取得エラー:', error);
      return null;
    }
  }

  /**
   * 複数ファイルを一括アップロード
   * @param {Array} files - ファイル配列
   * @param {String} applicationId - 申請ID
   * @returns {Array} アップロード結果配列
   */
  async uploadMultipleFiles(files, applicationId) {
    const results = [];
    
    for (const file of files) {
      try {
        const documentId = await this.uploadFile({
          content: file.content,
          fileName: file.fileName,
          mimeType: file.mimeType,
          applicationId
        });
        
        results.push({
          fileName: file.fileName,
          documentId,
          success: true
        });
      } catch (error) {
        results.push({
          fileName: file.fileName,
          error: error.message,
          success: false
        });
      }
    }
    
    return results;
  }

  /**
   * ファイルを更新（バージョニング）
   * @param {String} documentId - DMS文書ID
   * @param {Buffer} content - 新しいファイルコンテンツ
   * @param {String} fileName - ファイル名
   * @param {String} mimeType - MIMEタイプ
   * @returns {String} 新しいバージョンの文書ID
   */
  async updateFile(documentId, content, fileName, mimeType) {
    await this.init();
    
    try {
      const formData = new FormData();
      formData.append('file', content, {
        filename: fileName,
        contentType: mimeType
      });
      formData.append('cmisaction', 'checkIn');
      formData.append('objectId', documentId);
      formData.append('checkinComment', 'Updated file');
      formData.append('major', 'true');
      
      const response = await executeHttpRequest(
        { destinationName: this.destination },
        {
          method: 'POST',
          url: `${this.baseUrl}/browser/root`,
          data: formData,
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      if (response.data && response.data.succinctProperties) {
        return response.data.succinctProperties['cmis:objectId'];
      }
      
      throw new Error('ファイル更新後の文書IDの取得に失敗しました');
    } catch (error) {
      console.error('DMSファイル更新エラー:', error);
      throw new Error(`ファイルの更新に失敗しました: ${error.message}`);
    }
  }
}

module.exports = DMSService;