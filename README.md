# Airレジ 来店数・売上予測システム

## 概要

本システムは、Airレジから出力されるジャーナル履歴データと天気予報情報を活用し、機械学習により店舗の営業日ごとの**来店数**と**売上**を高精度で予測するシステムです。

### 主要機能

- **データ収集・前処理**: POSデータと天気データの自動収集・変換
- **特徴量エンジニアリング**: 時系列特徴量、ラグ特徴量、ローリング統計の自動生成
- **機械学習予測**: LightGBM、Prophet、LSTMなど複数モデルによる予測
- **REST API**: 予測結果を提供するAPIサーバー
- **日次バッチ処理**: 自動データ更新・予測実行

### 予測精度目標

| 指標 | 来店数 | 売上 |
|-----|-------|------|
| MAPE | < 15% | < 20% |
| MAE | < 8人 | < 500円 |

---

## プロジェクト構造

```
airregi_ai_predict/
├── config/                 # 設定ファイル
│   ├── config.yaml
│   └── .env
├── data/                   # データディレクトリ
│   ├── raw/               # 生データ
│   ├── processed/         # 処理済みデータ
│   └── models/            # 保存済みモデル
├── docs/                   # ドキュメント
│   ├── 01_data_dictionary.md
│   ├── 02_system_architecture.md
│   ├── 03_data_pipeline.md
│   ├── 04_ml_models.md
│   ├── 05_weather_api_integration.md
│   ├── 06_prediction_api.md
│   └── 07_implementation_plan.md
├── input_data/            # 入力データ（ジャーナル履歴CSV）
├── notebooks/             # Jupyter Notebooks
│   ├── 01_eda.ipynb
│   ├── 02_feature_engineering.ipynb
│   └── 03_model_experiments.ipynb
├── src/                   # ソースコード
│   ├── data/             # データ処理
│   ├── features/         # 特徴量エンジニアリング
│   ├── external/         # 外部API連携
│   ├── models/           # 機械学習モデル
│   ├── training/         # モデル訓練
│   ├── api/              # REST API
│   └── utils/            # ユーティリティ
├── scripts/               # スクリプト
│   ├── train_model.py
│   ├── predict_daily.py
│   └── download_weather.py
├── tests/                 # テストコード
├── requirements.txt       # 依存パッケージ
└── README.md
```

---

## セットアップ

### 1. 前提条件

- Python 3.10以上
- Git

### 2. リポジトリのクローン

```bash
git clone https://github.com/your-org/airregi_ai_predict.git
cd airregi_ai_predict
```

### 3. 仮想環境の作成と有効化

```bash
# venvを使用
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# または conda を使用
conda create -n airregi python=3.10
conda activate airregi
```

### 4. 依存パッケージのインストール

```bash
pip install -r requirements.txt
```

### 5. 環境変数の設定

`.env` ファイルを作成し、APIキーを設定します。

```bash
# config/.env
WEATHER_API_KEY=your_weather_api_key_here
API_KEY=your_internal_api_key_here
```

### 6. ディレクトリの作成

```bash
mkdir -p data/raw/journal data/raw/weather data/processed data/models logs
```

---

## 使い方

### データの準備

1. **ジャーナル履歴CSVの配置**

Airレジからダウンロードしたジャーナル履歴CSVファイルを `input_data/` に配置します。

```
input_data/ジャーナル履歴_20250801-20251013.csv
```

2. **天気データのダウンロード**

過去の天気データを取得します。

```bash
python scripts/download_weather.py \
  --location "Tokyo" \
  --start-date "2025-08-01" \
  --end-date "2025-10-13" \
  --output data/raw/weather/weather_history.csv
```

### データ前処理パイプラインの実行

```bash
python scripts/run_pipeline.py \
  --journal-csv input_data/ジャーナル履歴_20250801-20251013.csv \
  --weather-csv data/raw/weather/weather_history.csv \
  --output-dir data/processed/features
```

### モデルの訓練

```bash
python scripts/train_model.py \
  --features data/processed/features/train.parquet \
  --target visitor_count \
  --model-type lightgbm \
  --output data/models/visitor_count/
```

### 予測の実行

```bash
python scripts/predict_daily.py \
  --date 2025-10-14 \
  --output predictions/2025-10-14.json
```

### APIサーバーの起動

```bash
uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload
```

APIドキュメント: http://localhost:8000/docs

---

## API使用例

### 翌営業日の予測

```bash
curl -X GET "http://localhost:8000/predict/next-day"
```

**レスポンス**:
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
    "temp_min": 16.3
  }
}
```

---

## 開発

### テストの実行

```bash
# 全テストを実行
pytest

# 特定のテストを実行
pytest tests/test_data/test_loader.py

# カバレッジ付きで実行
pytest --cov=src tests/
```

### コードフォーマット

```bash
# black でフォーマット
black src/ tests/

# flake8 で linting
flake8 src/ tests/
```

---

## ドキュメント

詳細な設計ドキュメントは [docs/](docs/) ディレクトリにあります。

- [データディクショナリ](docs/01_data_dictionary.md)
- [システムアーキテクチャ](docs/02_system_architecture.md)
- [データ前処理パイプライン](docs/03_data_pipeline.md)
- [機械学習モデル](docs/04_ml_models.md)
- [天気API統合](docs/05_weather_api_integration.md)
- [予測API仕様](docs/06_prediction_api.md)
- [実装計画](docs/07_implementation_plan.md)

---

## デプロイメント

### Dockerでの実行

```bash
# イメージのビルド
docker build -t airregi-predict .

# コンテナの起動
docker run -p 8000:8000 \
  -e WEATHER_API_KEY=your_key \
  -v $(pwd)/data:/app/data \
  airregi-predict
```

### docker-compose

```bash
docker-compose up -d
```

---

## トラブルシューティング

### 文字エンコーディングエラー

ジャーナル履歴CSVはCP932（Shift-JIS）エンコーディングです。読み込み時は必ず `encoding='cp932'` を指定してください。

### 天気APIのレート制限

WeatherAPI無料プランは1,000,000リクエスト/月です。キャッシング機能を活用してリクエスト数を削減してください。

### モデルのロードエラー

モデルファイルが存在しない場合、まずモデルを訓練してください。

```bash
python scripts/train_model.py
```

---

## ライセンス

MIT License

---

## 貢献

プルリクエストを歓迎します。大きな変更の場合は、まずissueを開いて変更内容を議論してください。

---

## 連絡先

質問や問題がある場合は、GitHubのissueを開いてください。

---

## 更新履歴

| 日付 | バージョン | 更新内容 |
|------|------------|----------|
| 2025-10-13 | 1.0.0 | 初版リリース |
