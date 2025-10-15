"""
Development server runner for ML API
"""
import os
import sys
import uvicorn
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


def main():
    """Run the FastAPI development server"""

    # Check for required environment variables
    required_vars = [
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "ML_API_KEY",
    ]

    missing_vars = []
    for var in required_vars:
        if not os.getenv(var) or os.getenv(var) == f"your-{var.lower().replace('_', '-')}-here":
            missing_vars.append(var)

    if missing_vars:
        print("=" * 60)
        print("ERROR: Missing or unconfigured environment variables:")
        for var in missing_vars:
            print(f"  - {var}")
        print("\nPlease update the .env file with your actual credentials.")
        print("=" * 60)
        sys.exit(1)

    # Optional warning for Weather API
    if not os.getenv("WEATHER_API_KEY") or "your-weather-api-key" in os.getenv("WEATHER_API_KEY", ""):
        print("WARNING: Weather API key not configured. Using fallback weather data.")

    print("=" * 60)
    print("Starting Airレジ ML Prediction API")
    print(f"Server URL: http://localhost:{os.getenv('PORT', 8000)}")
    print(f"API Docs: http://localhost:{os.getenv('PORT', 8000)}/docs")
    print("=" * 60)

    # Run the server
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8000)),
        reload=True,
        log_level="info",
    )


if __name__ == "__main__":
    main()