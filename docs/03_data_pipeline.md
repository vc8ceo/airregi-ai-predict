# データ前処理パイプライン設計書

## 1. 概要

本ドキュメントでは、Airレジジャーナル履歴データから機械学習モデルの学習・予測に必要な特徴量を生成するデータパイプラインの設計を定義します。

## 2. パイプライン全体図

```
┌─────────────────┐
│ Raw Journal CSV │ (CP932エンコード、明細レベル)
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Step 1: CSVインポート              │
│ - エンコーディング変換 (CP932→UTF-8) │
│ - カラム名の正規化                  │
│ - データ型の変換                    │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Step 2: データ検証                 │
│ - 必須カラムの存在確認              │
│ - 日付フォーマットの検証            │
│ - 数値データの範囲チェック          │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Step 3: 日次集計                  │
│ - 伝票No単位でグループ化           │
│ - 来店数（伝票数）の算出            │
│ - 売上金額（税込）の算出            │
│ - 客単価の算出                     │
│ - 営業時間の集計                   │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Step 4: 外部データ統合             │
│ - 天気データの取得・結合            │
│ - 祝日情報の追加                   │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Step 5: 特徴量エンジニアリング      │
│ - 時系列特徴量の生成                │
│ - ラグ特徴量の生成                  │
│ - ローリング統計の計算              │
│ - カテゴリ特徴量のエンコーディング   │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Step 6: データ分割                 │
│ - 学習データ / 検証データ / テストデータ │
│ - 時系列を考慮した分割               │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Output: 特徴量データセット          │
│ - Parquet形式で保存                 │
│ - モデル学習に使用可能              │
└─────────────────────────────────┘
```

## 3. 各ステップの詳細

### Step 1: CSVインポート

#### 目的
生データ（CP932エンコード）を読み込み、Pythonで扱いやすい形式に変換します。

#### 処理内容

```python
# 疑似コード
def import_journal_csv(file_path: str) -> pd.DataFrame:
    """
    ジャーナル履歴CSVをインポート

    Parameters:
    -----------
    file_path : str
        CSVファイルのパス

    Returns:
    --------
    pd.DataFrame
        インポートされたデータフレーム
    """
    # CP932エンコーディングで読み込み
    df = pd.read_csv(file_path, encoding='cp932')

    # カラム名を英語に変換（日本語カラム名を扱いやすくする）
    column_mapping = {
        '伝票No': 'receipt_no',
        '売上日': 'sales_date',
        '売上日時': 'sales_time',
        '店舗番号': 'store_id',
        '店舗名': 'store_name',
        '商品名': 'product_name',
        '販売単価': 'unit_price',
        '販売数量': 'quantity',
        '小計': 'subtotal',
        '消費税額': 'tax_amount',
        '現金': 'cash_payment',
        # ... その他のカラム
    }
    df = df.rename(columns=column_mapping)

    # データ型の変換
    df['sales_date'] = pd.to_datetime(df['sales_date'], format='%Y/%m/%d')
    df['sales_time'] = pd.to_datetime(df['sales_time'], format='%H:%M:%S').dt.time
    df['unit_price'] = pd.to_numeric(df['unit_price'], errors='coerce')
    df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce')
    df['subtotal'] = pd.to_numeric(df['subtotal'], errors='coerce')
    df['tax_amount'] = pd.to_numeric(df['tax_amount'], errors='coerce')

    return df
```

#### 出力
- データフレーム（明細レベル）
- カラム名が英語化され、データ型が適切に設定された状態

---

### Step 2: データ検証

#### 目的
データの整合性を確認し、異常値や欠損値を検出します。

#### 検証項目

1. **必須カラムの存在確認**
   - `receipt_no`, `sales_date`, `subtotal`, `tax_amount` 等

2. **日付の妥当性**
   - 未来の日付が含まれていないか
   - 日付の範囲が妥当か

3. **数値データの範囲**
   - 負の金額がないか（返品を除く）
   - 異常に高額な取引がないか

4. **欠損値の確認**
   - 重要カラムに欠損がないか
   - 欠損率の計算

