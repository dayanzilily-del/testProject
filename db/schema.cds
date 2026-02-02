namespace approval;

using { managed, cuid } from '@sap/cds/common';

// 申請一覧のメインエンティティ
entity Applications : cuid, managed {
  applicationId     : String(20) @title: '申請番号';
  status           : Association to Statuses;
  type             : Association to Types;
  companyCode      : String(4) @title: '会社コード';
  companyName      : String(100) @title: '会社名';
  fiscalYear       : String(4) @title: '会計年度';
  startDate        : Date @title: '開始日付';
  endDate          : Date @title: '終了日付';
  dueDate          : Date @title: '期限日付';
  requester        : String(100) @title: '申請者';
  amount           : Decimal(15,2) @title: '金額';
  currency         : String(3) @title: '通貨';
  
  // BPAから取得する情報
  hasDocuments     : Boolean @title: '紙証憑有無';
  attachmentCount  : Integer @title: '添付ファイル数';
  
  // 承認関連
  approvers        : Composition of many Approvers on approvers.application = $self;
  approvalHistory  : Composition of many ApprovalHistory on approvalHistory.application = $self;
  comments         : Composition of many Comments on comments.application = $self;
  
  // 会計伝票情報
  accountingDocument : Composition of one AccountingDocument on accountingDocument.application = $self;
}

// ステータスマスタ
entity Statuses {
  key code  : String(10) @title: 'ステータスコード';
  name      : String(50) @title: 'ステータス名';
  description : String(200) @title: '説明';
}

// タイプマスタ
entity Types {
  key code  : String(10) @title: 'タイプコード';
  name      : String(50) @title: 'タイプ名';
  description : String(200) @title: '説明';
}

// 承認者情報
entity Approvers : cuid {
  application   : Association to Applications;
  sequence      : Integer @title: '承認順序';
  userId        : String(50) @title: 'ユーザーID';
  userName      : String(100) @title: 'ユーザー名';
  department    : String(100) @title: '部門';
  status        : String(20) @title: '承認状態';
  approvedDate  : DateTime @title: '承認日時';
}

// 承認履歴
entity ApprovalHistory : cuid {
  application   : Association to Applications;
  userId        : String(50) @title: 'ユーザーID';
  userName      : String(100) @title: 'ユーザー名';
  action        : String(20) @title: 'アクション';
  actionDate    : DateTime @title: '実行日時';
  comment       : String(500) @title: 'コメント';
}

// コメント
entity Comments : cuid {
  application   : Association to Applications;
  userId        : String(50) @title: 'ユーザーID';
  userName      : String(100) @title: 'ユーザー名';
  comment       : String(500) @title: 'コメント';
  commentDate   : DateTime @title: 'コメント日時';
}

// 会計伝票ヘッダー
entity AccountingDocument : cuid {
  application     : Association to Applications;
  documentNumber  : String(20) @title: '伝票番号';
  fiscalYear      : String(4) @title: '会計年度';
  companyCode     : String(4) @title: '会社コード';
  documentType    : String(4) @title: '伝票タイプ';
  postingDate     : Date @title: '転記日付';
  documentDate    : Date @title: '伝票日付';
  reference       : String(50) @title: '参照';
  headerText      : String(100) @title: 'ヘッダテキスト';
  
  // 明細情報
  items           : Composition of many AccountingDocumentItems on items.document = $self;
}

// 会計伝票明細
entity AccountingDocumentItems : cuid {
  document        : Association to AccountingDocument;
  itemNumber      : String(3) @title: '明細番号';
  glAccount       : String(10) @title: 'G/L勘定';
  glAccountName   : String(100) @title: '勘定科目名';
  amount          : Decimal(15,2) @title: '金額';
  currency        : String(3) @title: '通貨';
  debitCredit     : String(1) @title: '借方/貸方';
  costCenter      : String(10) @title: 'コストセンター';
  profitCenter    : String(10) @title: 'プロフィットセンター';
  itemText        : String(100) @title: '明細テキスト';
}

// 添付ファイル情報（DMSとの連携）
entity Attachments : cuid {
  application     : Association to Applications;
  fileName        : String(255) @title: 'ファイル名';
  fileSize        : Integer @title: 'ファイルサイズ';
  mimeType        : String(100) @title: 'MIMEタイプ';
  dmsDocumentId   : String(50) @title: 'DMS文書ID';
  uploadedBy      : String(50) @title: 'アップロード者';
  uploadedAt      : DateTime @title: 'アップロード日時';
}
