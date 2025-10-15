"""
Weather API service for fetching weather forecasts
"""
import os
import requests
from datetime import datetime, timedelta
from typing import Dict, Optional
from dotenv import load_dotenv

load_dotenv()


class WeatherAPIService:
    """Service for fetching weather forecasts from WeatherAPI.com"""

    def __init__(self):
        self.api_key = os.getenv("WEATHER_API_KEY")
        self.base_url = os.getenv("WEATHER_API_URL", "https://api.weatherapi.com/v1")

        if not self.api_key:
            raise ValueError("WEATHER_API_KEY must be set in environment variables")

    async def fetch_forecast(
        self, lat: float, lon: float, date: str
    ) -> Optional[Dict]:
        """
        Fetch weather forecast for a specific date and location

        Args:
            lat: Latitude
            lon: Longitude
            date: Date in YYYY-MM-DD format

        Returns:
            Weather forecast dictionary or None if error
        """
        try:
            # Check if date is within forecast range (1-14 days)
            target_date = datetime.strptime(date, "%Y-%m-%d")
            today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            days_ahead = (target_date - today).days

            if days_ahead < 1 or days_ahead > 14:
                print(f"Date {date} is outside forecast range (1-14 days)")
                return self._generate_average_forecast(date)

            # Use forecast.json for future dates (up to 14 days with paid plan)
            endpoint = f"{self.base_url}/forecast.json"
            params = {
                "key": self.api_key,
                "q": f"{lat},{lon}",
                "dt": date,
                "lang": "ja",  # Japanese language for conditions
                "aqi": "no",  # Don't need air quality data
            }

            response = requests.get(endpoint, params=params, timeout=10)
            response.raise_for_status()

            data = response.json()
            forecast_day = data["forecast"]["forecastday"][0]["day"]

            # Extract relevant weather data
            weather_data = {
                "condition": forecast_day["condition"]["text"],
                "temp_max": forecast_day["maxtemp_c"],
                "temp_min": forecast_day["mintemp_c"],
                "precipitation": forecast_day["daily_chance_of_rain"],
                "humidity": forecast_day["avghumidity"],
                "wind_speed": forecast_day["maxwind_kph"],
                "uv_index": forecast_day["uv"],
            }

            print(f"Fetched weather forecast for {date}: {weather_data['condition']}")
            return weather_data

        except requests.exceptions.RequestException as e:
            print(f"Weather API request failed: {e}")
            return self._generate_average_forecast(date)
        except Exception as e:
            print(f"Error fetching weather forecast: {e}")
            return self._generate_average_forecast(date)

    def _generate_average_forecast(self, date: str) -> Dict:
        """
        Generate average/fallback weather forecast when API fails
        Uses seasonal averages for Japan
        """
        target_date = datetime.strptime(date, "%Y-%m-%d")
        month = target_date.month

        # Seasonal weather patterns for Japan
        if month in [12, 1, 2]:  # Winter
            return {
                "condition": "曇り",
                "temp_max": 10.0,
                "temp_min": 2.0,
                "precipitation": 30,
                "humidity": 60,
                "wind_speed": 15.0,
            }
        elif month in [3, 4, 5]:  # Spring
            return {
                "condition": "晴れ時々曇り",
                "temp_max": 20.0,
                "temp_min": 12.0,
                "precipitation": 40,
                "humidity": 65,
                "wind_speed": 12.0,
            }
        elif month in [6, 7, 8]:  # Summer (including rainy season)
            return {
                "condition": "曇り時々雨" if month == 6 else "晴れ",
                "temp_max": 30.0 if month in [7, 8] else 25.0,
                "temp_min": 22.0 if month in [7, 8] else 18.0,
                "precipitation": 60 if month == 6 else 35,
                "humidity": 75,
                "wind_speed": 10.0,
            }
        else:  # Fall [9, 10, 11]
            return {
                "condition": "晴れ",
                "temp_max": 22.0,
                "temp_min": 14.0,
                "precipitation": 35,
                "humidity": 65,
                "wind_speed": 12.0,
            }


# Global service instance
weather_service = WeatherAPIService() if os.getenv("WEATHER_API_KEY") else None


async def get_weather_forecast(lat: float, lon: float, date: str) -> Dict:
    """
    Get weather forecast for a specific location and date.
    Falls back to seasonal averages if API is not configured or fails.
    """
    if weather_service:
        forecast = await weather_service.fetch_forecast(lat, lon, date)
        if forecast:
            return forecast

    # Fallback to demo/average weather if service not available
    print(f"Using demo weather forecast for {date}")
    target_date = datetime.strptime(date, "%Y-%m-%d")
    month = target_date.month
    day = target_date.day

    # Simple variation based on date
    weather_conditions = ["晴れ", "曇り", "晴れ時々曇り", "曇り時々晴れ"]
    weather_index = (day + month) % len(weather_conditions)

    # Temperature variation
    base_temp = 15 + (month - 6) * 2  # Peak in summer
    temp_variation = (day % 7) - 3

    return {
        "condition": weather_conditions[weather_index],
        "temp_max": base_temp + 8 + temp_variation,
        "temp_min": base_temp - 2 + temp_variation,
        "precipitation": (day * 3 + month * 5) % 60,
        "humidity": 60 + (day % 20),
        "wind_speed": 5 + (day % 10),
    }


def encode_weather_condition(condition: str) -> int:
    """
    Encode weather condition text to numerical category for ML model

    Returns:
        0: Clear/Sunny (晴れ)
        1: Partly Cloudy (晴れ時々曇り)
        2: Cloudy (曇り)
        3: Rainy (雨)
        4: Snow (雪)
        5: Other
    """
    condition_lower = condition.lower()

    if any(word in condition_lower for word in ["晴", "sunny", "clear"]):
        if "曇" in condition_lower or "cloud" in condition_lower:
            return 1  # Partly cloudy
        return 0  # Clear

    elif any(word in condition_lower for word in ["曇", "cloud", "overcast"]):
        if "晴" in condition_lower or "sun" in condition_lower:
            return 1  # Partly cloudy
        return 2  # Cloudy

    elif any(word in condition_lower for word in ["雨", "rain", "shower"]):
        return 3  # Rainy

    elif any(word in condition_lower for word in ["雪", "snow"]):
        return 4  # Snow

    else:
        return 5  # Other


def get_weather_impact_features(weather_data: Dict) -> Dict:
    """
    Generate weather impact features for the ML model

    Returns additional features based on weather that impact business
    """
    features = {
        "weather_code": encode_weather_condition(weather_data["condition"]),
        "temp_avg": (weather_data["temp_max"] + weather_data["temp_min"]) / 2,
        "temp_range": weather_data["temp_max"] - weather_data["temp_min"],
        "is_rainy": weather_data["precipitation"] > 50,
        "is_hot": weather_data["temp_max"] > 30,
        "is_cold": weather_data["temp_min"] < 5,
        "comfort_index": 0,  # To be calculated
    }

    # Calculate comfort index (0-100)
    # Optimal temperature around 22°C, low precipitation, moderate humidity
    temp_score = max(0, 100 - abs(features["temp_avg"] - 22) * 5)
    rain_score = max(0, 100 - weather_data["precipitation"])
    humidity = weather_data.get("humidity", 65)
    humidity_score = max(0, 100 - abs(humidity - 50) * 2)

    features["comfort_index"] = (temp_score + rain_score + humidity_score) / 3

    return features