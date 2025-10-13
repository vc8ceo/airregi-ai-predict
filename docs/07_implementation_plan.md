# 実装計画書

## 1. 概要

本ドキュメントでは、Airレジ来店数・売上予測システムの実装計画を定義します。

## 2. 実装フェーズ

### Phase 1: 基盤構築（Week 1-2）

#### 目標
- プロジェクト環境のセットアップ
- データパイプラインの基本実装
- EDA（探索的データ分析）

#### タスク

| タスク | 工数 | 担当 | 優先度 |
|-------|------|------|--------|
| 開発環境セットアップ | 0.5日 | Dev | 高 |
| ディレクトリ構造の作成 | 0.5日 | Dev | 高 |
| 依存パッケージのインストール | 0.5日 | Dev | 高 |
| CSVデータ読み込みモジュール実装 | 1日 | Dev | 高 |
| データバリデーション実装 | 1日 | Dev | 中 |
| EDAノートブック作成 | 2日 | Data Scientist | 高 |
| 天気APIクライアント実装 | 1.5日 | Dev | 高 |
| 過去天気データダウンロード | 0.5日 | Dev | 高 |

**成果物**:
- `notebooks/01_eda.ipynb`: 探索的データ分析
- `src/data/loader.py`: データローダー
- `src/data/validator.py`: データバリデーター
- `src/external/weather_api.py`: 天気APIクライアント
- `data/raw/weather/`: 過去天気データ

---

### Phase 2: 特徴量エンジニアリング（Week 2-3）

#### 目標
- 予測に有効な特徴量の設計・実装
- 日次集計処理の実装

#### タスク

| タスク | 工数 | 担当 | 優先度 |
|-------|------|------|--------|
| 日次集計モジュール実装 | 1.5日 | Dev | 高 |
| 時系列特徴量生成 | 1日 | Dev | 高 |
| ラグ特徴量生成 | 1日 | Dev | 高 |
| ローリング統計特徴量生成 | 1日 | Dev | 高 |
| 天気データとの結合 | 1日 | Dev | 高 |
| 祝日情報の追加 | 0.5日 | Dev | 中 |
| 特徴量エンジニアリングノートブック | 2日 | Data Scientist | 高 |

**成果物**:
- `src/data/aggregator.py`: 日次集計
- `src/features/temporal.py`: 時系列特徴量
- `src/features/lag.py`: ラグ特徴量
- `src/features/rolling.py`: ローリング特徴量
- `notebooks/02_feature_engineering.ipynb`

---

### Phase 3: モデル開発（Week 3-5）

#### 目標
- 複数のモデルを実装・評価
- 最適なモデルの選定

#### タスク

| タスク | 工数 | 担当 | 優先度 |
|-------|------|------|--------|
| ベースラインモデル実装 | 1日 | Data Scientist | 高 |
| LightGBMモデル実装 | 2日 | Data Scientist | 高 |
| Prophetモデル実装 | 2日 | Data Scientist | 中 |
| LSTMモデル実装 | 3日 | Data Scientist | 低 |
| ハイパーパラメータチューニング（Optuna） | 2日 | Data Scientist | 高 |
| モデル評価・比較 | 2日 | Data Scientist | 高 |
| アンサンブルモデル実装 | 2日 | Data Scientist | 中 |
| モデル保存・ロード機能 | 1日 | Dev | 高 |
| モデル実験ノートブック | 3日 | Data Scientist | 高 |

**成果物**:
- `src/models/lightgbm_model.py`
- `src/models/prophet_model.py`
- `src/models/lstm_model.py`
- `src/models/ensemble.py`
- `src/training/trainer.py`
- `src/training/evaluator.py`
- `src/training/tuner.py`
- `notebooks/03_model_experiments.ipynb`
- `data/models/`: 訓練済みモデル

---

### Phase 4: API開発（Week 5-6）

#### 目標
- REST APIの実装
- エンドポイントのテスト

#### タスク

