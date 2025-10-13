# 予測API設計書

## 1. 概要

本ドキュメントでは、来店数・売上予測を提供するREST APIの設計を定義します。

## 2. 技術スタック

- **フレームワーク**: FastAPI
- **ASGIサーバー**: Uvicorn
- **データバリデーション**: Pydantic
- **ドキュメント**: OpenAPI (Swagger UI, ReDoc)

## 3. APIエンドポイント

### 3.1 エンドポイント一覧

| メソッド | エンドポイント | 説明 |
|---------|--------------|------|
| GET | `/` | ヘルスチェック |
| GET | `/health` | ヘルスチェック（詳細） |
| GET | `/predict/next-day` | 翌営業日の予測 |
| GET | `/predict/date/{date}` | 指定日の予測 |
| POST | `/predict/custom` | カスタム特徴量での予測 |
| GET | `/metrics` | モデル評価指標 |
| POST | `/train` | モデル再学習 |
| GET | `/history` | 予測履歴の取得 |
| GET | `/models` | 利用可能なモデル一覧 |

---

### 3.2 エンドポイント詳細

#### 3.2.1 GET `/` - ルート

**説明**: APIのヘルスチェック

**レスポンス例**:
```json
{
  "status": "ok",
  "message": "Airregi AI Predict API is running",
  "version": "1.0.0"
}
```

---

#### 3.2.2 GET `/health` - ヘルスチェック（詳細）

**説明**: APIとモデルの健全性を確認

