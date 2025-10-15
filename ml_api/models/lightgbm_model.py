"""
LightGBM model for visitor count and sales prediction
"""
import pandas as pd
import numpy as np
import lightgbm as lgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error
from datetime import datetime, timedelta
from typing import Dict, Tuple, Optional
import warnings
warnings.filterwarnings('ignore')

from features.engineering import create_features
from services.weather import get_weather_impact_features


class LightGBMPredictor:
    """LightGBM model for time series prediction"""

    def __init__(self):
        self.visitor_model = None
        self.sales_model = None
        self.feature_columns = None
        self.model_metrics = {}

    def train(
        self,
        df: pd.DataFrame,
        target_visitor: str = "visitor_count",
        target_sales: str = "sales_amount",
    ) -> Dict:
        """
        Train LightGBM models for visitor count and sales prediction

        Args:
            df: DataFrame with features and targets
            target_visitor: Column name for visitor count target
            target_sales: Column name for sales amount target

        Returns:
            Dictionary with training metrics
        """
        # Prepare features
        feature_cols = [
            col
            for col in df.columns
            if col
            not in [
                target_visitor,
                target_sales,
                "date",
                "user_id",
                "id",
            ]
        ]
        self.feature_columns = feature_cols

        # Remove rows with NaN in critical columns
        df_clean = df.dropna(subset=feature_cols + [target_visitor, target_sales])

        if len(df_clean) < 30:
            raise ValueError(
                f"Insufficient clean data for training: {len(df_clean)} rows"
            )

        X = df_clean[feature_cols]
        y_visitor = df_clean[target_visitor]
        y_sales = df_clean[target_sales]

        # Split data (80/20 for train/validation)
        X_train, X_val, y_visitor_train, y_visitor_val = train_test_split(
            X, y_visitor, test_size=0.2, random_state=42, shuffle=False
        )
        _, _, y_sales_train, y_sales_val = train_test_split(
            X, y_sales, test_size=0.2, random_state=42, shuffle=False
        )

        print(f"Training on {len(X_train)} samples, validating on {len(X_val)} samples")

        # LightGBM parameters (tuned for small datasets)
        params_base = {
            "objective": "regression",
            "metric": "mae",
            "boosting_type": "gbdt",
            "num_leaves": 15,  # Small to prevent overfitting
            "learning_rate": 0.05,
            "feature_fraction": 0.8,
            "bagging_fraction": 0.8,
            "bagging_freq": 5,
            "min_data_in_leaf": 5,  # Minimum samples in leaf
            "min_gain_to_split": 0.01,
            "lambda_l1": 0.1,  # L1 regularization
            "lambda_l2": 0.1,  # L2 regularization
            "verbosity": -1,
            "random_state": 42,
        }

        # Train visitor count model
        print("Training visitor count model...")
        train_data_visitor = lgb.Dataset(X_train, label=y_visitor_train)
        val_data_visitor = lgb.Dataset(
            X_val, label=y_visitor_val, reference=train_data_visitor
        )

        self.visitor_model = lgb.train(
            params_base,
            train_data_visitor,
            num_boost_round=200,
            valid_sets=[val_data_visitor],
            callbacks=[lgb.early_stopping(stopping_rounds=20), lgb.log_evaluation(0)],
        )

        # Train sales model with adjusted parameters
        print("Training sales amount model...")
        params_sales = params_base.copy()
        params_sales["objective"] = "regression"
        params_sales["metric"] = "mape"  # Use MAPE for sales

        train_data_sales = lgb.Dataset(X_train, label=y_sales_train)
        val_data_sales = lgb.Dataset(
            X_val, label=y_sales_val, reference=train_data_sales
        )

        self.sales_model = lgb.train(
            params_sales,
            train_data_sales,
            num_boost_round=200,
            valid_sets=[val_data_sales],
            callbacks=[lgb.early_stopping(stopping_rounds=20), lgb.log_evaluation(0)],
        )

        # Calculate metrics
        visitor_pred_val = self.visitor_model.predict(
            X_val, num_iteration=self.visitor_model.best_iteration
        )
        sales_pred_val = self.sales_model.predict(
            X_val, num_iteration=self.sales_model.best_iteration
        )

        self.model_metrics = {
            "visitor_mae": mean_absolute_error(y_visitor_val, visitor_pred_val),
            "visitor_rmse": np.sqrt(
                mean_squared_error(y_visitor_val, visitor_pred_val)
            ),
            "visitor_mape": self._calculate_mape(y_visitor_val, visitor_pred_val),
            "sales_mae": mean_absolute_error(y_sales_val, sales_pred_val),
            "sales_rmse": np.sqrt(mean_squared_error(y_sales_val, sales_pred_val)),
            "sales_mape": self._calculate_mape(y_sales_val, sales_pred_val),
            "training_samples": len(X_train),
            "validation_samples": len(X_val),
        }

        print(f"Model metrics: {self.model_metrics}")
        return self.model_metrics

    def predict(
        self, X: pd.DataFrame, confidence_level: float = 0.9
    ) -> Tuple[Dict, Dict]:
        """
        Make predictions with confidence intervals

        Args:
            X: Features for prediction
            confidence_level: Confidence level for intervals (default 0.9)

        Returns:
            Tuple of (visitor predictions, sales predictions)
        """
        if self.visitor_model is None or self.sales_model is None:
            raise ValueError("Models not trained. Call train() first.")

        # Ensure feature columns match
        X_pred = X[self.feature_columns]

        # Make point predictions
        visitor_pred = self.visitor_model.predict(
            X_pred, num_iteration=self.visitor_model.best_iteration
        )[0]
        sales_pred = self.sales_model.predict(
            X_pred, num_iteration=self.sales_model.best_iteration
        )[0]

        # Calculate confidence intervals based on validation metrics
        # Using normal approximation with validation RMSE
        z_score = 1.645 if confidence_level == 0.9 else 1.96  # 90% or 95% CI

        visitor_std = self.model_metrics.get("visitor_rmse", visitor_pred * 0.15)
        sales_std = self.model_metrics.get("sales_rmse", sales_pred * 0.15)

        visitor_result = {
            "value": max(0, int(visitor_pred)),
            "confidence_lower": max(0, int(visitor_pred - z_score * visitor_std)),
            "confidence_upper": max(0, int(visitor_pred + z_score * visitor_std)),
            "std": visitor_std,
        }

        sales_result = {
            "value": max(0, float(sales_pred)),
            "confidence_lower": max(0, float(sales_pred - z_score * sales_std)),
            "confidence_upper": max(0, float(sales_pred + z_score * sales_std)),
            "std": sales_std,
        }

        return visitor_result, sales_result

    def _calculate_mape(self, y_true, y_pred) -> float:
        """Calculate Mean Absolute Percentage Error"""
        y_true, y_pred = np.array(y_true), np.array(y_pred)
        mask = y_true != 0
        return np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100

    def get_feature_importance(self) -> Dict:
        """Get feature importance from trained models"""
        if self.visitor_model is None:
            return {}

        visitor_importance = self.visitor_model.feature_importance(importance_type="gain")
        sales_importance = self.sales_model.feature_importance(importance_type="gain")

        importance_dict = {}
        for i, col in enumerate(self.feature_columns):
            importance_dict[col] = {
                "visitor_importance": float(visitor_importance[i]),
                "sales_importance": float(sales_importance[i]),
            }

        # Sort by average importance
        sorted_importance = dict(
            sorted(
                importance_dict.items(),
                key=lambda x: (x[1]["visitor_importance"] + x[1]["sales_importance"]) / 2,
                reverse=True,
            )
        )

        return sorted_importance