| タスク | 工数 | 担当 | 優先度 |
|-------|------|------|--------|
| FastAPIアプリケーション構築 | 1日 | Dev | 高 |
| 予測エンドポイント実装 | 2日 | Dev | 高 |
| ヘルスチェックエンドポイント | 0.5日 | Dev | 高 |
| モデル評価エンドポイント | 1日 | Dev | 中 |
| 再学習エンドポイント実装 | 1.5日 | Dev | 中 |
| API認証・セキュリティ実装 | 1日 | Dev | 中 |
| APIドキュメント作成 | 0.5日 | Dev | 中 |
| APIテスト | 2日 | Dev | 高 |

**成果物**:
- `src/api/main.py`
- `src/api/routes.py`
- `src/api/schemas.py`
- `src/api/predictor.py`
- `tests/test_api/`

---

### Phase 5: バッチ処理・自動化（Week 6-7）

#### 目標
- 日次バッチ処理の実装
- 自動化スクリプトの作成

#### タスク

| タスク | 工数 | 担当 | 優先度 |
|-------|------|------|--------|
| 日次予測スクリプト作成 | 1.5日 | Dev | 高 |
| モデル再学習スクリプト作成 | 1.5日 | Dev | 高 |
| 天気データ自動取得スクリプト | 1日 | Dev | 高 |
| スケジューラー設定（cron/Task Scheduler） | 1日 | Dev | 高 |
| ログ設定 | 1日 | Dev | 中 |
| エラーハンドリング強化 | 1.5日 | Dev | 高 |
| モデルドリフト検出機能 | 1.5日 | Dev | 中 |

**成果物**:
- `scripts/predict_daily.py`
- `scripts/train_model.py`
- `scripts/download_weather.py`
- `src/utils/logger.py`
- `config/scheduler.yaml`

---

### Phase 6: テスト・検証（Week 7-8）

#### 目標
- ユニットテスト・統合テストの実装
- システム全体の検証

#### タスク

| タスク | 工数 | 担当 | 優先度 |
|-------|------|------|--------|
| ユニットテスト作成（データ処理） | 2日 | Dev | 高 |
| ユニットテスト作成（特徴量） | 1.5日 | Dev | 高 |
| ユニットテスト作成（モデル） | 2日 | Dev | 高 |
| ユニットテスト作成（API） | 2日 | Dev | 高 |
| 統合テスト作成 | 2日 | Dev | 高 |
| 本番データでの検証 | 2日 | Data Scientist | 高 |
| 予測精度のモニタリング | 1日 | Data Scientist | 中 |

**成果物**:
- `tests/test_data/`
- `tests/test_features/`
- `tests/test_models/`
- `tests/test_api/`

---

### Phase 7: ドキュメント・デプロイ（Week 8-9）

#### 目標
- ドキュメントの整備
- デプロイメント準備

#### タスク

| タスク | 工数 | 担当 | 優先度 |
|-------|------|------|--------|
| READMEの作成 | 1日 | Dev | 高 |
| 運用マニュアル作成 | 2日 | Dev | 高 |
| APIドキュメント整備 | 1日 | Dev | 中 |
| Dockerコンテナ化 | 1.5日 | Dev | 中 |
| docker-compose設定 | 0.5日 | Dev | 中 |
| CI/CDパイプライン構築（オプション） | 2日 | DevOps | 低 |
| 本番環境へのデプロイ | 1日 | DevOps | 高 |

**成果物**:
- `README.md`
- `docs/user_manual.md`
- `Dockerfile`
- `docker-compose.yml`
- `.github/workflows/` (CI/CD)

---

## 3. タイムライン

```
Week 1-2:  [========] Phase 1: 基盤構築
Week 2-3:    [========] Phase 2: 特徴量エンジニアリング
Week 3-5:      [================] Phase 3: モデル開発
Week 5-6:                [========] Phase 4: API開発
Week 6-7:                  [========] Phase 5: バッチ処理・自動化
Week 7-8:                    [========] Phase 6: テスト・検証
Week 8-9:                      [========] Phase 7: ドキュメント・デプロイ
```

