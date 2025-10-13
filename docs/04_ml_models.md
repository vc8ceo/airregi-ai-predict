# 機械学習モデル設計書

## 1. 概要

本ドキュメントでは、店舗の来店数と売上を予測するための機械学習モデルの設計を定義します。

## 2. 予測タスクの定義

### 2.1 予測目的

| 項目 | 内容 |
|-----|------|
| **予測対象** | 翌営業日の来店数と売上金額 |
| **予測単位** | 日次 |
| **予測期間** | 1日先（翌営業日） |
| **更新頻度** | 毎日（日次バッチ処理） |

### 2.2 予測タスク

#### タスク1: 来店数予測
- **目的変数**: `visitor_count`（1日あたりの伝票数）
- **タスク種別**: 回帰（Regression）
- **評価指標**: MAE, RMSE, MAPE

#### タスク2: 売上予測
- **目的変数**: `sales_amount`（1日あたりの税込売上金額）
- **タスク種別**: 回帰（Regression）
- **評価指標**: MAE, RMSE, MAPE

## 3. モデル選定

時系列予測において高い精度を発揮する複数のアルゴリズムを比較検証し、最適なモデルを選定します。

### 3.1 候補モデル

#### 3.1.1 LightGBM (勾配ブースティング)

**特徴:**
- 高速・高精度な勾配ブースティングアルゴリズム
- カテゴリ特徴量を直接扱える
- 特徴量の重要度が可視化可能
- ハイパーパラメータのチューニングが容易

**メリット:**
- 表形式データに強い
- 学習速度が速い
- 欠損値を自動処理

**デメリット:**
- 時系列の長期依存関係の捕捉が弱い
- 外挿（訓練データの範囲外の予測）に弱い

**適用シナリオ:**
- 特徴量エンジニアリングを十分に行った場合
- ラグ特徴量やローリング統計が効果的な場合

#### 3.1.2 Prophet (時系列予測専用)

**特徴:**
- Facebook開発の時系列予測ライブラリ
- トレンド、季節性、祝日効果を自動的にモデル化
- 使いやすいインターフェース

**メリット:**
- 外れ値に頑健
- 欠損値を自動処理
- 祝日や特殊イベントの効果を明示的にモデル化可能
- 解釈性が高い

**デメリット:**
- 追加の外部特徴量（天気等）の組み込みが難しい
- 学習に時間がかかる場合がある

**適用シナリオ:**
- 明確な季節性やトレンドがある場合
- 祝日効果が大きい場合

#### 3.1.3 LSTM (ディープラーニング)

**特徴:**
- リカレントニューラルネットワーク（RNN）の一種
- 時系列の長期依存関係を学習可能
- 複雑な非線形パターンを捕捉

**メリット:**
- 時系列データの時間的依存性を直接モデル化
- 複数の変数を同時に予測可能（Multi-output）

**デメリット:**
- 学習に大量のデータが必要
- ハイパーパラメータのチューニングが複雑
- 学習時間が長い
- 解釈性が低い

**適用シナリオ:**
- 十分なデータ量がある場合（数百日以上）
- 複雑な時系列パターンが存在する場合

### 3.2 モデル選定方針

1. **Phase 1: ベースラインモデル**
   - 単純な移動平均やナイーブ予測でベースラインを確立

2. **Phase 2: 個別モデルの訓練**
   - LightGBM、Prophet、LSTMを個別に訓練・評価

3. **Phase 3: アンサンブルモデル**
   - 複数モデルの予測を統合（スタッキング、重み付き平均）

4. **Phase 4: 最終モデルの選定**
   - 検証データでの性能評価に基づき最終モデルを決定

## 4. モデル詳細設計

### 4.1 LightGBMモデル

#### 4.1.1 特徴量