async def train_and_predict(
    historical_data: pd.DataFrame,
    weather_forecast: Dict,
    prediction_date: datetime,
    user_id: str,
) -> Dict:
    """
    Main function to train model and make predictions

    Args:
        historical_data: Historical aggregated data
        weather_forecast: Weather forecast for prediction date
        prediction_date: Date to predict for
        user_id: User ID for the prediction

    Returns:
        Dictionary with predictions and metadata
    """
    try:
        print(
            f"Starting model training for user {user_id} with {len(historical_data)} days of data"
        )

        # Create features from historical data
        df_features = await create_features(
            historical_data, include_weather=False  # Historical weather not available yet
        )

        # Initialize and train model
        model = LightGBMPredictor()
        metrics = model.train(df_features)

        # Prepare features for prediction date
        # Get the last known values for lag features
        last_row = df_features.iloc[-1].to_dict()

        # Create prediction features
        prediction_features = {
            # Day of week features
            "day_of_week": prediction_date.weekday(),
            "is_weekend": prediction_date.weekday() >= 5,
            "is_monday": prediction_date.weekday() == 0,
            "is_friday": prediction_date.weekday() == 4,
            # Month features
            "month": prediction_date.month,
            "is_month_start": prediction_date.day <= 5,
            "is_month_end": prediction_date.day >= 25,
            # Rolling features (from last known values)
            "visitor_ma7": last_row.get("visitor_ma7", 0),
            "visitor_ma14": last_row.get("visitor_ma14", 0),
            "visitor_ma28": last_row.get("visitor_ma28", 0),
            "sales_ma7": last_row.get("sales_ma7", 0),
            "sales_ma14": last_row.get("sales_ma14", 0),
            "sales_ma28": last_row.get("sales_ma28", 0),
            # Lag features
            "visitor_lag1": last_row.get("visitor_count", 0),
            "visitor_lag7": last_row.get("visitor_lag7", 0),
            "sales_lag1": last_row.get("sales_amount", 0),
            "sales_lag7": last_row.get("sales_lag7", 0),
            # Trend features
            "visitor_trend_7d": last_row.get("visitor_trend_7d", 0),
            "sales_trend_7d": last_row.get("sales_trend_7d", 0),
            # Holiday flag (simplified - not checking actual holidays)
            "is_holiday": False,
        }

        # Add weather features
        weather_features = get_weather_impact_features(weather_forecast)
        prediction_features.update(
            {
                "weather_code": weather_features["weather_code"],
                "temp_avg": weather_features["temp_avg"],
                "temp_range": weather_features["temp_range"],
                "precipitation": weather_forecast["precipitation"],
                "is_rainy": weather_features["is_rainy"],
                "is_hot": weather_features["is_hot"],
                "is_cold": weather_features["is_cold"],
                "comfort_index": weather_features["comfort_index"],
            }
        )

        # Create DataFrame for prediction
        X_pred = pd.DataFrame([prediction_features])

        # Ensure all required columns are present
        for col in model.feature_columns:
            if col not in X_pred.columns:
                X_pred[col] = 0  # Default value for missing columns

        # Make predictions
        visitor_pred, sales_pred = model.predict(X_pred, confidence_level=0.9)

        # Get feature importance
        feature_importance = model.get_feature_importance()
        top_features = list(feature_importance.keys())[:5]

        # Prepare response
        result = {
            "predictions": {
                "visitor_count": {
                    "value": visitor_pred["value"],
                    "confidence_lower": visitor_pred["confidence_lower"],
                    "confidence_upper": visitor_pred["confidence_upper"],
                },
                "sales_amount": {
                    "value": sales_pred["value"],
                    "confidence_lower": sales_pred["confidence_lower"],
                    "confidence_upper": sales_pred["confidence_upper"],
                },
            },
            "model_version": "v1.0.0-lightgbm",
            "model_metrics": {
                "visitor_mape": round(metrics["visitor_mape"], 2),
                "sales_mape": round(metrics["sales_mape"], 2),
                "training_samples": metrics["training_samples"],
                "top_features": top_features,
            },
        }

        print(f"Prediction complete: {visitor_pred['value']} visitors, ¥{sales_pred['value']:.0f} sales")
        return result

    except Exception as e:
        print(f"Error in train_and_predict: {e}")
        raise