**総工数**: 約8-9週間（1-2名のチームを想定）

---

## 4. マイルストーン

| マイルストーン | 期限 | 成果物 |
|--------------|------|--------|
| M1: データパイプライン完成 | Week 2終了 | CSV読み込み、日次集計、天気データ統合 |
| M2: 特徴量エンジニアリング完成 | Week 3終了 | 全特徴量の生成が可能 |
| M3: ベースラインモデル完成 | Week 4終了 | LightGBMモデルで初期評価 |
| M4: モデル最適化完成 | Week 5終了 | ハイパーパラメータチューニング完了 |
| M5: API完成 | Week 6終了 | 予測APIが動作 |
| M6: バッチ処理完成 | Week 7終了 | 日次自動予測が可能 |
| M7: テスト完了 | Week 8終了 | 全テストがパス |
| M8: 本番リリース | Week 9終了 | システムが本番稼働 |

---

## 5. リスクと対策

| リスク | 影響度 | 発生確率 | 対策 |
|-------|--------|---------|------|
| データ品質が低い | 高 | 中 | データバリデーションを厳格に実施 |
| 天気APIの利用制限 | 中 | 低 | キャッシング機能を実装 |
| モデル精度が目標に届かない | 高 | 中 | 複数モデルを試行、アンサンブル |
| API応答速度が遅い | 中 | 低 | モデルの軽量化、キャッシング |
| 本番データが不足 | 高 | 中 | 過去データの定期的なバックアップ |
| モデルのドリフト | 中 | 中 | 定期的な再学習とモニタリング |

---

## 6. 必要リソース

### 6.1 人的リソース

- **開発者（Dev）**: 1名
  - データパイプライン開発
  - API開発
  - バッチ処理開発
  - テスト実装

- **データサイエンティスト（Data Scientist）**: 1名
  - EDA
  - 特徴量エンジニアリング
  - モデル開発・評価
  - ハイパーパラメータチューニング

### 6.2 技術リソース

- **開発環境**:
  - Python 3.10+
  - Jupyter Notebook
  - Git/GitHub

- **ライブラリ**:
  - pandas, numpy
  - scikit-learn, LightGBM, Prophet
  - FastAPI, uvicorn
  - pytest

- **外部サービス**:
  - WeatherAPI（無料プラン）

- **インフラ（オプション）**:
  - クラウドサーバー（AWS/GCP/Azure）
  - Docker

---

## 7. 開発環境セットアップ手順

### 7.1 必要なソフトウェア

- Python 3.10以上
- Git
- VSCode（推奨）

### 7.2 プロジェクトのクローン

```bash
git clone https://github.com/your-org/airregi_ai_predict.git
cd airregi_ai_predict
```

### 7.3 仮想環境の作成

```bash
# venvを使用
python -m venv venv
source venv/bin/activate  # Windowsの場合: venv\Scripts\activate

# または conda を使用
conda create -n airregi python=3.10
conda activate airregi
```

### 7.4 依存パッケージのインストール

```bash
pip install -r requirements.txt
```

### 7.5 環境変数の設定

```bash
# .envファイルを作成
cp config/.env.example config/.env

# APIキーを設定
nano config/.env
```

```
WEATHER_API_KEY=your_weather_api_key_here
API_KEY=your_internal_api_key_here
```

### 7.6 ディレクトリの作成

```bash
mkdir -p data/raw/journal data/raw/weather data/processed data/models logs
```

---

## 8. 次のステップ

Phase 1からタスクを開始してください。

1. **まず**: 開発環境をセットアップ
2. **次に**: CSVデータの読み込みとEDAを実施
3. **その後**: 特徴量エンジニアリング → モデル開発 → API開発の順に進める

---

## 更新履歴

| 日付 | バージョン | 更新内容 | 作成者 |
|------|------------|----------|--------|
| 2025-10-13 | 1.0 | 初版作成 | Claude |