```python
def validate_data(df: pd.DataFrame) -> Dict[str, Any]:
    """
    データの検証を実行

    Returns:
    --------
    Dict[str, Any]
        検証結果のレポート
    """
    report = {}

    # 必須カラムの確認
    required_columns = ['receipt_no', 'sales_date', 'subtotal', 'tax_amount']
    missing_columns = [col for col in required_columns if col not in df.columns]
    report['missing_columns'] = missing_columns

    # 日付の妥当性
    today = pd.Timestamp.now().date()
    future_dates = df[df['sales_date'] > today]
    report['future_dates_count'] = len(future_dates)

    # 負の金額
    negative_amounts = df[df['subtotal'] < 0]
    report['negative_amounts_count'] = len(negative_amounts)

    # 欠損値
    report['missing_values'] = df.isnull().sum().to_dict()

    # 異常値（外れ値）検出
    Q1 = df['subtotal'].quantile(0.25)
    Q3 = df['subtotal'].quantile(0.75)
    IQR = Q3 - Q1
    outliers = df[(df['subtotal'] < Q1 - 1.5 * IQR) | (df['subtotal'] > Q3 + 1.5 * IQR)]
    report['outliers_count'] = len(outliers)

    return report
```

#### 出力
- 検証レポート（JSON/Dict形式）
- エラーがある場合は警告またはエラーを発生

---

### Step 3: 日次集計

#### 目的
明細レベルのデータを日次レベルに集約し、予測対象の目的変数を生成します。

#### 集計内容

```python
def aggregate_daily(df: pd.DataFrame) -> pd.DataFrame:
    """
    日次レベルでデータを集計

    Returns:
    --------
    pd.DataFrame
        日次集計データ
        - date: 日付
        - visitor_count: 来店数（伝票数）
        - sales_amount: 売上金額（税込）
        - avg_price_per_customer: 客単価
        - total_items: 販売商品数
        - business_hours: 営業時間（最初の取引〜最後の取引）
        - peak_hour: ピーク時間帯
    """
    # 伝票レベルに集約
    receipts = df.groupby(['sales_date', 'receipt_no']).agg({
        'subtotal': 'sum',
        'tax_amount': 'sum',
        'quantity': 'sum',
        'sales_time': ['min', 'max']
    }).reset_index()

    # 伝票合計金額（税込）を計算
    receipts['total_amount'] = receipts['subtotal'] + receipts['tax_amount']

    # 日次集計
    daily = receipts.groupby('sales_date').agg({
        'receipt_no': 'count',  # 来店数
        'total_amount': 'sum',  # 売上金額
        'quantity': 'sum',      # 販売商品数
    }).reset_index()

    daily.columns = ['date', 'visitor_count', 'sales_amount', 'total_items']

    # 客単価
    daily['avg_price_per_customer'] = daily['sales_amount'] / daily['visitor_count']

    # 時間帯分析
    df['hour'] = pd.to_datetime(df['sales_time'], format='%H:%M:%S').dt.hour
    hourly_counts = df.groupby(['sales_date', 'hour']).size().reset_index(name='count')
    peak_hours = hourly_counts.loc[hourly_counts.groupby('sales_date')['count'].idxmax()]
    daily = daily.merge(peak_hours[['sales_date', 'hour']],
                       left_on='date', right_on='sales_date', how='left')
    daily = daily.rename(columns={'hour': 'peak_hour'})
    daily = daily.drop('sales_date', axis=1)

    return daily
```

#### 出力例

| date       | visitor_count | sales_amount | avg_price_per_customer | total_items | peak_hour |
|------------|---------------|--------------|------------------------|-------------|-----------|
| 2025-08-02 | 56            | 2,611        | 46.6                   | 312         | 9         |
| 2025-08-03 | 62            | 2,890        | 46.6                   | 345         | 10        |
| 2025-08-04 | 48            | 2,234        | 46.5                   | 267         | 11        |

---

### Step 4: 外部データ統合

#### 4.1 天気データの取得