```python
FEATURES = [
    # 時系列特徴
    'month', 'day_of_week', 'week_of_year', 'day_of_year',
    'is_weekend', 'is_holiday', 'season',
    'day_of_week_sin', 'day_of_week_cos',
    'month_sin', 'month_cos',

    # ラグ特徴量
    'visitor_count_lag_1', 'visitor_count_lag_7', 'visitor_count_lag_14',
    'sales_amount_lag_1', 'sales_amount_lag_7', 'sales_amount_lag_14',

    # ローリング統計
    'visitor_count_rolling_mean_7', 'visitor_count_rolling_std_7',
    'visitor_count_rolling_mean_30', 'visitor_count_rolling_std_30',
    'sales_amount_rolling_mean_7', 'sales_amount_rolling_std_7',
    'sales_amount_rolling_mean_30', 'sales_amount_rolling_std_30',

    # 差分特徴量
    'visitor_count_diff_1', 'visitor_count_diff_7',
    'sales_amount_diff_1', 'sales_amount_diff_7',

    # 天気特徴
    'temp_max', 'temp_min', 'temp_avg',
    'humidity', 'precipitation', 'wind_speed',
    'weather_condition',  # カテゴリカル
]

TARGET_VISITOR = 'visitor_count'
TARGET_SALES = 'sales_amount'
```

#### 4.1.2 ハイパーパラメータ（初期値）

```python
LGBM_PARAMS = {
    'objective': 'regression',
    'metric': 'mae',
    'boosting_type': 'gbdt',
    'num_leaves': 31,
    'learning_rate': 0.05,
    'feature_fraction': 0.8,
    'bagging_fraction': 0.8,
    'bagging_freq': 5,
    'max_depth': -1,
    'min_child_samples': 20,
    'reg_alpha': 0.1,
    'reg_lambda': 0.1,
    'random_state': 42,
    'n_estimators': 1000,
    'early_stopping_rounds': 50,
    'verbose': -1
}
```

#### 4.1.3 学習コード例

```python
import lightgbm as lgb
from sklearn.metrics import mean_absolute_error, mean_squared_error

def train_lightgbm_model(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_val: pd.DataFrame,
    y_val: pd.Series,
    params: Dict[str, Any]
) -> lgb.Booster:
    """
    LightGBMモデルを訓練

    Returns:
    --------
    lgb.Booster
        訓練済みモデル
    """
    train_data = lgb.Dataset(X_train, label=y_train)
    val_data = lgb.Dataset(X_val, label=y_val, reference=train_data)

    model = lgb.train(
        params,
        train_data,
        valid_sets=[train_data, val_data],
        valid_names=['train', 'val']
    )

    # 評価
    y_pred = model.predict(X_val)
    mae = mean_absolute_error(y_val, y_pred)
    rmse = np.sqrt(mean_squared_error(y_val, y_pred))
    mape = np.mean(np.abs((y_val - y_pred) / y_val)) * 100

    print(f"Validation MAE: {mae:.2f}")
    print(f"Validation RMSE: {rmse:.2f}")
    print(f"Validation MAPE: {mape:.2f}%")

    return model
```

---

### 4.2 Prophetモデル

#### 4.2.1 モデル設定

```python
from prophet import Prophet

def train_prophet_model(
    df: pd.DataFrame,
    target_col: str,
    holidays: pd.DataFrame = None
) -> Prophet:
    """
    Prophetモデルを訓練

    Parameters:
    -----------
    df : pd.DataFrame
        日次データ（'date'と目的変数を含む）
    target_col : str
        目的変数のカラム名
    holidays : pd.DataFrame
        祝日データフレーム

    Returns:
    --------
    Prophet
        訓練済みモデル
    """
    # Prophetの入力形式に変換
    prophet_df = df[['date', target_col]].rename(
        columns={'date': 'ds', target_col: 'y'}
    )

    # モデルのインスタンス化
    model = Prophet(
        daily_seasonality=False,
        weekly_seasonality=True,
        yearly_seasonality=True,
        holidays=holidays,
        seasonality_mode='multiplicative',  # or 'additive'
        changepoint_prior_scale=0.05,
        seasonality_prior_scale=10.0
    )

    # 天気データを追加リグレッサーとして追加
    model.add_regressor('temp_avg')
    model.add_regressor('precipitation')

    # 学習
    model.fit(prophet_df)

    return model
```

#### 4.2.2 予測コード例

```python
def predict_with_prophet(
    model: Prophet,
    future_df: pd.DataFrame
) -> pd.DataFrame:
    """
    Prophetで予測を実行
    """
    # Prophetの入力形式に変換
    prophet_future = future_df[['date', 'temp_avg', 'precipitation']].rename(
        columns={'date': 'ds'}
    )

    # 予測
    forecast = model.predict(prophet_future)

    return forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']]
```

