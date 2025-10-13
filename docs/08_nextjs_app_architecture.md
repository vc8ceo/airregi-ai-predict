# Next.js アプリケーション設計書

## 1. システム概要

### 1.1 アプリケーション名
**AirrePred (エアプレ)** - Airレジ予測アプリケーション

### 1.2 目的
POSレジ（Airレジ）のデータを分析し、機械学習により来店数と売上を予測するSaaS型Webアプリケーション

### 1.3 主要機能
1. **ユーザー認証**: メール認証、Google OAuth
2. **ダッシュボード**: 売上分析、来店数推移、トレンド分析
3. **予測機能**: 来店数・売上の予測（翌日、1週間先）
4. **データ管理**: ジャーナル履歴のアップロード・管理
5. **レポート**: 過去実績と予測精度の比較

## 2. 技術スタック

### 2.1 フロントエンド
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Charts**: Recharts / Chart.js
- **State Management**: Zustand / React Context
- **Form Validation**: React Hook Form + Zod

### 2.2 バックエンド
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage (CSV アップロード用)
- **API**: Next.js API Routes / Server Actions
- **ML API**: Python FastAPI (別途デプロイ)

### 2.3 デプロイ・インフラ
- **Frontend**: Vercel
- **ML API**: Vercel (Python), Railway, または Render
- **Database**: Supabase (クラウド)
- **CI/CD**: GitHub Actions

### 2.4 外部サービス
- **天気API**: OpenWeatherMap / WeatherAPI
- **監視**: Vercel Analytics, Sentry

---

## 3. アーキテクチャ図

```
┌─────────────────────────────────────────────────────────────┐
│                        ユーザー                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Next.js Frontend (Vercel)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Pages                                                │   │
│  │  - /login, /signup                                   │   │
│  │  - /dashboard                                        │   │
│  │  - /prediction                                       │   │
│  │  - /data-management                                  │   │
│  │  - /settings                                         │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  API Routes / Server Actions                         │   │
│  │  - /api/predict                                      │   │
│  │  - /api/upload                                       │   │
│  │  - /api/analytics                                    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────┬────────────────┘
                      │                       │
                      ▼                       ▼
         ┌────────────────────┐   ┌──────────────────────┐
         │  Supabase          │   │  ML API (FastAPI)    │
         │  - Auth            │   │  - /predict/next-day │
         │  - PostgreSQL      │   │  - /train            │
         │  - Storage         │   │  - /health           │
         │  - Realtime        │   └───────────┬──────────┘
         └────────────────────┘               │
                                              ▼
                                   ┌──────────────────────┐
                                   │  天気API             │
                                   │  (WeatherAPI)        │
                                   └──────────────────────┘
```

---

## 4. データベース設計（Supabase）

### 4.1 テーブル構成

#### users (Supabase Auth管理)
Supabase Authが自動管理。追加のプロファイル情報は `profiles` テーブルで管理。

#### profiles
```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  store_name TEXT,
  store_location TEXT,
  store_lat DECIMAL(9,6),
  store_lon DECIMAL(9,6),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);
```

#### journal_data
```sql
CREATE TABLE journal_data (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  receipt_no TEXT NOT NULL,
  sales_date DATE NOT NULL,
  sales_time TIME NOT NULL,
  store_id TEXT,
  store_name TEXT,
  product_name TEXT,
  unit_price DECIMAL(10,2),
  quantity INTEGER,
  subtotal DECIMAL(10,2),
  tax_amount DECIMAL(10,2),
  total_amount DECIMAL(10,2),
  payment_method TEXT,
  raw_data JSONB, -- 元のCSV行を全て保存
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_journal_user_date ON journal_data(user_id, sales_date);
CREATE INDEX idx_journal_receipt ON journal_data(receipt_no);

-- Row Level Security
ALTER TABLE journal_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data"
  ON journal_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data"
  ON journal_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

#### daily_aggregated
```sql
CREATE TABLE daily_aggregated (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  date DATE NOT NULL,
  visitor_count INTEGER NOT NULL,
  sales_amount DECIMAL(10,2) NOT NULL,
  avg_per_customer DECIMAL(10,2),
  total_items INTEGER,
  peak_hour INTEGER,
  weather_condition TEXT,
  temp_max DECIMAL(5,2),
  temp_min DECIMAL(5,2),
  temp_avg DECIMAL(5,2),
  humidity INTEGER,
  precipitation DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- インデックス
CREATE INDEX idx_daily_user_date ON daily_aggregated(user_id, date);

-- Row Level Security
ALTER TABLE daily_aggregated ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own aggregated data"
  ON daily_aggregated FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own aggregated data"
  ON daily_aggregated FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own aggregated data"
  ON daily_aggregated FOR UPDATE
  USING (auth.uid() = user_id);
```

#### predictions
```sql
CREATE TABLE predictions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  prediction_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  predicted_visitor_count INTEGER NOT NULL,
  predicted_sales_amount DECIMAL(10,2) NOT NULL,
  confidence_lower_visitor INTEGER,
  confidence_upper_visitor INTEGER,
  confidence_lower_sales DECIMAL(10,2),
  confidence_upper_sales DECIMAL(10,2),
  actual_visitor_count INTEGER,
  actual_sales_amount DECIMAL(10,2),
  model_version TEXT,
  weather_forecast JSONB,
  UNIQUE(user_id, prediction_date, created_at)
);