```python
def fetch_weather_data(
    location: str,
    start_date: str,
    end_date: str,
    api_key: str
) -> pd.DataFrame:
    """
    天気データを取得

    Parameters:
    -----------
    location : str
        場所（緯度経度または都市名）
    start_date : str
        開始日
    end_date : str
        終了日
    api_key : str
        天気APIのAPIキー

    Returns:
    --------
    pd.DataFrame
        天気データ
        - date: 日付
        - weather_condition: 天候（晴れ/曇り/雨/雪）
        - temp_max: 最高気温
        - temp_min: 最低気温
        - temp_avg: 平均気温
        - humidity: 湿度
        - precipitation: 降水量
        - wind_speed: 風速
    """
    # OpenWeatherMap API または WeatherAPI を使用
    # 実装例は後述
    pass
```

#### 4.2 祝日情報の追加

```python
import jpholiday

def add_holiday_flag(df: pd.DataFrame) -> pd.DataFrame:
    """
    祝日フラグを追加

    Parameters:
    -----------
    df : pd.DataFrame
        日次データ

    Returns:
    --------
    pd.DataFrame
        祝日フラグが追加されたデータ
    """
    df['is_holiday'] = df['date'].apply(lambda x: jpholiday.is_holiday(x))
    df['holiday_name'] = df['date'].apply(lambda x: jpholiday.is_holiday_name(x))

    return df
```

#### 4.3 データ結合

```python
def merge_external_data(
    daily_df: pd.DataFrame,
    weather_df: pd.DataFrame
) -> pd.DataFrame:
    """
    日次データと外部データを結合
    """
    # 天気データを結合
    merged = daily_df.merge(weather_df, on='date', how='left')

    # 祝日フラグを追加
    merged = add_holiday_flag(merged)

    return merged
```

---

### Step 5: 特徴量エンジニアリング

#### 5.1 時系列特徴量

```python
def create_temporal_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    時系列に関する特徴量を生成
    """
    df = df.copy()

    # 日付から各種特徴量を抽出
    df['year'] = df['date'].dt.year
    df['month'] = df['date'].dt.month
    df['day'] = df['date'].dt.day
    df['day_of_week'] = df['date'].dt.dayofweek  # 0=月曜, 6=日曜
    df['week_of_year'] = df['date'].dt.isocalendar().week
    df['day_of_year'] = df['date'].dt.dayofyear

    # 曜日名
    df['weekday_name'] = df['date'].dt.day_name()

    # 週末フラグ
    df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)

    # 月初・月末フラグ
    df['is_month_start'] = df['date'].dt.is_month_start.astype(int)
    df['is_month_end'] = df['date'].dt.is_month_end.astype(int)

    # 季節（1=春, 2=夏, 3=秋, 4=冬）
    df['season'] = df['month'].apply(lambda m: (m % 12 + 3) // 3)

    # 周期性をエンコード（サイン・コサイン変換）
    df['day_of_week_sin'] = np.sin(2 * np.pi * df['day_of_week'] / 7)
    df['day_of_week_cos'] = np.cos(2 * np.pi * df['day_of_week'] / 7)
    df['month_sin'] = np.sin(2 * np.pi * df['month'] / 12)
    df['month_cos'] = np.cos(2 * np.pi * df['month'] / 12)

    return df
```

#### 5.2 ラグ特徴量

```python
def create_lag_features(
    df: pd.DataFrame,
    target_cols: List[str],
    lags: List[int]
) -> pd.DataFrame:
    """
    ラグ特徴量を生成

    Parameters:
    -----------
    df : pd.DataFrame
        日次データ
    target_cols : List[str]
        ラグを作成する対象カラム
    lags : List[int]
        ラグ日数のリスト（例: [1, 7, 14, 30]）

    Returns:
    --------
    pd.DataFrame
        ラグ特徴量が追加されたデータ
    """
    df = df.copy()
    df = df.sort_values('date').reset_index(drop=True)

    for col in target_cols:
        for lag in lags:
            df[f'{col}_lag_{lag}'] = df[col].shift(lag)

    return df
```