---

### 4.3 LSTMモデル

#### 4.3.1 モデルアーキテクチャ

```python
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout

def create_lstm_model(
    input_shape: Tuple[int, int],
    output_dim: int = 1
) -> tf.keras.Model:
    """
    LSTMモデルを構築

    Parameters:
    -----------
    input_shape : Tuple[int, int]
        (sequence_length, num_features)
    output_dim : int
        出力次元（来店数と売上を同時予測する場合は2）

    Returns:
    --------
    tf.keras.Model
        LSTMモデル
    """
    model = Sequential([
        LSTM(64, activation='relu', return_sequences=True, input_shape=input_shape),
        Dropout(0.2),
        LSTM(32, activation='relu'),
        Dropout(0.2),
        Dense(16, activation='relu'),
        Dense(output_dim)
    ])

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss='mse',
        metrics=['mae']
    )

    return model
```

#### 4.3.2 データ準備

LSTMは系列データを入力とするため、時系列ウィンドウを作成する必要があります。

```python
def create_sequences(
    data: np.ndarray,
    target: np.ndarray,
    sequence_length: int = 14
) -> Tuple[np.ndarray, np.ndarray]:
    """
    時系列データをLSTM用の系列に変換

    Parameters:
    -----------
    data : np.ndarray
        特徴量データ
    target : np.ndarray
        目的変数
    sequence_length : int
        系列の長さ（過去何日分を見るか）

    Returns:
    --------
    Tuple[np.ndarray, np.ndarray]
        (X, y)
        X: shape (samples, sequence_length, num_features)
        y: shape (samples, output_dim)
    """
    X, y = [], []

    for i in range(len(data) - sequence_length):
        X.append(data[i:i+sequence_length])
        y.append(target[i+sequence_length])

    return np.array(X), np.array(y)
```

#### 4.3.3 学習コード例

```python
def train_lstm_model(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray,
    y_val: np.ndarray,
    epochs: int = 100,
    batch_size: int = 32
) -> tf.keras.Model:
    """
    LSTMモデルを訓練
    """
    input_shape = (X_train.shape[1], X_train.shape[2])
    model = create_lstm_model(input_shape)

    # Early Stopping
    early_stopping = tf.keras.callbacks.EarlyStopping(
        monitor='val_loss',
        patience=10,
        restore_best_weights=True
    )

    # 学習
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=epochs,
        batch_size=batch_size,
        callbacks=[early_stopping],
        verbose=1
    )

    return model, history
```

---

### 4.4 アンサンブルモデル

複数のモデルを組み合わせることで予測精度の向上を図ります。

#### 4.4.1 重み付き平均

```python
def ensemble_weighted_average(
    predictions: Dict[str, np.ndarray],
    weights: Dict[str, float]
) -> np.ndarray:
    """
    重み付き平均でアンサンブル

    Parameters:
    -----------
    predictions : Dict[str, np.ndarray]
        モデル名をキー、予測値を値とする辞書
    weights : Dict[str, float]
        モデル名をキー、重みを値とする辞書

    Returns:
    --------
    np.ndarray
        アンサンブル予測
    """
    ensemble_pred = np.zeros_like(predictions[list(predictions.keys())[0]])

    for model_name, pred in predictions.items():
        ensemble_pred += weights[model_name] * pred

    return ensemble_pred
```

例:
```python
predictions = {
    'lightgbm': lgbm_pred,
    'prophet': prophet_pred,
    'lstm': lstm_pred
}

weights = {
    'lightgbm': 0.5,
    'prophet': 0.3,
    'lstm': 0.2
}

final_pred = ensemble_weighted_average(predictions, weights)
```

#### 4.4.2 スタッキング

