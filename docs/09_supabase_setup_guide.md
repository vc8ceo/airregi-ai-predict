# Supabase セットアップガイド

## 概要

このガイドでは、Airレジ予測システムで使用するSupabaseプロジェクトのセットアップ手順を説明します。

## 1. Supabaseプロジェクトの作成

### 1.1 アカウント作成とプロジェクト作成

1. [Supabase](https://supabase.com/) にアクセス
2. 「Start your project」をクリックしてアカウントを作成
3. 「New Project」をクリック
4. プロジェクト情報を入力:
   - **Project Name**: `airregi-predict`
   - **Database Password**: 強力なパスワードを生成（必ずメモする）
   - **Region**: `Tokyo (ap-northeast-1)` を選択
5. 「Create new project」をクリック

### 1.2 プロジェクト情報の取得

プロジェクトが作成されたら、以下の情報を取得します:

1. サイドバーの「Settings」→「API」を開く
2. 以下の情報をコピー:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: `eyJhbGci...`

これらの値を `.env.local` ファイルに設定します:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

## 2. データベーススキーマの作成

### 2.1 SQL Editorを開く

1. サイドバーの「SQL Editor」を開く
2. 新しいクエリを作成

### 2.2 テーブル作成SQL

以下のSQLを実行してテーブルを作成します:

```sql
-- ユーザープロフィールテーブル
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  store_name TEXT,
  store_location TEXT,
  store_lat DECIMAL(9,6),
  store_lon DECIMAL(9,6),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ジャーナル履歴データテーブル
CREATE TABLE journal_data (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  receipt_no TEXT NOT NULL,
  sales_date DATE NOT NULL,
  sales_time TIME NOT NULL,
  product_name TEXT,
  category TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 日次集計データテーブル
CREATE TABLE daily_aggregated (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  visitor_count INTEGER NOT NULL DEFAULT 0,
  sales_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  avg_per_customer DECIMAL(10,2),
  weather_condition TEXT,
  temp_max DECIMAL(5,2),
  temp_min DECIMAL(5,2),
  precipitation DECIMAL(5,2),
  day_of_week INTEGER NOT NULL,
  is_holiday BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, date)
);

-- 予測結果テーブル
CREATE TABLE predictions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  prediction_date DATE NOT NULL,
  predicted_visitor_count INTEGER NOT NULL,
  predicted_sales_amount DECIMAL(10,2) NOT NULL,
  visitor_count_confidence_lower INTEGER,
  visitor_count_confidence_upper INTEGER,
  sales_amount_confidence_lower DECIMAL(10,2),
  sales_amount_confidence_upper DECIMAL(10,2),
  actual_visitor_count INTEGER,
  actual_sales_amount DECIMAL(10,2),
  model_version TEXT,
  weather_forecast JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- アップロード履歴テーブル
CREATE TABLE upload_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  row_count INTEGER,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- インデックスの作成
CREATE INDEX idx_journal_data_user_id ON journal_data(user_id);
CREATE INDEX idx_journal_data_sales_date ON journal_data(sales_date);
CREATE INDEX idx_journal_data_receipt_no ON journal_data(receipt_no);

CREATE INDEX idx_daily_aggregated_user_id ON daily_aggregated(user_id);
CREATE INDEX idx_daily_aggregated_date ON daily_aggregated(date);

CREATE INDEX idx_predictions_user_id ON predictions(user_id);
CREATE INDEX idx_predictions_date ON predictions(prediction_date);

CREATE INDEX idx_upload_history_user_id ON upload_history(user_id);

-- 自動更新トリガー用の関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- updated_atカラムの自動更新トリガー
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_predictions_updated_at BEFORE UPDATE ON predictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## 3. Row Level Security (RLS) の設定

### 3.1 RLSの有効化

```sql
-- RLSを有効化
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_aggregated ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_history ENABLE ROW LEVEL SECURITY;
```

### 3.2 RLSポリシーの作成

```sql
-- profiles テーブルのポリシー
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- journal_data テーブルのポリシー
CREATE POLICY "Users can view own journal data"
  ON journal_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journal data"
  ON journal_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own journal data"
  ON journal_data FOR DELETE
  USING (auth.uid() = user_id);

-- daily_aggregated テーブルのポリシー
CREATE POLICY "Users can view own aggregated data"
  ON daily_aggregated FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own aggregated data"
  ON daily_aggregated FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own aggregated data"
  ON daily_aggregated FOR UPDATE
  USING (auth.uid() = user_id);

-- predictions テーブルのポリシー
CREATE POLICY "Users can view own predictions"
  ON predictions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own predictions"
  ON predictions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own predictions"
  ON predictions FOR UPDATE
  USING (auth.uid() = user_id);

-- upload_history テーブルのポリシー
CREATE POLICY "Users can view own upload history"
  ON upload_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own upload history"
  ON upload_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own upload history"
  ON upload_history FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own upload history"
  ON upload_history FOR DELETE
  USING (auth.uid() = user_id);

-- daily_aggregated テーブルのDELETEポリシー
CREATE POLICY "Users can delete own aggregated data"
  ON daily_aggregated FOR DELETE
  USING (auth.uid() = user_id);
```

## 4. 認証の設定

### 4.1 メール認証の有効化

1. サイドバーの「Authentication」→「Providers」を開く
2. 「Email」が有効になっていることを確認
3. 必要に応じて設定を調整:
   - **Enable email confirmations**: 本番環境では有効にすることを推奨
   - **Secure email change**: 有効にすることを推奨

### 4.2 Google OAuth の設定

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. プロジェクトを作成または選択
3. 「APIとサービス」→「認証情報」を開く
4. 「認証情報を作成」→「OAuthクライアントID」を選択
5. アプリケーションの種類: 「ウェブアプリケーション」
6. 承認済みのリダイレクトURIに以下を追加:
   ```
   https://xxxxx.supabase.co/auth/v1/callback
   ```
7. クライアントIDとクライアントシークレットをコピー

8. Supabaseに戻り、「Authentication」→「Providers」を開く
9. 「Google」を選択して有効化
10. Google Cloud ConsoleからコピーしたクライアントIDとシークレットを入力
11. 「Save」をクリック

### 4.3 サイトURLの設定

1. 「Authentication」→「URL Configuration」を開く
2. **Site URL** を設定:
   - 開発環境: `http://localhost:3000`
   - 本番環境: `https://yourdomain.com`
3. **Redirect URLs** に以下を追加:
   - `http://localhost:3000/auth/callback`
   - `https://yourdomain.com/auth/callback`

## 5. ストレージの設定（オプション）

CSVファイルを一時保存する場合に使用:

1. サイドバーの「Storage」を開く
2. 「Create a new bucket」をクリック
3. バケット情報を入力:
   - **Name**: `journal-files`
   - **Public bucket**: オフ
4. 「Create bucket」をクリック

### ストレージポリシーの設定

```sql
-- バケットのRLSポリシー
CREATE POLICY "Users can upload own files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'journal-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'journal-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'journal-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

## 6. データベース関数の作成（オプション）

日次集計を自動化する関数:

```sql
-- 日次集計を生成する関数
CREATE OR REPLACE FUNCTION aggregate_daily_data(target_user_id UUID, target_date DATE)
RETURNS void AS $$
BEGIN
  INSERT INTO daily_aggregated (
    user_id,
    date,
    visitor_count,
    sales_amount,
    avg_per_customer,
    day_of_week,
    is_holiday
  )
  SELECT
    target_user_id,
    target_date,
    COUNT(DISTINCT receipt_no) as visitor_count,
    SUM(subtotal + tax_amount) as sales_amount,
    AVG(subtotal + tax_amount) as avg_per_customer,
    EXTRACT(DOW FROM target_date)::INTEGER as day_of_week,
    false as is_holiday  -- 祝日判定は別途実装
  FROM journal_data
  WHERE user_id = target_user_id
    AND sales_date = target_date
  GROUP BY target_user_id, target_date
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    visitor_count = EXCLUDED.visitor_count,
    sales_amount = EXCLUDED.sales_amount,
    avg_per_customer = EXCLUDED.avg_per_customer;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 7. 環境変数の設定

Next.jsアプリケーションの `.env.local` ファイルに以下を設定:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

# ML API Configuration (後で設定)
ML_API_URL=https://your-ml-api.com
ML_API_KEY=your_ml_api_key

# Weather API Configuration
WEATHER_API_KEY=your_weather_api_key
WEATHER_API_URL=https://api.weatherapi.com/v1

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 8. 動作確認

### 8.1 接続テスト

1. Next.jsアプリケーションを起動:
   ```bash
   cd airregi-predict-app
   npm run dev
   ```

2. ブラウザで `http://localhost:3000` を開く
3. ログインページが表示されることを確認
4. 新規登録してアカウントを作成
5. ダッシュボードにリダイレクトされることを確認

### 8.2 データベース確認

Supabaseダッシュボードの「Table Editor」で:
1. `profiles` テーブルに新しいユーザーが登録されていることを確認
2. 各テーブルが正しく作成されていることを確認

## 9. トラブルシューティング

### エラー: "relation does not exist"

- テーブルが正しく作成されていない可能性があります
- SQL Editorで再度テーブル作成SQLを実行してください

### エラー: "new row violates row-level security policy"

- RLSポリシーが正しく設定されていない可能性があります
- ポリシーの作成SQLを再度実行してください

### ログインできない

- 環境変数が正しく設定されているか確認
- Supabaseプロジェクトの認証設定を確認
- ブラウザのコンソールでエラーメッセージを確認

## 10. 次のステップ

1. **データのインポート**: データ管理ページからジャーナル履歴CSVをアップロード
2. **ML APIのデプロイ**: FastAPI予測サービスをデプロイ
3. **Vercelへのデプロイ**: Next.jsアプリケーションを本番環境にデプロイ

## 参考リンク

- [Supabase ドキュメント](https://supabase.com/docs)
- [Supabase Authentication](https://supabase.com/docs/guides/auth)
- [Supabase Database](https://supabase.com/docs/guides/database)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
