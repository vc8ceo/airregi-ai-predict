"""
FastAPI ML Prediction Service for Airレジ予測システム
"""
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import services (to be created)
from services.database import get_user_historical_data
from services.weather import get_weather_forecast
from models.lightgbm_model import train_and_predict
from models.model_cache import ModelCache

# Initialize FastAPI app
app = FastAPI(
    title="Airレジ ML Prediction API",
    description="Machine Learning API for visitor count and sales prediction",
    version="1.0.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://airregi-ai-predict-cigam1230s-projects.vercel.app",
        os.getenv("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize model cache
model_cache = ModelCache()


# Request/Response models
class LocationModel(BaseModel):
    lat: float = Field(..., description="Latitude of store location")
    lon: float = Field(..., description="Longitude of store location")


class PredictionRequest(BaseModel):
    user_id: str = Field(..., description="User ID from Supabase auth")
    location: LocationModel
    prediction_date: Optional[str] = Field(
        None, description="Date to predict (YYYY-MM-DD). Defaults to tomorrow"
    )


class PredictionValues(BaseModel):
    value: float
    confidence_lower: float
    confidence_upper: float


class PredictionDetail(BaseModel):
    visitor_count: PredictionValues
    sales_amount: PredictionValues


class WeatherForecast(BaseModel):
    condition: str
    temp_max: float
    temp_min: float
    precipitation: float
    humidity: Optional[float] = None
    wind_speed: Optional[float] = None


class PredictionResponse(BaseModel):
    prediction_date: str
    predictions: PredictionDetail
    weather_forecast: WeatherForecast
    model_version: str
    model_metrics: Optional[Dict[str, float]] = None


# Authentication dependency
async def verify_api_key(authorization: Optional[str] = Header(None)) -> str:
    """Verify API key from authorization header"""
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authorization header missing",
        )

    api_key = os.getenv("ML_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="API key not configured",
        )

    if authorization != f"Bearer {api_key}":
        raise HTTPException(
            status_code=401,
            detail="Invalid API key",
        )

    return authorization


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Airレジ ML Prediction API",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat(),
    }


@app.post("/predict/next-day", response_model=PredictionResponse)
async def predict_next_day(
    request: PredictionRequest,
    auth: str = Depends(verify_api_key),
):
    """
    Predict visitor count and sales for the next day (or specified date).
    Uses historical data from Supabase and weather forecast.
    """
    try:
        # Determine prediction date
        if request.prediction_date:
            prediction_date = datetime.strptime(request.prediction_date, "%Y-%m-%d")
        else:
            prediction_date = datetime.now() + timedelta(days=1)

        # Validate prediction date (must be within 1-14 days from now)
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        min_date = today + timedelta(days=1)
        max_date = today + timedelta(days=14)

        if prediction_date < min_date or prediction_date > max_date:
            raise HTTPException(
                status_code=400,
                detail=f"Prediction date must be between {min_date.date()} and {max_date.date()}",
            )

        print(f"Predicting for user {request.user_id} on {prediction_date.date()}")

        # 1. Get historical data from Supabase
        historical_data = await get_user_historical_data(request.user_id)

        if historical_data.empty:
            raise HTTPException(
                status_code=400,
                detail="No historical data available for this user. Please upload journal data first.",
            )

        if len(historical_data) < 30:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient data for prediction. Found {len(historical_data)} days, need at least 30.",
            )

        print(f"Loaded {len(historical_data)} days of historical data")

        # 2. Get weather forecast
        weather_forecast = await get_weather_forecast(
            request.location.lat,
            request.location.lon,
            prediction_date.strftime("%Y-%m-%d"),
        )

        print(f"Weather forecast: {weather_forecast}")

        # 3. Check model cache
        cache_key = f"{request.user_id}_{prediction_date.date()}"
        cached_result = model_cache.get(cache_key)

        if cached_result:
            print(f"Returning cached prediction for {cache_key}")
            return cached_result

        # 4. Train model and make prediction
        prediction_result = await train_and_predict(
            historical_data=historical_data,
            weather_forecast=weather_forecast,
            prediction_date=prediction_date,
            user_id=request.user_id,
        )

        # 5. Format response
        response = PredictionResponse(
            prediction_date=prediction_date.strftime("%Y-%m-%d"),
            predictions=PredictionDetail(
                visitor_count=PredictionValues(
                    value=prediction_result["predictions"]["visitor_count"]["value"],
                    confidence_lower=prediction_result["predictions"]["visitor_count"][
                        "confidence_lower"
                    ],
                    confidence_upper=prediction_result["predictions"]["visitor_count"][
                        "confidence_upper"
                    ],
                ),
                sales_amount=PredictionValues(
                    value=prediction_result["predictions"]["sales_amount"]["value"],
                    confidence_lower=prediction_result["predictions"]["sales_amount"][
                        "confidence_lower"
                    ],
                    confidence_upper=prediction_result["predictions"]["sales_amount"][
                        "confidence_upper"
                    ],
                ),
            ),
            weather_forecast=WeatherForecast(**weather_forecast),
            model_version=prediction_result.get("model_version", "v1.0.0-lightgbm"),
            model_metrics=prediction_result.get("model_metrics"),
        )

        # 6. Cache the result
        model_cache.set(cache_key, response, ttl_hours=6)

        return response

    except HTTPException:
        raise
    except Exception as e:
        print(f"Prediction error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}",
        )


@app.post("/retrain")
async def retrain_model(
    user_id: str,
    auth: str = Depends(verify_api_key),
):
    """
    Trigger model retraining for a specific user.
    Called when new data is uploaded.
    """
    try:
        # Clear cache for this user
        model_cache.clear_user_cache(user_id)

        return {
            "status": "success",
            "message": f"Model cache cleared for user {user_id}. Next prediction will retrain.",
            "timestamp": datetime.now().isoformat(),
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Retrain failed: {str(e)}",
        )


@app.get("/health")
async def health_check():
    """Detailed health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "environment": {
            "supabase_url": bool(os.getenv("SUPABASE_URL")),
            "supabase_key": bool(os.getenv("SUPABASE_SERVICE_ROLE_KEY")),
            "weather_api_key": bool(os.getenv("WEATHER_API_KEY")),
            "ml_api_key": bool(os.getenv("ML_API_KEY")),
        },
        "cache_stats": model_cache.get_stats(),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        reload=True,
    )