-- インデックス
CREATE INDEX idx_predictions_user_date ON predictions(user_id, prediction_date);

-- Row Level Security
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own predictions"
  ON predictions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own predictions"
  ON predictions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

#### upload_history
```sql
CREATE TABLE upload_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_path TEXT, -- Supabase Storage path
  rows_imported INTEGER,
  date_range_start DATE,
  date_range_end DATE,
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Row Level Security
ALTER TABLE upload_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own uploads"
  ON upload_history FOR SELECT
  USING (auth.uid() = user_id);
```

---

## 5. Next.js プロジェクト構成

```
airregi-predict-app/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── signup/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── prediction/
│   │   │   └── page.tsx
│   │   ├── data-management/
│   │   │   └── page.tsx
│   │   ├── analytics/
│   │   │   └── page.tsx
│   │   ├── settings/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── api/
│   │   ├── predict/
│   │   │   └── route.ts
│   │   ├── upload/
│   │   │   └── route.ts
│   │   ├── analytics/
│   │   │   └── route.ts
│   │   └── webhook/
│   │       └── route.ts
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── ui/            # shadcn/ui components
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── SignupForm.tsx
│   │   └── GoogleAuthButton.tsx
│   ├── dashboard/
│   │   ├── DashboardHeader.tsx
│   │   ├── StatsCard.tsx
│   │   ├── SalesChart.tsx
│   │   ├── VisitorChart.tsx
│   │   └── TrendAnalysis.tsx
│   ├── prediction/
│   │   ├── PredictionCard.tsx
│   │   ├── PredictionForm.tsx
│   │   └── PredictionHistory.tsx
│   ├── data-management/
│   │   ├── FileUploader.tsx
│   │   ├── DataTable.tsx
│   │   └── UploadHistory.tsx
│   └── layout/
│       ├── Navbar.tsx
│       ├── Sidebar.tsx
│       └── Footer.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts      # Client-side Supabase client
│   │   ├── server.ts      # Server-side Supabase client
│   │   └── middleware.ts  # Auth middleware
│   ├── api/
│   │   ├── predictions.ts
│   │   ├── analytics.ts
│   │   └── uploads.ts
│   ├── utils/
│   │   ├── date.ts
│   │   ├── format.ts
│   │   └── validation.ts
│   └── types/
│       ├── database.ts
│       ├── prediction.ts
│       └── user.ts
├── hooks/
│   ├── useAuth.ts
│   ├── usePrediction.ts
│   ├── useAnalytics.ts
│   └── useUpload.ts
├── store/
│   ├── authStore.ts
│   └── appStore.ts
├── public/
│   ├── images/
│   └── icons/
├── .env.local
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 6. 主要ページ設計

### 6.1 ログイン/サインアップ (`/login`, `/signup`)

**機能**:
- メールアドレス・パスワードでのログイン
- Google OAuth認証
- パスワードリセット

**実装例**:
```typescript
// app/(auth)/login/page.tsx
import { LoginForm } from '@/components/auth/LoginForm'
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">AirrePred</h1>
          <p className="text-gray-600">ログインして予測を開始</p>
        </div>

        <GoogleAuthButton />

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-2 text-gray-500">または</span>
          </div>
        </div>

        <LoginForm />
      </div>
    </div>
  )
}
```

---

### 6.2 ダッシュボード (`/dashboard`)

**機能**:
- 売上推移グラフ（日次、週次、月次）
- 来店数推移グラフ
- 主要KPI表示（今日の売上、来店数、前日比）
- 予測精度サマリー

**レイアウト**:
```
┌─────────────────────────────────────────────────────────┐
│  Navbar (ロゴ、ユーザーメニュー)                          │
├─────────────────────────────────────────────────────────┤
│  ┌──────┐  ┌─────────────────────────────────────────┐ │
│  │      │  │  Dashboard                              │ │
│  │ Side │  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │ │
│  │ bar  │  │  │今日の│ │来店数│ │売上 │ │予測  │  │ │
│  │      │  │  │売上 │ │     │ │前日比│ │精度 │  │ │
│  │ - 📊 │  │  └──────┘ └──────┘ └──────┘ └──────┘  │ │
│  │ - 🔮 │  │                                         │ │
│  │ - 📁 │  │  ┌─────────────────────────────────┐  │ │
│  │ - ⚙️ │  │  │  売上推移グラフ                  │  │ │
│  │      │  │  │  (Recharts)                     │  │ │
│  │      │  │  └─────────────────────────────────┘  │ │
│  │      │  │                                         │ │
│  │      │  │  ┌─────────────────────────────────┐  │ │
│  │      │  │  │  来店数推移グラフ                │  │ │
│  │      │  │  └─────────────────────────────────┘  │ │
│  └──────┘  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

