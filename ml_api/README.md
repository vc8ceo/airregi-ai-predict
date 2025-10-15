# ML API for Airレジ予測システム

機械学習による来店者数・売上予測APIサービス

## 🚀 クイックスタート

### 1. 依存関係のインストール

```bash
# Windows
.\venv\Scripts\activate
pip install -r requirements.txt

# Mac/Linux
source venv/bin/activate
pip install -r requirements.txt
```

### 2. 環境変数の設定

`.env`ファイルを編集して必要な認証情報を設定:

```bash
# Supabase Service Role Key を取得
# Supabase Dashboard > Settings > API > Service role key

# Weather API Key を取得 (オプション)
# https://www.weatherapi.com/signup.aspx

# ML API Key を生成
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 3. サーバーの起動

```bash
# Pythonスクリプトで起動（推奨）
python run_server.py

# または直接uvicornで起動
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. APIドキュメントの確認

ブラウザで開く: http://localhost:8000/docs

## 📋 必要な環境変数

| 環境変数 | 説明 | 取得方法 |
|---------|------|----------|
| `SUPABASE_URL` | SupabaseプロジェクトのURL | Supabase Dashboard > Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | サービスロールキー（バックエンド用） | Supabase Dashboard > Settings > API > Service role |
| `WEATHER_API_KEY` | WeatherAPI.comのAPIキー（オプション） | https://www.weatherapi.com/signup.aspx |
| `ML_API_KEY` | Next.jsアプリとの認証用キー | ランダム生成 |

## 🔗 Next.js アプリとの連携

Next.jsアプリの`.env.local`を更新:

```bash
ML_API_URL=http://localhost:8000  # ローカル開発
ML_API_KEY=<ML APIで設定したキーと同じ値>
```

## 📊 APIエンドポイント

### POST `/predict/next-day`

来店者数と売上を予測

**リクエスト:**
```json
{
  "user_id": "uuid",
  "location": {
    "lat": 35.6762,
    "lon": 139.6503
  },
  "prediction_date": "2025-01-17"  // オプション
}
```

**レスポンス:**
```json
{
  "prediction_date": "2025-01-17",
  "predictions": {
    "visitor_count": {
      "value": 48,
      "confidence_lower": 40,
      "confidence_upper": 56
    },
    "sales_amount": {
      "value": 26392,
      "confidence_lower": 21892,
      "confidence_upper": 30892
    }
  },
  "weather_forecast": {
    "condition": "晴れ",
    "temp_max": 18,
    "temp_min": 10,
    "precipitation": 23
  },
  "model_version": "v1.0.0-lightgbm",
  "model_metrics": {
    "visitor_mape": 12.3,
    "sales_mape": 18.5,
    "training_samples": 90
  }
}
```

## 🏗️ プロジェクト構成

```
ml_api/
├── main.py                  # FastAPI アプリケーション
├── run_server.py           # 開発サーバー起動スクリプト
├── requirements.txt        # Python依存関係
├── .env                    # 環境変数（Git対象外）
├── services/
│   ├── database.py        # Supabase データアクセス
│   └── weather.py         # 天気予報API
├── models/
│   ├── lightgbm_model.py  # LightGBM予測モデル
│   └── model_cache.py     # 予測結果キャッシュ
└── features/
    └── engineering.py      # 特徴量エンジニアリング
```

## 🔍 トラブルシューティング

### 「No historical data available」エラー

→ ユーザーがCSVデータをアップロードしていない
→ Next.jsアプリのデータ管理ページからCSVをアップロード

### 「Insufficient data for prediction」エラー

→ 30日分以上のデータが必要
→ より多くの履歴データをアップロード

### Weather API関連のエラー

→ WEATHER_API_KEYが未設定または無効
→ 設定されていない場合は平均的な天気データで代替

### Supabase接続エラー

→ SUPABASE_SERVICE_ROLE_KEYが正しく設定されているか確認
→ Service Role Key（anon keyではない）を使用

## 📈 モデルの精度向上

現在のMVPは基本的なLightGBMモデルを使用。精度向上のための改善案:

1. **特徴量の追加**
   - 祝日前後フラグ
   - イベント情報
   - 競合店情報

2. **モデルのアンサンブル**
   - Prophet（季節性）
   - LSTM（時系列パターン）

3. **ハイパーパラメータチューニング**
   - Optunaによる自動最適化

## 🚀 デプロイメント

### Railway へのデプロイ例

1. GitHubリポジトリを作成
2. Railway.appでプロジェクト作成
3. 環境変数を設定
4. デプロイ完了後、URLをNext.jsアプリに設定

### Dockerを使用する場合

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 📝 開発メモ

- **キャッシュ**: 6時間有効（同じ予測を繰り返さない）
- **バッチサイズ**: Supabaseクエリは1000件ずつ
- **最小データ**: 予測には30日分以上必要
- **信頼区間**: 90%信頼区間（z-score=1.645）

## 🤝 貢献

Phase 2以降の実装計画は`ml_api_implementation_plan.md`を参照