例:
- `visitor_count_lag_1`: 前日の来店数
- `visitor_count_lag_7`: 1週間前の来店数
- `sales_amount_lag_1`: 前日の売上
- `sales_amount_lag_7`: 1週間前の売上

#### 5.3 ローリング統計特徴量

```python
def create_rolling_features(
    df: pd.DataFrame,
    target_cols: List[str],
    windows: List[int]
) -> pd.DataFrame:
    """
    ローリング統計特徴量を生成

    Parameters:
    -----------
    df : pd.DataFrame
        日次データ
    target_cols : List[str]
        対象カラム
    windows : List[int]
        ウィンドウサイズのリスト（例: [7, 14, 30]）

    Returns:
    --------
    pd.DataFrame
        ローリング統計が追加されたデータ
    """
    df = df.copy()
    df = df.sort_values('date').reset_index(drop=True)

    for col in target_cols:
        for window in windows:
            # 移動平均
            df[f'{col}_rolling_mean_{window}'] = df[col].rolling(window=window).mean()

            # 移動標準偏差
            df[f'{col}_rolling_std_{window}'] = df[col].rolling(window=window).std()

            # 移動最大値
            df[f'{col}_rolling_max_{window}'] = df[col].rolling(window=window).max()

            # 移動最小値
            df[f'{col}_rolling_min_{window}'] = df[col].rolling(window=window).min()

    return df
```

例:
- `visitor_count_rolling_mean_7`: 過去7日間の平均来店数
- `sales_amount_rolling_std_30`: 過去30日間の売上の標準偏差

#### 5.4 差分特徴量

```python
def create_diff_features(
    df: pd.DataFrame,
    target_cols: List[str]
) -> pd.DataFrame:
    """
    差分特徴量を生成
    """
    df = df.copy()
    df = df.sort_values('date').reset_index(drop=True)

    for col in target_cols:
        # 前日との差分
        df[f'{col}_diff_1'] = df[col].diff(1)

        # 1週間前との差分
        df[f'{col}_diff_7'] = df[col].diff(7)

    return df
```

---

### Step 6: データ分割

#### 目的
学習データ、検証データ、テストデータに分割します。時系列データのため、時間順序を保持した分割が必要です。

```python
def split_data(
    df: pd.DataFrame,
    train_ratio: float = 0.7,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    時系列を考慮してデータを分割

    Parameters:
    -----------
    df : pd.DataFrame
        特徴量データ
    train_ratio : float
        学習データの割合
    val_ratio : float
        検証データの割合
    test_ratio : float
        テストデータの割合

    Returns:
    --------
    Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]
        学習データ、検証データ、テストデータ
    """
    df = df.sort_values('date').reset_index(drop=True)

    n = len(df)
    train_end = int(n * train_ratio)
    val_end = int(n * (train_ratio + val_ratio))

    train_df = df.iloc[:train_end]
    val_df = df.iloc[train_end:val_end]
    test_df = df.iloc[val_end:]

    return train_df, val_df, test_df
```

#### データ分割例

- **学習データ**: 最も古い70%（モデルの訓練に使用）
- **検証データ**: 次の15%（ハイパーパラメータチューニングに使用）
- **テストデータ**: 最新の15%（最終評価に使用）

---

## 4. パイプライン実行例

