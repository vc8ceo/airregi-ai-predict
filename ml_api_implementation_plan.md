# ML API 実装計画

## ディレクトリ構成

```
ml_api/
├── main.py                    # FastAPI アプリケーション
├── requirements.txt
├── .env
├── services/
│   ├── database.py           # Supabase 接続
│   └── weather.py            # 天気予報API
├── models/
│   ├── lightgbm_model.py     # LightGBM モデル
│   └── model_cache.py        # モデルキャッシュ
└── features/
    └── engineering.py         # 特徴量生成
```

## 実装の優先順位

### 🟢 Phase 1: MVP（最小機能製品） - 2週間

**目標**: デモモードを実データベースのML予測に置き換え

1. **FastAPI セットアップ**
   - `main.py` で `/predict/next-day` エンドポイント作成
   - CORS設定、認証ミドルウェア

2. **Supabase データ取得**
   - `daily_aggregated` テーブルから過去データ取得
   - ページネーション対応（1000件制限）

3. **シンプルな特徴量**
   - 曜日（one-hot encoding）
   - 過去7日移動平均（来店者数、売上）
   - 前週同曜日の値

4. **基本的なLightGBMモデル**
   - 訓練: 過去のデータで2つのモデル（来店者数、売上）を学習
   - 予測: 翌日の予測値と信頼区間（±標準偏差）

5. **天気予報API統合（簡易版）**
   - OpenWeatherMap または WeatherAPI.com
   - 気温（最高/最低）、天候、降水確率のみ

### 🟡 Phase 2: 機能強化 - 3-4週間

**目標**: 予測精度向上と運用安定化

6. **高度な特徴量エンジニアリング**
   - ラグ特徴量（7日、14日、28日移動平均）
   - ローリングウィンドウ統計（標準偏差、最大値、最小値）
   - トレンド特徴量（前週比、前月比成長率）
   - 祝日フラグ（日本の祝日カレンダー統合）

7. **天気特徴量の拡充**
   - 気温（数値）
   - 降水確率（数値）
   - 天候カテゴリ（晴れ=0, 曇り=1, 雨=2 など）
   - 体感温度、風速、湿度

8. **モデルキャッシュシステム**
   - 学習済みモデルをファイル保存（pickle or joblib）
   - ユーザーごとにモデル管理
   - 新データアップロード時に自動再学習トリガー

9. **信頼区間の改善**
   - LightGBM quantile regression（10%, 90%パーセンタイル）
   - Bootstrap サンプリングで信頼区間推定

10. **API デプロイメント**
    - Dockerfile作成
    - Railway / Render / Cloud Run へデプロイ
    - 環境変数設定（Supabase認証情報、Weather API key）

### 🔵 Phase 3: 高度な予測モデル - 4-6週間

**目標**: 複数モデルのアンサンブルと季節性対応

11. **Prophet モデルの追加**
    - 長期トレンドと季節性の捉え方
    - 年間パターン（夏季繁忙期、冬季閑散期など）

12. **LSTM モデル（オプション）**
    - 複雑な時系列パターンの学習
    - 直近の連続的な変動を捉える

13. **アンサンブル予測**
    - LightGBM + Prophet の加重平均
    - 各モデルの過去精度に基づく重み付け

14. **モデル評価ダッシュボード**
    - 予測精度メトリクス（MAPE, MAE, RMSE）の追跡
    - 実測値 vs 予測値の可視化
    - モデル再学習の自動トリガー（精度低下時）

15. **最適化**
    - ハイパーパラメータチューニング（Optuna使用）
    - 特徴量の重要度分析
    - 外れ値検出と除外

## 必要なライブラリ

```txt
# requirements.txt
fastapi==0.104.1
uvicorn==0.24.0
pandas==2.1.3
numpy==1.26.2
scikit-learn==1.3.2
lightgbm==4.1.0
prophet==1.1.5
supabase-py==2.0.3
python-dotenv==1.0.0
requests==2.31.0
pydantic==2.5.0
joblib==1.3.2
optuna==3.4.0  # Phase 3
```

## 環境変数 (.env)