### 6.3 予測ページ (`/prediction`)

**機能**:
- 「予測を実行」ボタン
- 予測結果の表示（来店数、売上、信頼区間）
- 予測に使用した天気情報の表示
- 過去の予測履歴

**実装例**:
```typescript
// app/(dashboard)/prediction/page.tsx
'use client'

import { useState } from 'react'
import { usePrediction } from '@/hooks/usePrediction'
import { PredictionCard } from '@/components/prediction/PredictionCard'
import { Button } from '@/components/ui/button'

export default function PredictionPage() {
  const { predict, prediction, isLoading } = usePrediction()

  const handlePredict = async () => {
    await predict()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">売上・来店数予測</h1>
        <Button
          onClick={handlePredict}
          disabled={isLoading}
        >
          {isLoading ? '予測中...' : '予測を実行'}
        </Button>
      </div>

      {prediction && (
        <div className="grid gap-6 md:grid-cols-2">
          <PredictionCard
            title="来店数予測"
            value={prediction.predicted_visitor_count}
            confidenceInterval={[
              prediction.confidence_lower_visitor,
              prediction.confidence_upper_visitor
            ]}
            icon="👥"
          />

          <PredictionCard
            title="売上予測"
            value={prediction.predicted_sales_amount}
            confidenceInterval={[
              prediction.confidence_lower_sales,
              prediction.confidence_upper_sales
            ]}
            icon="💰"
          />
        </div>
      )}

      <WeatherForecast forecast={prediction?.weather_forecast} />

      <PredictionHistory />
    </div>
  )
}
```

---

### 6.4 データ管理ページ (`/data-management`)

**機能**:
- CSVファイルのアップロード（ドラッグ&ドロップ）
- アップロード履歴
- データプレビュー
- データ削除

**実装例**:
```typescript
// components/data-management/FileUploader.tsx
'use client'

import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useUpload } from '@/hooks/useUpload'

export function FileUploader() {
  const { uploadFile, isUploading } = useUpload()

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file) {
      await uploadFile(file)
    }
  }, [uploadFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    maxFiles: 1
  })

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
        ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
      `}
    >
      <input {...getInputProps()} />
      {isDragActive ? (
        <p>ファイルをドロップしてください...</p>
      ) : (
        <div>
          <p>CSVファイルをドラッグ&ドロップ</p>
          <p className="text-sm text-gray-500">または クリックして選択</p>
        </div>
      )}
    </div>
  )
}
```

---

## 7. API設計

### 7.1 予測API (`/api/predict`)

```typescript
// app/api/predict/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })

  // 認証チェック
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ユーザーの店舗情報を取得
  const { data: profile } = await supabase
    .from('profiles')
    .select('store_location, store_lat, store_lon')
    .eq('id', user.id)
    .single()

  // ML APIを呼び出し
  const mlApiUrl = process.env.ML_API_URL
  const response = await fetch(`${mlApiUrl}/predict/next-day`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.ML_API_KEY}`
    },
    body: JSON.stringify({
      user_id: user.id,
      location: profile.store_location
    })
  })

  const prediction = await response.json()

  // 予測結果をDBに保存
  const { data: savedPrediction, error } = await supabase
    .from('predictions')
    .insert({
      user_id: user.id,
      prediction_date: prediction.prediction_date,
      predicted_visitor_count: prediction.predictions.visitor_count.value,
      predicted_sales_amount: prediction.predictions.sales_amount.value,
      confidence_lower_visitor: prediction.predictions.visitor_count.confidence_interval.lower,
      confidence_upper_visitor: prediction.predictions.visitor_count.confidence_interval.upper,
      confidence_lower_sales: prediction.predictions.sales_amount.confidence_interval.lower,
      confidence_upper_sales: prediction.predictions.sales_amount.confidence_interval.upper,
      model_version: prediction.model_info.visitor_model,
      weather_forecast: prediction.weather_forecast
    })
    .select()
    .single()

  return NextResponse.json(savedPrediction)
}
```

