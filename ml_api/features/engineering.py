"""
Feature engineering for time series prediction
"""
import pandas as pd
import numpy as np
from typing import Optional, List
import jpholiday


async def create_features(
    df: pd.DataFrame,
    include_weather: bool = False,
    target_cols: List[str] = ["visitor_count", "sales_amount"],
) -> pd.DataFrame:
    """
    Create features for ML model from historical data

    Args:
        df: DataFrame with historical data (must have 'date' column)
        include_weather: Whether to include weather features (requires weather data)
        target_cols: List of target columns for lag features

    Returns:
        DataFrame with engineered features
    """
    df = df.copy()

    # Ensure date is datetime
    if not pd.api.types.is_datetime64_any_dtype(df["date"]):
        df["date"] = pd.to_datetime(df["date"])

    # Sort by date
    df = df.sort_values("date").reset_index(drop=True)

    print(f"Creating features for {len(df)} days of data")

    # === Time-based features ===
    df["year"] = df["date"].dt.year
    df["month"] = df["date"].dt.month
    df["day"] = df["date"].dt.day
    df["day_of_week"] = df["date"].dt.dayofweek  # Monday=0, Sunday=6
    df["day_of_year"] = df["date"].dt.dayofyear
    df["week_of_year"] = df["date"].dt.isocalendar().week
    df["quarter"] = df["date"].dt.quarter

    # === Day type features ===
    df["is_weekend"] = df["day_of_week"].isin([5, 6]).astype(int)
    df["is_monday"] = (df["day_of_week"] == 0).astype(int)
    df["is_friday"] = (df["day_of_week"] == 4).astype(int)
    df["is_sunday"] = (df["day_of_week"] == 6).astype(int)

    # === Month position features ===
    df["is_month_start"] = (df["day"] <= 5).astype(int)
    df["is_month_end"] = (df["day"] >= 25).astype(int)
    df["is_month_middle"] = ((df["day"] >= 10) & (df["day"] <= 20)).astype(int)

    # === Japanese holidays ===
    df["is_holiday"] = df["date"].apply(lambda x: jpholiday.is_holiday(x)).astype(int)
    df["is_day_before_holiday"] = df["is_holiday"].shift(-1).fillna(0).astype(int)
    df["is_day_after_holiday"] = df["is_holiday"].shift(1).fillna(0).astype(int)

    # === Rolling window features ===
    for col in target_cols:
        if col in df.columns:
            # Moving averages
            df[f"{col}_ma7"] = df[col].rolling(window=7, min_periods=1).mean()
            df[f"{col}_ma14"] = df[col].rolling(window=14, min_periods=1).mean()
            df[f"{col}_ma28"] = df[col].rolling(window=28, min_periods=1).mean()

            # Rolling statistics
            df[f"{col}_std7"] = df[col].rolling(window=7, min_periods=1).std()
            df[f"{col}_max7"] = df[col].rolling(window=7, min_periods=1).max()
            df[f"{col}_min7"] = df[col].rolling(window=7, min_periods=1).min()

            # Lag features
            df[f"{col}_lag1"] = df[col].shift(1)
            df[f"{col}_lag7"] = df[col].shift(7)
            df[f"{col}_lag14"] = df[col].shift(14)
            df[f"{col}_lag28"] = df[col].shift(28)

            # Difference features (trends)
            df[f"{col}_diff1"] = df[col].diff(1)
            df[f"{col}_diff7"] = df[col].diff(7)

            # Percentage change
            df[f"{col}_pct_change7"] = df[col].pct_change(7)
            df[f"{col}_pct_change14"] = df[col].pct_change(14)

            # Week-over-week growth rate
            df[f"{col}_wow_growth"] = (df[col] - df[f"{col}_lag7"]) / (
                df[f"{col}_lag7"] + 1e-5
            )

            # Trend features
            df[f"{col}_trend_7d"] = calculate_trend(df[col], window=7)
            df[f"{col}_trend_14d"] = calculate_trend(df[col], window=14)

    # === Interaction features ===
    if "visitor_count" in df.columns and "sales_amount" in df.columns:
        # Average spend per customer
        df["avg_spend_per_customer"] = df["sales_amount"] / (df["visitor_count"] + 1e-5)
        df["avg_spend_ma7"] = df["avg_spend_per_customer"].rolling(
            window=7, min_periods=1
        ).mean()

    # === Seasonal patterns ===
    # Same day of week averages (exclude current row to avoid leakage)
    for col in target_cols:
        if col in df.columns:
            df[f"{col}_dow_avg"] = df.groupby("day_of_week")[col].transform(
                lambda x: x.expanding().mean().shift(1)
            )

    # === Cyclical encoding for time features ===
    # Encode day of week as sine/cosine
    df["dow_sin"] = np.sin(2 * np.pi * df["day_of_week"] / 7)
    df["dow_cos"] = np.cos(2 * np.pi * df["day_of_week"] / 7)

    # Encode month as sine/cosine
    df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12)

    # === Weather features (placeholder) ===
    if include_weather:
        # These would be added from weather API data
        weather_cols = [
            "weather_code",
            "temp_avg",
            "temp_range",
            "precipitation",
            "is_rainy",
            "is_hot",
            "is_cold",
            "comfort_index",
        ]
        for col in weather_cols:
            if col not in df.columns:
                df[col] = 0  # Default value

    # === Clean up ===
    # Fill NaN values with forward fill then backward fill
    df = df.fillna(method="ffill").fillna(method="bfill")

    # For any remaining NaNs, fill with 0
    df = df.fillna(0)

    # Replace infinite values
    df = df.replace([np.inf, -np.inf], 0)

    print(f"Created {len(df.columns)} features")

    return df