```bash
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxxx  # サービスロールキー（バックエンド専用）

# Weather API
WEATHER_API_KEY=xxxxx
WEATHER_API_URL=https://api.weatherapi.com/v1

# API Security
ML_API_KEY=xxxxx  # Next.js から呼ばれる際の認証キー
```

## 最小実装例（Phase 1）

### main.py
```python
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
import os
from services.database import get_user_historical_data
from services.weather import get_weather_forecast
from models.lightgbm_model import train_and_predict

app = FastAPI()

class PredictionRequest(BaseModel):
    user_id: str
    location: dict  # {"lat": float, "lon": float}

class PredictionResponse(BaseModel):
    prediction_date: str
    predictions: dict
    weather_forecast: dict
    model_version: str

@app.post("/predict/next-day")
async def predict_next_day(
    request: PredictionRequest,
    authorization: str = Header(None)
):
    # 認証チェック
    api_key = os.getenv("ML_API_KEY")
    if not authorization or authorization != f"Bearer {api_key}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        # 1. 履歴データ取得
        historical_data = await get_user_historical_data(request.user_id)

        # 2. 天気予報取得
        weather_forecast = await get_weather_forecast(
            request.location["lat"],
            request.location["lon"]
        )

        # 3. モデル学習 & 予測
        prediction = train_and_predict(historical_data, weather_forecast)

        return PredictionResponse(
            prediction_date=prediction["date"],
            predictions=prediction["values"],
            weather_forecast=weather_forecast,
            model_version="v1.0-lightgbm"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### services/database.py
```python
from supabase import create_client
import os
import pandas as pd

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

async def get_user_historical_data(user_id: str) -> pd.DataFrame:
    """ユーザーの過去データを取得（ページネーション対応）"""
    all_data = []
    range_start = 0
    range_size = 1000

    while True:
        response = supabase.table("daily_aggregated") \
            .select("date, visitor_count, sales_amount, day_of_week, is_holiday") \
            .eq("user_id", user_id) \
            .order("date", desc=False) \
            .range(range_start, range_start + range_size - 1) \
            .execute()

        if not response.data:
            break

        all_data.extend(response.data)

        if len(response.data) < range_size:
            break

        range_start += range_size

    return pd.DataFrame(all_data)
```

### services/weather.py
```python
import requests
import os
from datetime import datetime, timedelta

async def get_weather_forecast(lat: float, lon: float) -> dict:
    """WeatherAPI.com から明日の天気予報を取得"""
    api_key = os.getenv("WEATHER_API_KEY")
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

    url = f"{os.getenv('WEATHER_API_URL')}/forecast.json"
    params = {
        "key": api_key,
        "q": f"{lat},{lon}",
        "dt": tomorrow,
        "lang": "ja"
    }

    response = requests.get(url, params=params)
    response.raise_for_status()
    data = response.json()

    forecast_day = data["forecast"]["forecastday"][0]["day"]

    return {
        "condition": forecast_day["condition"]["text"],
        "temp_max": forecast_day["maxtemp_c"],
        "temp_min": forecast_day["mintemp_c"],
        "precipitation": forecast_day["daily_chance_of_rain"]
    }
```

### models/lightgbm_model.py
```python
import pandas as pd
import numpy as np
import lightgbm as lgb
from datetime import datetime, timedelta

def create_features(df: pd.DataFrame, weather: dict) -> pd.DataFrame:
    """基本的な特徴量を生成"""
    df = df.copy()
    df['date'] = pd.to_datetime(df['date'])

    # 過去7日移動平均
    df['visitor_ma7'] = df['visitor_count'].rolling(window=7, min_periods=1).mean()
    df['sales_ma7'] = df['sales_amount'].rolling(window=7, min_periods=1).mean()

    # 曜日 one-hot encoding
    df['dow_0'] = (df['day_of_week'] == 0).astype(int)  # 日曜
    df['dow_1'] = (df['day_of_week'] == 1).astype(int)
    # ... 省略 ...
    df['dow_6'] = (df['day_of_week'] == 6).astype(int)  # 土曜

    return df