**レスポンス例**:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-13T12:00:00Z",
  "models": {
    "visitor_count": {
      "loaded": true,
      "model_type": "lightgbm",
      "last_trained": "2025-10-12T10:30:00Z"
    },
    "sales_amount": {
      "loaded": true,
      "model_type": "lightgbm",
      "last_trained": "2025-10-12T10:30:00Z"
    }
  },
  "data_status": {
    "latest_date": "2025-10-12",
    "total_records": 6259
  }
}
```

---

#### 3.2.3 GET `/predict/next-day` - 翌営業日の予測

**説明**: 翌営業日の来店数と売上を予測

**レスポンス例**:
```json
{
  "prediction_date": "2025-10-14",
  "predictions": {
    "visitor_count": {
      "value": 58,
      "confidence_interval": {
        "lower": 52,
        "upper": 64
      }
    },
    "sales_amount": {
      "value": 2715,
      "confidence_interval": {
        "lower": 2450,
        "upper": 2980
      }
    }
  },
  "weather_forecast": {
    "condition": "Partly cloudy",
    "temp_max": 22.5,
    "temp_min": 16.3,
    "precipitation": 0.0
  },
  "day_info": {
    "day_of_week": "Monday",
    "is_holiday": false,
    "is_weekend": false
  },
  "model_info": {
    "visitor_model": "lightgbm_v1.0",
    "sales_model": "lightgbm_v1.0"
  },
  "generated_at": "2025-10-13T18:00:00Z"
}
```

---

#### 3.2.4 GET `/predict/date/{date}` - 指定日の予測

**説明**: 指定された日付の予測を取得

**パスパラメータ**:
- `date` (string): 予測対象日（YYYY-MM-DD形式）

**クエリパラメータ**:
- なし

**リクエスト例**:
```http
GET /predict/date/2025-10-15
```

**レスポンス例**:
```json
{
  "prediction_date": "2025-10-15",
  "predictions": {
    "visitor_count": {
      "value": 62,
      "confidence_interval": {
        "lower": 56,
        "upper": 68
      }
    },
    "sales_amount": {
      "value": 2890,
      "confidence_interval": {
        "lower": 2600,
        "upper": 3180
      }
    }
  },
  "weather_forecast": {
    "condition": "Sunny",
    "temp_max": 24.0,
    "temp_min": 18.0,
    "precipitation": 0.0
  },
  "day_info": {
    "day_of_week": "Tuesday",
    "is_holiday": false,
    "is_weekend": false
  },
  "generated_at": "2025-10-13T18:00:00Z"
}
```

---

#### 3.2.5 POST `/predict/custom` - カスタム特徴量での予測

**説明**: ユーザーが指定した特徴量で予測を実行（What-Ifシナリオ分析）

**リクエストボディ**:
```json
{
  "date": "2025-10-15",
  "features": {
    "day_of_week": 1,
    "is_weekend": false,
    "is_holiday": false,
    "month": 10,
    "season": 3,
    "temp_max": 25.0,
    "temp_min": 18.0,
    "temp_avg": 21.5,
    "humidity": 65,
    "precipitation": 0.0,
    "wind_speed": 10.0,
    "weather_condition": "sunny"
  }
}
```

**レスポンス例**:
```json
{
  "prediction_date": "2025-10-15",
  "predictions": {
    "visitor_count": {
      "value": 65
    },
    "sales_amount": {
      "value": 3025
    }
  },
  "input_features": {
    "temp_avg": 21.5,
    "weather_condition": "sunny"
  },
  "generated_at": "2025-10-13T18:00:00Z"
}
```

---

#### 3.2.6 GET `/metrics` - モデル評価指標

**説明**: モデルの性能指標を取得

**レスポンス例**:
```json
{
  "visitor_count_model": {
    "model_name": "lightgbm_v1.0",
    "last_trained": "2025-10-12T10:30:00Z",
    "evaluation": {
      "test_mae": 6.5,
      "test_rmse": 8.2,
      "test_mape": 11.3,
      "test_r2": 0.85
    },
    "cross_validation": {
      "mean_mae": 7.1,
      "std_mae": 1.2
    }
  },
  "sales_amount_model": {
    "model_name": "lightgbm_v1.0",
    "last_trained": "2025-10-12T10:30:00Z",
    "evaluation": {
      "test_mae": 425,
      "test_rmse": 550,
      "test_mape": 16.2,
      "test_r2": 0.78
    },
    "cross_validation": {
      "mean_mae": 460,
      "std_mae": 85
    }
  }
}
```

---

#### 3.2.7 POST `/train` - モデル再学習

**説明**: モデルを再学習（管理者用）

**セキュリティ**: API Key認証が必要

**リクエストヘッダー**:
```http
X-API-Key: your_api_key_here
```

**リクエストボディ**:
```json
{
  "model_type": "lightgbm",
  "target": "visitor_count",
  "retrain_all": false
}
```

**レスポンス例**:
```json
{
  "status": "training_started",
  "job_id": "train-20251013-180000",
  "estimated_completion": "2025-10-13T18:15:00Z",
  "message": "Model training started successfully"
}
```

---

#### 3.2.8 GET `/history` - 予測履歴

**説明**: 過去の予測結果と実績を比較

**クエリパラメータ**:
- `start_date` (string): 開始日（YYYY-MM-DD）
- `end_date` (string): 終了日（YYYY-MM-DD）
- `limit` (int): 取得件数（デフォルト: 30）

**リクエスト例**:
```http
GET /history?start_date=2025-10-01&end_date=2025-10-13&limit=10
```

**レスポンス例**:
```json
{
  "records": [
    {
      "date": "2025-10-13",
      "predicted_visitor_count": 58,
      "actual_visitor_count": 62,
      "predicted_sales_amount": 2700,
      "actual_sales_amount": 2890,
      "visitor_error": 4,
      "sales_error": 190,
      "visitor_error_rate": 6.5,
      "sales_error_rate": 6.6
    },
    {
      "date": "2025-10-12",
      "predicted_visitor_count": 55,
      "actual_visitor_count": 54,
      "predicted_sales_amount": 2560,
      "actual_sales_amount": 2520,
      "visitor_error": -1,
      "sales_error": -40,
      "visitor_error_rate": -1.9,
      "sales_error_rate": -1.6
    }
  ],
  "summary": {
    "count": 10,
    "avg_visitor_mae": 5.2,
    "avg_visitor_mape": 9.1,
    "avg_sales_mae": 380,
    "avg_sales_mape": 14.5
  }
}
```

---

#### 3.2.9 GET `/models` - 利用可能なモデル一覧

**説明**: システムで利用可能なモデルの一覧を取得

**レスポンス例**:
```json
{
  "models": [
    {
      "model_id": "lightgbm_visitor_v1.0",
      "target": "visitor_count",
      "algorithm": "LightGBM",
      "version": "1.0",
      "trained_at": "2025-10-12T10:30:00Z",
      "is_active": true
    },
    {
      "model_id": "prophet_visitor_v1.0",
      "target": "visitor_count",
      "algorithm": "Prophet",
      "version": "1.0",
      "trained_at": "2025-10-11T09:00:00Z",
      "is_active": false
    },
    {
      "model_id": "lightgbm_sales_v1.0",
      "target": "sales_amount",
      "algorithm": "LightGBM",
      "version": "1.0",
      "trained_at": "2025-10-12T10:30:00Z",
      "is_active": true
    }
  ]
}
```

---

## 4. Pydanticスキーマ定義

```python
from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from datetime import datetime

class PredictionResponse(BaseModel):
    """予測レスポンス"""
    prediction_date: str = Field(..., description="予測対象日")
    predictions: Dict[str, Dict] = Field(..., description="予測結果")
    weather_forecast: Optional[Dict] = Field(None, description="天気予報")
    day_info: Dict = Field(..., description="日付情報")
    model_info: Optional[Dict] = Field(None, description="モデル情報")
    generated_at: datetime = Field(..., description="予測生成日時")

class CustomPredictionRequest(BaseModel):
    """カスタム予測リクエスト"""
    date: str = Field(..., description="予測対象日（YYYY-MM-DD）")
    features: Dict[str, float] = Field(..., description="特徴量")

class TrainRequest(BaseModel):
    """学習リクエスト"""
    model_type: str = Field(..., description="モデルタイプ")
    target: str = Field(..., description="ターゲット変数")
    retrain_all: bool = Field(False, description="全データで再学習するか")

