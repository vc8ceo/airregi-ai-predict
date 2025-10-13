# Airレジ予測システム - Next.js Application

機械学習と天気予報を活用して、店舗の次回営業日の来店者数と売上を予測するSaaSアプリケーションです。

## 機能

- **ユーザー認証**: メール/パスワードおよびGoogle OAuthによるログイン
- **ダッシュボード**: 過去30日間の来店者数・売上のKPI表示
- **予測機能**: 機械学習モデルと天気予報を用いた次営業日の予測
- **データ管理**: ジャーナル履歴CSVのアップロードと履歴管理
- **マルチテナント対応**: Row Level Security (RLS)による完全なデータ分離

## 技術スタック

- **フロントエンド**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **バックエンド**: Next.js API Routes, Supabase
- **データベース**: PostgreSQL (Supabase)
- **認証**: Supabase Auth
- **ML API**: FastAPI (別途デプロイ)
- **ホスティング**: Vercel

## プロジェクト構成

```
airregi-predict-app/
├── app/
│   ├── (auth)/              # 認証関連ページ
│   │   ├── login/           # ログインページ
│   │   └── signup/          # 新規登録ページ
│   ├── (dashboard)/         # ダッシュボード関連ページ
│   │   ├── dashboard/       # メインダッシュボード
│   │   ├── prediction/      # 予測ページ
│   │   ├── data-management/ # データ管理ページ
│   │   └── layout.tsx       # ダッシュボードレイアウト
│   ├── api/                 # API Routes
│   │   ├── predict/         # 予測API
│   │   └── upload/          # アップロードAPI
│   ├── auth/
│   │   └── callback/        # OAuth コールバック
│   └── page.tsx             # ルートページ (リダイレクト)
├── components/              # React コンポーネント
│   ├── auth/                # 認証コンポーネント
│   ├── dashboard/           # ダッシュボードコンポーネント
│   ├── prediction/          # 予測コンポーネント
│   └── ui/                  # 共通UIコンポーネント
├── lib/
│   ├── supabase/            # Supabaseクライアント
│   │   ├── client.ts        # ブラウザ用クライアント
│   │   ├── server.ts        # サーバー用クライアント
│   │   └── middleware.ts    # ミドルウェア用
│   └── api/                 # API ユーティリティ
├── hooks/                   # カスタムフック
├── types/                   # TypeScript型定義
│   └── database.types.ts    # Supabaseデータベース型
├── middleware.ts            # Next.js ミドルウェア
└── .env.local               # 環境変数
```

## セットアップ

### 前提条件