def calculate_trend(series: pd.Series, window: int = 7) -> pd.Series:
    """
    Calculate trend using linear regression over a rolling window

    Args:
        series: Time series data
        window: Window size for trend calculation

    Returns:
        Series with trend values (slope of linear regression)
    """
    from scipy import stats

    def _trend(x):
        if len(x) < 2:
            return 0
        try:
            # Create time index
            t = np.arange(len(x))
            # Remove NaN values
            mask = ~np.isnan(x)
            if mask.sum() < 2:
                return 0
            # Calculate linear regression slope
            slope, _, _, _, _ = stats.linregress(t[mask], x[mask])
            return slope
        except:
            return 0

    return series.rolling(window=window, min_periods=2).apply(_trend, raw=True)


def create_prediction_features(
    last_historical_row: pd.Series,
    prediction_date: pd.Timestamp,
    weather_data: Optional[dict] = None,
) -> pd.DataFrame:
    """
    Create features for a single prediction date based on the last historical data

    Args:
        last_historical_row: Last row of historical data
        prediction_date: Date to predict for
        weather_data: Optional weather forecast data

    Returns:
        DataFrame with a single row of features for prediction
    """
    features = {}

    # Time features
    features["year"] = prediction_date.year
    features["month"] = prediction_date.month
    features["day"] = prediction_date.day
    features["day_of_week"] = prediction_date.dayofweek
    features["day_of_year"] = prediction_date.dayofyear
    features["week_of_year"] = prediction_date.isocalendar()[1]
    features["quarter"] = prediction_date.quarter

    # Day type features
    features["is_weekend"] = int(prediction_date.dayofweek >= 5)
    features["is_monday"] = int(prediction_date.dayofweek == 0)
    features["is_friday"] = int(prediction_date.dayofweek == 4)
    features["is_sunday"] = int(prediction_date.dayofweek == 6)

    # Month position
    features["is_month_start"] = int(prediction_date.day <= 5)
    features["is_month_end"] = int(prediction_date.day >= 25)
    features["is_month_middle"] = int(10 <= prediction_date.day <= 20)

    # Holiday
    features["is_holiday"] = int(jpholiday.is_holiday(prediction_date))

    # Cyclical encoding
    features["dow_sin"] = np.sin(2 * np.pi * prediction_date.dayofweek / 7)
    features["dow_cos"] = np.cos(2 * np.pi * prediction_date.dayofweek / 7)
    features["month_sin"] = np.sin(2 * np.pi * prediction_date.month / 12)
    features["month_cos"] = np.cos(2 * np.pi * prediction_date.month / 12)

    # Carry forward lag and rolling features from last historical data
    lag_features = [
        col
        for col in last_historical_row.index
        if any(
            pattern in col
            for pattern in ["_ma", "_lag", "_std", "_trend", "_dow_avg", "_pct_change"]
        )
    ]

    for col in lag_features:
        features[col] = last_historical_row[col] if pd.notna(last_historical_row[col]) else 0

    # Add weather features if provided
    if weather_data:
        from services.weather import get_weather_impact_features

        weather_features = get_weather_impact_features(weather_data)
        features.update(weather_features)

    return pd.DataFrame([features])