class HealthResponse(BaseModel):
    """ヘルスチェックレスポンス"""
    status: str
    timestamp: datetime
    models: Dict
    data_status: Dict
```

---

## 5. FastAPI実装例

```python
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
import os

# APIのインスタンス化
app = FastAPI(
    title="Airregi AI Predict API",
    description="来店数・売上予測API",
    version="1.0.0"
)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# モデルのロード（起動時に1回だけ実行）
@app.on_event("startup")
async def load_models():
    """モデルをロード"""
    global visitor_model, sales_model
    visitor_model = load_model('data/models/visitor_count/lightgbm_v1.0.txt', 'lightgbm')
    sales_model = load_model('data/models/sales/lightgbm_v1.0.txt', 'lightgbm')

# ルートエンドポイント
@app.get("/")
async def root():
    return {
        "status": "ok",
        "message": "Airregi AI Predict API is running",
        "version": "1.0.0"
    }

# ヘルスチェック
@app.get("/health", response_model=HealthResponse)
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now(),
        "models": {
            "visitor_count": {
                "loaded": visitor_model is not None,
                "model_type": "lightgbm",
                "last_trained": "2025-10-12T10:30:00Z"
            },
            "sales_amount": {
                "loaded": sales_model is not None,
                "model_type": "lightgbm",
                "last_trained": "2025-10-12T10:30:00Z"
            }
        },
        "data_status": {
            "latest_date": "2025-10-12",
            "total_records": 6259
        }
    }

# 翌営業日の予測
@app.get("/predict/next-day", response_model=PredictionResponse)
async def predict_next_day():
    """翌営業日の来店数・売上を予測"""
    # 明日の日付を取得
    tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')

    # 天気予報を取得
    weather_data = fetch_tomorrow_forecast(
        api_key=os.getenv('WEATHER_API_KEY'),
        location='Tokyo'
    )

    # 特徴量を生成
    features = generate_features(tomorrow, weather_data)

    # 予測を実行
    visitor_pred = visitor_model.predict(features)
    sales_pred = sales_model.predict(features)

    return {
        "prediction_date": tomorrow,
        "predictions": {
            "visitor_count": {
                "value": int(visitor_pred[0]),
                "confidence_interval": {
                    "lower": int(visitor_pred[0] * 0.9),
                    "upper": int(visitor_pred[0] * 1.1)
                }
            },
            "sales_amount": {
                "value": int(sales_pred[0]),
                "confidence_interval": {
                    "lower": int(sales_pred[0] * 0.9),
                    "upper": int(sales_pred[0] * 1.1)
                }
            }
        },
        "weather_forecast": weather_data,
        "day_info": get_day_info(tomorrow),
        "model_info": {
            "visitor_model": "lightgbm_v1.0",
            "sales_model": "lightgbm_v1.0"
        },
        "generated_at": datetime.now()
    }

# 指定日の予測
@app.get("/predict/date/{date}", response_model=PredictionResponse)
async def predict_date(date: str):
    """指定日の予測"""
    # （実装は省略、next-dayと同様）
    pass

# カスタム予測
@app.post("/predict/custom", response_model=PredictionResponse)
async def predict_custom(request: CustomPredictionRequest):
    """カスタム特徴量での予測"""
    # （実装は省略）
    pass

# モデル評価指標
@app.get("/metrics")
async def get_metrics():
    """モデルの評価指標を取得"""
    # （実装は省略）
    pass

# API Key認証
def verify_api_key(x_api_key: str = Header(...)):
    """APIキーを検証"""
    valid_api_key = os.getenv('API_KEY')
    if x_api_key != valid_api_key:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    return x_api_key

# モデル再学習（認証必須）
@app.post("/train", dependencies=[Depends(verify_api_key)])
async def train_model(request: TrainRequest):
    """モデルを再学習"""
    # （実装は省略）
    pass
```

---

## 6. サーバー起動

```bash
# 開発環境
uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000

# 本番環境
uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## 7. ドキュメント

FastAPIは自動的にAPIドキュメントを生成します。

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

---

## 8. セキュリティ

### 8.1 API Key認証

管理者用エンドポイント（`/train`等）にはAPI Key認証を実装します。

### 8.2 レート制限

過剰なリクエストを防ぐためにレート制限を設定します。

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.get("/predict/next-day")
@limiter.limit("60/minute")
async def predict_next_day(request: Request):
    # ...
```

---

## 9. デプロイメント

### 9.1 Dockerコンテナ化

```dockerfile
FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 9.2 docker-compose

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - WEATHER_API_KEY=${WEATHER_API_KEY}
      - API_KEY=${API_KEY}
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
```

---

## 更新履歴

| 日付 | バージョン | 更新内容 | 作成者 |
|------|------------|----------|--------|
| 2025-10-13 | 1.0 | 初版作成 | Claude |