```python
def run_data_pipeline(
    journal_csv_path: str,
    weather_api_key: str,
    output_dir: str
) -> Dict[str, pd.DataFrame]:
    """
    データパイプライン全体を実行

    Parameters:
    -----------
    journal_csv_path : str
        ジャーナル履歴CSVのパス
    weather_api_key : str
        天気APIのキー
    output_dir : str
        出力ディレクトリ

    Returns:
    --------
    Dict[str, pd.DataFrame]
        学習データ、検証データ、テストデータ
    """
    # Step 1: CSVインポート
    print("Step 1: Importing CSV...")
    df_raw = import_journal_csv(journal_csv_path)

    # Step 2: データ検証
    print("Step 2: Validating data...")
    validation_report = validate_data(df_raw)
    print(f"Validation report: {validation_report}")

    # Step 3: 日次集計
    print("Step 3: Aggregating daily...")
    df_daily = aggregate_daily(df_raw)

    # Step 4: 外部データ統合
    print("Step 4: Fetching and merging external data...")
    weather_df = fetch_weather_data(
        location="Tokyo",  # 店舗の場所
        start_date=df_daily['date'].min().strftime('%Y-%m-%d'),
        end_date=df_daily['date'].max().strftime('%Y-%m-%d'),
        api_key=weather_api_key
    )
    df_merged = merge_external_data(df_daily, weather_df)

    # Step 5: 特徴量エンジニアリング
    print("Step 5: Creating features...")
    df_features = create_temporal_features(df_merged)
    df_features = create_lag_features(
        df_features,
        target_cols=['visitor_count', 'sales_amount'],
        lags=[1, 7, 14, 30]
    )
    df_features = create_rolling_features(
        df_features,
        target_cols=['visitor_count', 'sales_amount'],
        windows=[7, 14, 30]
    )
    df_features = create_diff_features(
        df_features,
        target_cols=['visitor_count', 'sales_amount']
    )

    # 欠損値を削除（ラグやローリング特徴量の初期期間）
    df_features = df_features.dropna()

    # Step 6: データ分割
    print("Step 6: Splitting data...")
    train_df, val_df, test_df = split_data(df_features)

    # Parquet形式で保存
    print("Saving data...")
    os.makedirs(output_dir, exist_ok=True)
    train_df.to_parquet(f'{output_dir}/train.parquet', index=False)
    val_df.to_parquet(f'{output_dir}/val.parquet', index=False)
    test_df.to_parquet(f'{output_dir}/test.parquet', index=False)

    print("Pipeline completed!")

    return {
        'train': train_df,
        'val': val_df,
        'test': test_df
    }
```

## 5. パイプラインの実行

```bash
python scripts/run_pipeline.py \
  --journal-csv input_data/ジャーナル履歴_20250801-20251013.csv \
  --weather-api-key YOUR_API_KEY \
  --output-dir data/processed/features
```

## 6. 出力データの形式

### 特徴量一覧

| カテゴリ | 特徴量名 | 説明 |
|---------|---------|------|
| **目的変数** | `visitor_count` | 来店数 |
|  | `sales_amount` | 売上金額 |
| **時系列** | `year`, `month`, `day` | 年月日 |
|  | `day_of_week` | 曜日（0-6） |
|  | `is_weekend` | 週末フラグ |
|  | `is_holiday` | 祝日フラグ |
|  | `season` | 季節（1-4） |
|  | `day_of_week_sin`, `day_of_week_cos` | 曜日の周期エンコーディング |
| **天気** | `weather_condition` | 天候 |
|  | `temp_max`, `temp_min`, `temp_avg` | 気温 |
|  | `humidity` | 湿度 |
|  | `precipitation` | 降水量 |
|  | `wind_speed` | 風速 |
| **ラグ** | `visitor_count_lag_1`, `visitor_count_lag_7` | 過去の来店数 |
|  | `sales_amount_lag_1`, `sales_amount_lag_7` | 過去の売上 |
| **ローリング** | `visitor_count_rolling_mean_7` | 7日移動平均来店数 |
|  | `sales_amount_rolling_std_30` | 30日売上の標準偏差 |
| **差分** | `visitor_count_diff_1`, `sales_amount_diff_7` | 差分特徴量 |

## 7. パフォーマンス最適化

- **並列処理**: 複数のCSVファイルを並列で処理
- **チャンク処理**: 大容量データはチャンクに分割して処理
- **キャッシング**: 中間結果をキャッシュして再計算を削減

## 8. エラーハンドリング

- データ検証に失敗した場合は詳細なエラーメッセージを出力
- 外部API呼び出しに失敗した場合はリトライ機能を実装
- パイプラインの各ステップでログを出力

## 更新履歴

| 日付 | バージョン | 更新内容 | 作成者 |
|------|------------|----------|--------|
| 2025-10-13 | 1.0 | 初版作成 | Claude |