```python
from sklearn.linear_model import Ridge

def ensemble_stacking(
    train_predictions: Dict[str, np.ndarray],
    train_targets: np.ndarray,
    test_predictions: Dict[str, np.ndarray]
) -> np.ndarray:
    """
    スタッキングでアンサンブル

    Parameters:
    -----------
    train_predictions : Dict[str, np.ndarray]
        学習データに対する各モデルの予測
    train_targets : np.ndarray
        学習データの真値
    test_predictions : Dict[str, np.ndarray]
        テストデータに対する各モデルの予測

    Returns:
    --------
    np.ndarray
        アンサンブル予測
    """
    # メタモデルの学習データを作成
    X_meta_train = np.column_stack([pred for pred in train_predictions.values()])
    X_meta_test = np.column_stack([pred for pred in test_predictions.values()])

    # メタモデル（線形回帰）を訓練
    meta_model = Ridge(alpha=1.0)
    meta_model.fit(X_meta_train, train_targets)

    # 最終予測
    final_pred = meta_model.predict(X_meta_test)

    return final_pred
```

---

## 5. モデル評価

### 5.1 評価指標

#### 5.1.1 MAE (Mean Absolute Error)

$$MAE = \frac{1}{n} \sum_{i=1}^{n} |y_i - \hat{y}_i|$$

- **意味**: 予測値と真値の絶対誤差の平均
- **単位**: 目的変数と同じ単位（人、円）
- **利点**: 解釈しやすい

#### 5.1.2 RMSE (Root Mean Squared Error)

$$RMSE = \sqrt{\frac{1}{n} \sum_{i=1}^{n} (y_i - \hat{y}_i)^2}$$

- **意味**: 予測誤差の二乗平均の平方根
- **利点**: 大きな誤差にペナルティを与える

#### 5.1.3 MAPE (Mean Absolute Percentage Error)

$$MAPE = \frac{1}{n} \sum_{i=1}^{n} \left|\frac{y_i - \hat{y}_i}{y_i}\right| \times 100$$

- **意味**: 予測誤差の割合（パーセンテージ）
- **利点**: スケールに依存しない

#### 5.1.4 R² (決定係数)

$$R^2 = 1 - \frac{\sum_{i=1}^{n} (y_i - \hat{y}_i)^2}{\sum_{i=1}^{n} (y_i - \bar{y})^2}$$

- **意味**: モデルが説明できる分散の割合
- **範囲**: 0〜1（1に近いほど良い）

### 5.2 クロスバリデーション

時系列データのため、**時系列クロスバリデーション（TimeSeriesSplit）**を使用します。

```python
from sklearn.model_selection import TimeSeriesSplit

def time_series_cross_validation(
    X: pd.DataFrame,
    y: pd.Series,
    model,
    n_splits: int = 5
) -> List[Dict[str, float]]:
    """
    時系列クロスバリデーション

    Returns:
    --------
    List[Dict[str, float]]
        各フォールドの評価指標
    """
    tscv = TimeSeriesSplit(n_splits=n_splits)
    results = []

    for fold, (train_idx, val_idx) in enumerate(tscv.split(X)):
        X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
        y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]

        # モデル訓練
        model.fit(X_train, y_train)

        # 予測
        y_pred = model.predict(X_val)

        # 評価
        mae = mean_absolute_error(y_val, y_pred)
        rmse = np.sqrt(mean_squared_error(y_val, y_pred))
        mape = np.mean(np.abs((y_val - y_pred) / y_val)) * 100

        results.append({
            'fold': fold + 1,
            'mae': mae,
            'rmse': rmse,
            'mape': mape
        })

        print(f"Fold {fold+1}: MAE={mae:.2f}, RMSE={rmse:.2f}, MAPE={mape:.2f}%")

    return results
```

### 5.3 目標精度

| 指標 | 来店数予測 | 売上予測 |
|-----|-----------|---------|
| MAPE | < 15% | < 20% |
| MAE | < 8人 | < 500円 |

---

## 6. ハイパーパラメータチューニング

### 6.1 Optuna による自動チューニング