### 7.2 アップロードAPI (`/api/upload`)

```typescript
// app/api/upload/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // Supabase Storageにアップロード
  const fileName = `${user.id}/${Date.now()}_${file.name}`
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('journal-uploads')
    .upload(fileName, file)

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // アップロード履歴を記録
  const { data: uploadHistory } = await supabase
    .from('upload_history')
    .insert({
      user_id: user.id,
      file_name: file.name,
      file_size: file.size,
      file_path: fileName,
      status: 'pending'
    })
    .select()
    .single()

  // バックグラウンドでCSV処理を開始（Queue/Webhook経由）
  await fetch(`${process.env.NEXT_PUBLIC_URL}/api/process-csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: user.id,
      upload_id: uploadHistory.id,
      file_path: fileName
    })
  })

  return NextResponse.json({ upload_id: uploadHistory.id })
}
```

---

## 8. 認証フロー

### 8.1 Supabase Auth セットアップ

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}
```

### 8.2 認証ミドルウェア

```typescript
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const { data: { session } } = await supabase.auth.getSession()

  // 認証が必要なページ
  const protectedPaths = ['/dashboard', '/prediction', '/data-management', '/settings']
  const isProtectedPath = protectedPaths.some(path => req.nextUrl.pathname.startsWith(path))

  if (isProtectedPath && !session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // ログイン済みユーザーがauth pageにアクセスした場合
  if ((req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/signup') && session) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

---

## 9. ML API統合

### 9.1 Python FastAPI（別途デプロイ）

既存の `src/api/main.py` を使用し、Vercel Pythonまたは Railway にデプロイ

**Vercel Python デプロイ用設定**:
```json
// vercel.json (ML APIプロジェクト用)
{
  "builds": [
    {
      "src": "src/api/main.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/api/main.py"
    }
  ]
}
```

### 9.2 Next.jsからML APIを呼び出す

```typescript
// lib/api/predictions.ts
export async function callPredictionAPI(userId: string, location: string) {
  const response = await fetch(`${process.env.ML_API_URL}/predict/next-day`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.ML_API_KEY}`
    },
    body: JSON.stringify({
      user_id: userId,
      location: location
    })
  })

  if (!response.ok) {
    throw new Error('Prediction API call failed')
  }

  return response.json()
}
```

---

## 10. デプロイ戦略

### 10.1 Vercel デプロイ（Next.js）

```bash
# 1. Vercelプロジェクトを作成
vercel

# 2. 環境変数を設定
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add ML_API_URL
vercel env add ML_API_KEY
vercel env add WEATHER_API_KEY

# 3. デプロイ
vercel --prod
```

### 10.2 ML API デプロイ（Railway）

```bash
# Railway CLIでデプロイ
railway login
railway init
railway up
```

または、Vercel Python:
```bash
cd ml-api
vercel --prod
```

### 10.3 Supabase セットアップ

1. Supabaseプロジェクトを作成
2. SQLエディタでテーブルを作成（上記のSQLを実行）
3. Storageバケット `journal-uploads` を作成
4. 認証設定でGoogle OAuthを有効化

---

## 11. 環境変数

### 11.1 Next.js (.env.local)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ML API
ML_API_URL=https://your-ml-api.vercel.app
ML_API_KEY=your-ml-api-key

# App
NEXT_PUBLIC_URL=https://your-app.vercel.app

# Weather API
WEATHER_API_KEY=your-weather-api-key
```

---

## 12. 次のステップ

1. **Next.jsプロジェクトの作成**
2. **Supabaseプロジェクトのセットアップ**
3. **認証機能の実装**
4. **ダッシュボードの実装**
5. **予測機能の実装**
6. **デプロイ**

---

## 更新履歴

| 日付 | バージョン | 更新内容 | 作成者 |
|------|------------|----------|--------|
| 2025-10-13 | 1.0 | 初版作成 | Claude |