- Node.js 18.x 以上
- npm または yarn
- Supabaseアカウント

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local.example` を `.env.local` にコピーして、必要な値を設定します:

```bash
cp .env.local.example .env.local
```

`.env.local` の内容:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# ML API Configuration
ML_API_URL=your_ml_api_url
ML_API_KEY=your_ml_api_key

# Weather API Configuration
WEATHER_API_KEY=your_weather_api_key
WEATHER_API_URL=https://api.weatherapi.com/v1

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Supabaseプロジェクトのセットアップ

詳細は [Supabaseセットアップガイド](../docs/09_supabase_setup_guide.md) を参照してください。

主な手順:
1. Supabaseプロジェクトを作成
2. データベーステーブルを作成
3. Row Level Security (RLS) を設定
4. 認証プロバイダーを設定

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## 使い方

### 1. アカウント登録

1. `/signup` にアクセス
2. 店舗名、メールアドレス、パスワードを入力
3. 「登録」ボタンをクリック、またはGoogleアカウントで登録

### 2. データのアップロード

1. ダッシュボードから「データ管理」を選択
2. Airレジからエクスポートしたジャーナル履歴CSVを選択
3. 「アップロード」ボタンをクリック
4. データが自動的に処理され、データベースに保存されます

### 3. 予測の実行

1. 「予測」ページを開く
2. 「予測を実行」ボタンをクリック
3. 次の営業日の来店者数と売上の予測結果が表示されます
4. 予測結果には信頼区間と天気予報も含まれます

### 4. ダッシュボードの確認

1. 「ダッシュボード」ページで過去30日間のKPIを確認
2. 総来店者数、総売上、平均来店者数、顧客単価が表示されます

## API エンドポイント

### POST `/api/predict`

次の営業日の予測を実行します。

**Request Body:**
```json
{
  "user_id": "uuid"
}
```

**Response:**
```json
{
  "prediction_date": "2025-10-14",
  "predictions": {
    "visitor_count": {
      "value": 60,
      "confidence_lower": 55,
      "confidence_upper": 65
    },
    "sales_amount": {
      "value": 42000,
      "confidence_lower": 38000,
      "confidence_upper": 46000
    }
  },
  "weather_forecast": {
    "condition": "晴れ",
    "temp_max": 25,
    "temp_min": 18,
    "precipitation": 10
  }
}
```

### POST `/api/upload`

ジャーナル履歴CSVをアップロードします。

**Request:** `multipart/form-data`
- `file`: CSV ファイル
- `user_id`: ユーザーUUID

**Response:**
```json
{
  "success": true,
  "row_count": 1234,
  "upload_id": 1
}
```

## データベーススキーマ

### profiles
ユーザープロフィール情報

- `id`: UUID (Primary Key)
- `email`: TEXT
- `store_name`: TEXT
- `store_location`: TEXT
- `store_lat`: DECIMAL
- `store_lon`: DECIMAL

### journal_data
ジャーナル履歴の生データ

- `id`: BIGSERIAL (Primary Key)
- `user_id`: UUID (Foreign Key)
- `receipt_no`: TEXT
- `sales_date`: DATE
- `sales_time`: TIME
- `product_name`: TEXT
- `quantity`: INTEGER
- `subtotal`: DECIMAL
- `tax_amount`: DECIMAL

### daily_aggregated
日次集計データ

- `id`: BIGSERIAL (Primary Key)
- `user_id`: UUID (Foreign Key)
- `date`: DATE
- `visitor_count`: INTEGER
- `sales_amount`: DECIMAL
- `weather_condition`: TEXT
- `temp_max`: DECIMAL

### predictions
予測結果

- `id`: BIGSERIAL (Primary Key)
- `user_id`: UUID (Foreign Key)
- `prediction_date`: DATE
- `predicted_visitor_count`: INTEGER
- `predicted_sales_amount`: DECIMAL
- `actual_visitor_count`: INTEGER (nullable)
- `actual_sales_amount`: DECIMAL (nullable)

### upload_history
アップロード履歴

- `id`: BIGSERIAL (Primary Key)
- `user_id`: UUID (Foreign Key)
- `file_name`: TEXT
- `file_size`: BIGINT
- `row_count`: INTEGER
- `status`: TEXT

## デプロイ

### Vercelへのデプロイ

1. Vercelアカウントを作成
2. GitHubリポジトリを連携
3. プロジェクトをインポート
4. 環境変数を設定
5. デプロイ

```bash
# Vercel CLIを使用する場合
npm install -g vercel
vercel
```

環境変数の設定:
- Vercelダッシュボードの「Settings」→「Environment Variables」
- `.env.local` の内容をすべて追加

### Supabase本番環境の設定

1. Supabaseダッシュボードで本番用プロジェクトを作成
2. データベーススキーマとRLSポリシーを設定
3. 認証設定でVercelのドメインを追加
4. 環境変数を本番用の値に更新

## トラブルシューティング

### ログインできない

- 環境変数が正しく設定されているか確認
- Supabaseの認証設定を確認
- ブラウザのコンソールでエラーを確認

### データがアップロードできない

- CSVファイルのフォーマットを確認
- ファイルサイズを確認（推奨: 50MB以下）
- Supabaseのストレージ容量を確認

### 予測が実行できない

- ML APIが起動しているか確認
- ML_API_URLとML_API_KEYが正しく設定されているか確認
- 店舗の位置情報（緯度経度）が設定されているか確認

## 開発

### ビルド

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### 型チェック

```bash
npx tsc --noEmit
```

## ライセンス

This project is proprietary and confidential.

## サポート

問題が発生した場合は、GitHubのIssuesまたは開発チームにお問い合わせください。