def train_and_predict(historical_data: pd.DataFrame, weather: dict) -> dict:
    """LightGBM で学習して予測"""
    if len(historical_data) < 30:
        raise ValueError("最低30日分のデータが必要です")

    # 特徴量生成
    df = create_features(historical_data, weather)

    # 訓練データ準備
    feature_cols = ['dow_0', 'dow_1', 'dow_2', 'dow_3', 'dow_4', 'dow_5', 'dow_6',
                    'visitor_ma7', 'sales_ma7', 'is_holiday']
    X = df[feature_cols].iloc[:-1]  # 最新日を除く
    y_visitors = df['visitor_count'].iloc[:-1]
    y_sales = df['sales_amount'].iloc[:-1]

    # モデル訓練
    model_visitors = lgb.LGBMRegressor(n_estimators=100, random_state=42)
    model_sales = lgb.LGBMRegressor(n_estimators=100, random_state=42)

    model_visitors.fit(X, y_visitors)
    model_sales.fit(X, y_sales)

    # 明日の特徴量作成
    tomorrow = datetime.now() + timedelta(days=1)
    tomorrow_dow = tomorrow.weekday() + 1 if tomorrow.weekday() < 6 else 0

    X_tomorrow = pd.DataFrame([{
        'dow_0': int(tomorrow_dow == 0),
        'dow_1': int(tomorrow_dow == 1),
        'dow_2': int(tomorrow_dow == 2),
        'dow_3': int(tomorrow_dow == 3),
        'dow_4': int(tomorrow_dow == 4),
        'dow_5': int(tomorrow_dow == 5),
        'dow_6': int(tomorrow_dow == 6),
        'visitor_ma7': df['visitor_ma7'].iloc[-1],
        'sales_ma7': df['sales_ma7'].iloc[-1],
        'is_holiday': False  # 簡易版（祝日カレンダー未統合）
    }])

    # 予測
    visitor_pred = model_visitors.predict(X_tomorrow)[0]
    sales_pred = model_sales.predict(X_tomorrow)[0]

    # 信頼区間（簡易版: 訓練データの標準偏差ベース）
    visitor_std = y_visitors.std()
    sales_std = y_sales.std()

    return {
        "date": tomorrow.strftime("%Y-%m-%d"),
        "values": {
            "visitor_count": {
                "value": int(visitor_pred),
                "confidence_lower": int(visitor_pred - visitor_std),
                "confidence_upper": int(visitor_pred + visitor_std)
            },
            "sales_amount": {
                "value": float(sales_pred),
                "confidence_lower": float(sales_pred - sales_std),
                "confidence_upper": float(sales_pred + sales_std)
            }
        }
    }
```

## デプロイ手順（Railway 例）

1. **GitHub リポジトリ作成**
   ```bash
   cd ml_api
   git init
   git add .
   git commit -m "Initial ML API implementation"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Railway でデプロイ**
   - Railway.app にログイン
   - "New Project" → "Deploy from GitHub repo"
   - `ml_api` リポジトリ選択
   - 環境変数設定（SUPABASE_URL, ML_API_KEY など）
   - デプロイ完了後、URLを取得（例: `https://ml-api-production.up.railway.app`）

3. **Next.js 側の環境変数更新**
   ```bash
   # .env.local と Vercel
   ML_API_URL=https://ml-api-production.up.railway.app
   ML_API_KEY=your_secure_api_key
   ```

4. **動作確認**
   - Next.js の予測ページで日付を選択 → 予測実行
   - デモモードではなく、実際のMLモデルによる予測が表示される
   - Network タブで `/api/predict` → ML API へのリクエストを確認

## 段階的なリリース戦略

1. **Alpha版（Phase 1）**: 内部テスト、デモモードと並行稼働
2. **Beta版（Phase 2）**: 一部ユーザーで実運用、精度検証
3. **Production版（Phase 3）**: 全ユーザーに展開、デモモード削除

## 成功指標

- **Phase 1**: MLモデルが動作し、デモモードより良い予測ができる
- **Phase 2**: MAPE < 20%（売上）、MAPE < 15%（来店者数）
- **Phase 3**: ユーザー満足度 80% 以上、継続利用率 60% 以上