```python
import optuna

def objective(trial: optuna.Trial) -> float:
    """
    Optunaの目的関数
    """
    # ハイパーパラメータの探索空間
    params = {
        'objective': 'regression',
        'metric': 'mae',
        'boosting_type': 'gbdt',
        'num_leaves': trial.suggest_int('num_leaves', 20, 100),
        'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.3, log=True),
        'feature_fraction': trial.suggest_float('feature_fraction', 0.5, 1.0),
        'bagging_fraction': trial.suggest_float('bagging_fraction', 0.5, 1.0),
        'bagging_freq': trial.suggest_int('bagging_freq', 1, 10),
        'min_child_samples': trial.suggest_int('min_child_samples', 5, 50),
        'reg_alpha': trial.suggest_float('reg_alpha', 1e-3, 10.0, log=True),
        'reg_lambda': trial.suggest_float('reg_lambda', 1e-3, 10.0, log=True),
        'random_state': 42
    }

    # モデル訓練
    train_data = lgb.Dataset(X_train, label=y_train)
    val_data = lgb.Dataset(X_val, label=y_val, reference=train_data)

    model = lgb.train(
        params,
        train_data,
        valid_sets=[val_data],
        num_boost_round=1000,
        callbacks=[lgb.early_stopping(50), lgb.log_evaluation(False)]
    )

    # 評価
    y_pred = model.predict(X_val)
    mae = mean_absolute_error(y_val, y_pred)

    return mae

# 最適化実行
study = optuna.create_study(direction='minimize')
study.optimize(objective, n_trials=100)

print("Best parameters:", study.best_params)
print("Best MAE:", study.best_value)
```

---

## 7. モデルの保存とロード

```python
import joblib
import pickle

def save_model(model, filepath: str, model_type: str):
    """
    モデルを保存
    """
    if model_type == 'lightgbm':
        model.save_model(filepath)
    elif model_type == 'prophet':
        with open(filepath, 'wb') as f:
            pickle.dump(model, f)
    elif model_type == 'lstm':
        model.save(filepath)

def load_model(filepath: str, model_type: str):
    """
    モデルをロード
    """
    if model_type == 'lightgbm':
        return lgb.Booster(model_file=filepath)
    elif model_type == 'prophet':
        with open(filepath, 'rb') as f:
            return pickle.load(f)
    elif model_type == 'lstm':
        return tf.keras.models.load_model(filepath)
```

---

## 8. モデルの再学習戦略

### 8.1 学習スケジュール

- **週次**: 直近のデータを追加して増分学習
- **月次**: 全データで再学習
- **年次**: モデルアーキテクチャの見直しと再設計

### 8.2 モデルドリフト検出

```python
def detect_model_drift(
    recent_predictions: np.ndarray,
    recent_actuals: np.ndarray,
    baseline_mae: float,
    threshold: float = 0.2
) -> bool:
    """
    モデルドリフトを検出

    Parameters:
    -----------
    recent_predictions : np.ndarray
        直近の予測値
    recent_actuals : np.ndarray
        直近の実績値
    baseline_mae : float
        ベースラインのMAE
    threshold : float
        ドリフト判定の閾値（MAEの相対的な悪化率）

    Returns:
    --------
    bool
        ドリフトが検出された場合True
    """
    current_mae = mean_absolute_error(recent_actuals, recent_predictions)
    relative_change = (current_mae - baseline_mae) / baseline_mae

    if relative_change > threshold:
        print(f"Model drift detected! MAE increased by {relative_change*100:.1f}%")
        return True

    return False
```

---

## 9. 運用フロー

```
毎日 AM 6:00
  ↓
1. 最新の実績データを読み込み
  ↓
2. 特徴量を生成
  ↓
3. モデルをロード
  ↓
4. 翌営業日の予測を実行
  ↓
5. 予測結果を保存・API経由で提供
  ↓
6. (週次) モデルドリフトをチェック
  ↓
7. (ドリフト検出時) 再学習を実行
```

---

## 10. 今後の改善案

1. **外部データの追加**
   - 近隣イベント情報
   - SNSトレンドデータ
   - 競合店舗の動向

2. **マルチステップ予測**
   - 3日先、7日先の予測

3. **不確実性の定量化**
   - 予測区間（Prediction Interval）の提供

4. **オンライン学習**
   - リアルタイムでのモデル更新

5. **商品カテゴリ別予測**
   - カテゴリごとの需要予測

---

## 更新履歴

| 日付 | バージョン | 更新内容 | 作成者 |
|------|------------|----------|--------|
| 2025-10-13 | 1.0 | 初版作成 | Claude |
