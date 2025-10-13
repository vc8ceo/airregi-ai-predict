# 天気API統合設計書

## 1. 概要

本ドキュメントでは、外部天気APIとの統合設計を定義します。天気情報は来店数・売上予測の重要な説明変数として使用されます。

## 2. 天気API選定

### 2.1 候補API

#### 2.1.1 OpenWeatherMap API

**公式サイト**: https://openweathermap.org/api

**特徴:**
- 無料枠: 1,000リクエスト/日
- 過去データ、現在データ、予報データに対応
- JSONレスポンス
- 世界中の気象データに対応

**料金プラン:**
- Free: 1,000 calls/day
- Startup: $40/month (100,000 calls/day)
- Developer: $180/month (1,000,000 calls/day)

**メリット:**
- 豊富なドキュメント
- 日本語の都市に対応
- APIが安定している

**デメリット:**
- 無料枠が少ない
- 過去データ取得は有料プラン(History API)が必要

#### 2.1.2 WeatherAPI

**公式サイト**: https://www.weatherapi.com/

**特徴:**
- 無料枠: 1,000,000リクエスト/月
- 過去データ、現在データ、予報データに対応
- JSONレスポンス

**料金プラン:**
- Free: 1,000,000 calls/month
- Pro: $4/month (2,000,000 calls/month)

**メリット:**
- 無料枠が非常に大きい
- 過去データも無料で取得可能（過去1年間）
- レスポンスが高速

**デメリット:**
- OpenWeatherMapより新しいサービスのため情報が少ない

### 2.2 推奨API

**推奨**: **WeatherAPI**

理由:
- 無料枠が大きく、日次バッチ処理に十分
- 過去データ取得が無料
- APIレスポンスが高速

## 3. WeatherAPI 統合設計

### 3.1 API仕様

#### 3.1.1 ベースURL

```
https://api.weatherapi.com/v1
```

#### 3.1.2 認証

APIキーをクエリパラメータとして付与

```
?key=YOUR_API_KEY
```

#### 3.1.3 主要エンドポイント

##### a. Current Weather (現在の天気)

```http
GET /current.json?key={API_KEY}&q={location}&aqi=no
```

##### b. Forecast (天気予報)

```http
GET /forecast.json?key={API_KEY}&q={location}&days={num_days}&aqi=no
```

##### c. History (過去の天気)

```http
GET /history.json?key={API_KEY}&q={location}&dt={date}
```

### 3.2 レスポンス例

#### 過去の天気データ

```json
{
  "location": {
    "name": "Tokyo",
    "region": "",
    "country": "Japan",
    "lat": 35.69,
    "lon": 139.69,
    "tz_id": "Asia/Tokyo",
    "localtime": "2025-08-02 15:30"
  },
  "forecast": {
    "forecastday": [
      {
        "date": "2025-08-02",
        "day": {
          "maxtemp_c": 32.5,
          "mintemp_c": 25.3,
          "avgtemp_c": 28.4,
          "maxwind_kph": 20.5,
          "totalprecip_mm": 0.0,
          "avghumidity": 70,
          "condition": {
            "text": "Sunny",
            "code": 1000
          }
        }
      }
    ]
  }
}
```

### 3.3 Pythonクライアント実装

#### 3.3.1 基本クライアント

```python
import requests
from typing import Dict, Optional, List
from datetime import datetime, timedelta
import pandas as pd
import time

class WeatherAPIClient:
    """
    WeatherAPI クライアント
    """
    BASE_URL = "https://api.weatherapi.com/v1"

    def __init__(self, api_key: str):
        """
        Parameters:
        -----------
        api_key : str
            WeatherAPI の APIキー
        """
        self.api_key = api_key
        self.session = requests.Session()

    def _make_request(
        self,
        endpoint: str,
        params: Dict
    ) -> Dict:
        """
        APIリクエストを実行

        Parameters:
        -----------
        endpoint : str
            エンドポイント
        params : Dict
            クエリパラメータ

        Returns:
        --------
        Dict
            レスポンスJSON
        """
        url = f"{self.BASE_URL}/{endpoint}"
        params['key'] = self.api_key

        try:
            response = self.session.get(url, params=params, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"API request failed: {e}")
            raise

    def get_current_weather(self, location: str) -> Dict:
        """
        現在の天気を取得

        Parameters:
        -----------
        location : str
            場所（都市名、緯度経度等）

        Returns:
        --------
        Dict
            天気データ
        """
        params = {
            'q': location,
            'aqi': 'no'
        }
        return self._make_request('current.json', params)

    def get_forecast(
        self,
        location: str,
        days: int = 1
    ) -> Dict:
        """
        天気予報を取得

        Parameters:
        -----------
        location : str
            場所
        days : int
            予報日数（1-10日）

        Returns:
        --------
        Dict
            天気予報データ
        """
        params = {
            'q': location,
            'days': days,
            'aqi': 'no'
        }
        return self._make_request('forecast.json', params)

    def get_history(
        self,
        location: str,
        date: str
    ) -> Dict:
        """
        過去の天気を取得

        Parameters:
        -----------
        location : str
            場所
        date : str
            日付（YYYY-MM-DD形式）

        Returns:
        --------
        Dict
            過去の天気データ
        """
        params = {
            'q': location,
            'dt': date
        }
        return self._make_request('history.json', params)

    def get_bulk_history(
        self,
        location: str,
        start_date: str,
        end_date: str,
        delay: float = 0.1
    ) -> pd.DataFrame:
        """
        期間指定で過去の天気を一括取得

        Parameters:
        -----------
        location : str
            場所
        start_date : str
            開始日（YYYY-MM-DD）
        end_date : str
            終了日（YYYY-MM-DD）
        delay : float
            リクエスト間の待機時間（秒）

        Returns:
        --------
        pd.DataFrame
            天気データのデータフレーム
        """
        start = datetime.strptime(start_date, '%Y-%m-%d')
        end = datetime.strptime(end_date, '%Y-%m-%d')

        weather_data = []

        current_date = start
        while current_date <= end:
            date_str = current_date.strftime('%Y-%m-%d')
            print(f"Fetching weather data for {date_str}...")

            try:
                data = self.get_history(location, date_str)
                parsed_data = self._parse_history_response(data, date_str)
                weather_data.append(parsed_data)

                # レート制限を回避するための待機
                time.sleep(delay)

            except Exception as e:
                print(f"Failed to fetch data for {date_str}: {e}")

            current_date += timedelta(days=1)

        return pd.DataFrame(weather_data)

    def _parse_history_response(
        self,
        response: Dict,
        date: str
    ) -> Dict:
        """
        履歴レスポンスをパース

        Returns:
        --------
        Dict
            パースされた天気データ
        """
        forecast_day = response['forecast']['forecastday'][0]
        day_data = forecast_day['day']

        return {
            'date': date,
            'temp_max': day_data['maxtemp_c'],
            'temp_min': day_data['mintemp_c'],
            'temp_avg': day_data['avgtemp_c'],
            'humidity': day_data['avghumidity'],
            'precipitation': day_data['totalprecip_mm'],
            'wind_speed': day_data['maxwind_kph'],
            'weather_condition': day_data['condition']['text'],
            'weather_code': day_data['condition']['code']
        }

    def _parse_forecast_response(
        self,
        response: Dict
    ) -> List[Dict]:
        """
        予報レスポンスをパース

        Returns:
        --------
        List[Dict]
            パースされた天気予報データ
        """
        forecast_days = response['forecast']['forecastday']
        parsed_data = []

        for forecast_day in forecast_days:
            day_data = forecast_day['day']
            parsed_data.append({
                'date': forecast_day['date'],
                'temp_max': day_data['maxtemp_c'],
                'temp_min': day_data['mintemp_c'],
                'temp_avg': day_data['avgtemp_c'],
                'humidity': day_data['avghumidity'],
                'precipitation': day_data['totalprecip_mm'],
                'wind_speed': day_data['maxwind_kph'],
                'weather_condition': day_data['condition']['text'],
                'weather_code': day_data['condition']['code']
            })

        return parsed_data
```

#### 3.3.2 使用例

```python
# APIキーを環境変数から取得
import os
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv('WEATHER_API_KEY')

# クライアントのインスタンス化
client = WeatherAPIClient(api_key=API_KEY)

# 現在の天気を取得
current = client.get_current_weather(location='Tokyo')
print(current)

# 明日の天気予報を取得
forecast = client.get_forecast(location='Tokyo', days=1)
print(forecast)

# 過去の天気を取得（2025年8月1日〜8月31日）
history_df = client.get_bulk_history(
    location='Tokyo',
    start_date='2025-08-01',
    end_date='2025-08-31'
)
print(history_df.head())

# CSVに保存
history_df.to_csv('data/raw/weather/weather_202508.csv', index=False)
```

---

## 4. 店舗位置情報の設定

### 4.1 店舗の緯度経度を取得

店舗の正確な位置情報を設定ファイルに記録します。

#### config/config.yaml

```yaml
store:
  name: "ひとつぶフーペンズ月光100円台"
  location:
    city: "Tokyo"  # または具体的な住所
    lat: 35.6895    # 緯度
    lon: 139.6917   # 経度
  timezone: "Asia/Tokyo"

weather_api:
  provider: "weatherapi"
  api_key: "${WEATHER_API_KEY}"  # 環境変数から取得
  location_query: "35.6895,139.6917"  # 緯度,経度形式
  cache_ttl: 3600  # キャッシュ有効期間（秒）
```

---

## 5. データキャッシング

APIコールを削減するため、取得した天気データをキャッシュします。

```python
import os
import json
from pathlib import Path
from datetime import datetime, timedelta

class WeatherDataCache:
    """
    天気データのキャッシュ管理
    """
    def __init__(self, cache_dir: str = 'data/raw/weather_cache'):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _get_cache_path(self, location: str, date: str) -> Path:
        """
        キャッシュファイルのパスを取得
        """
        filename = f"{location}_{date}.json"
        return self.cache_dir / filename

    def get(self, location: str, date: str) -> Optional[Dict]:
        """
        キャッシュからデータを取得

        Returns:
        --------
        Optional[Dict]
            キャッシュが存在する場合はデータ、存在しない場合はNone
        """
        cache_path = self._get_cache_path(location, date)

        if cache_path.exists():
            with open(cache_path, 'r', encoding='utf-8') as f:
                return json.load(f)

        return None

    def set(self, location: str, date: str, data: Dict):
        """
        データをキャッシュに保存
        """
        cache_path = self._get_cache_path(location, date)

        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def is_valid(self, location: str, date: str, ttl: int = 86400) -> bool:
        """
        キャッシュが有効かどうかを確認

        Parameters:
        -----------
        ttl : int
            有効期間（秒）、デフォルトは24時間

        Returns:
        --------
        bool
            キャッシュが有効な場合True
        """
        cache_path = self._get_cache_path(location, date)

        if not cache_path.exists():
            return False

        # ファイルの更新日時を確認
        modified_time = datetime.fromtimestamp(cache_path.stat().st_mtime)
        now = datetime.now()

        return (now - modified_time).total_seconds() < ttl
```

### 5.1 キャッシュ対応クライアント

```python
class CachedWeatherAPIClient(WeatherAPIClient):
    """
    キャッシュ機能付き天気APIクライアント
    """
    def __init__(self, api_key: str, cache_dir: str = 'data/raw/weather_cache'):
        super().__init__(api_key)
        self.cache = WeatherDataCache(cache_dir)

    def get_history(self, location: str, date: str) -> Dict:
        """
        キャッシュを優先して過去の天気を取得
        """
        # キャッシュをチェック
        cached_data = self.cache.get(location, date)
        if cached_data and self.cache.is_valid(location, date):
            print(f"Using cached data for {date}")
            return cached_data

        # キャッシュが無い場合はAPIから取得
        print(f"Fetching from API for {date}")
        data = super().get_history(location, date)

        # キャッシュに保存
        self.cache.set(location, date, data)

        return data
```

---

## 6. エラーハンドリングとリトライ

APIリクエストが失敗した場合のリトライロジックを実装します。

```python
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

class RobustWeatherAPIClient(CachedWeatherAPIClient):
    """
    エラーハンドリングとリトライ機能付き天気APIクライアント
    """

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(requests.exceptions.RequestException)
    )
    def _make_request(self, endpoint: str, params: Dict) -> Dict:
        """
        リトライ機能付きAPIリクエスト
        """
        return super()._make_request(endpoint, params)
```

---

## 7. 日次バッチ処理での使用

### 7.1 過去データの初回ダウンロード

```python
def download_historical_weather(
    api_key: str,
    location: str,
    start_date: str,
    end_date: str,
    output_path: str
):
    """
    過去の天気データを一括ダウンロード

    Parameters:
    -----------
    api_key : str
        APIキー
    location : str
        場所
    start_date : str
        開始日（YYYY-MM-DD）
    end_date : str
        終了日（YYYY-MM-DD）
    output_path : str
        出力CSVパス
    """
    client = RobustWeatherAPIClient(api_key=api_key)

    df = client.get_bulk_history(
        location=location,
        start_date=start_date,
        end_date=end_date,
        delay=0.1  # 1秒あたり10リクエスト
    )

    df.to_csv(output_path, index=False, encoding='utf-8')
    print(f"Weather data saved to {output_path}")

# 実行例
download_historical_weather(
    api_key=os.getenv('WEATHER_API_KEY'),
    location='Tokyo',
    start_date='2025-08-01',
    end_date='2025-10-13',
    output_path='data/raw/weather/weather_history.csv'
)
```

### 7.2 日次予測時の天気予報取得

```python
def fetch_tomorrow_forecast(
    api_key: str,
    location: str
) -> Dict:
    """
    翌日の天気予報を取得

    Returns:
    --------
    Dict
        天気予報データ
    """
    client = RobustWeatherAPIClient(api_key=api_key)

    forecast_response = client.get_forecast(location=location, days=1)
    forecast_data = client._parse_forecast_response(forecast_response)

    # 明日のデータを返す
    return forecast_data[0] if forecast_data else {}

# 実行例
tomorrow_weather = fetch_tomorrow_forecast(
    api_key=os.getenv('WEATHER_API_KEY'),
    location='Tokyo'
)
print(tomorrow_weather)
```

---

## 8. 天気コードのマッピング

WeatherAPIの天気コードをカテゴリに変換します。

```python
WEATHER_CATEGORY_MAPPING = {
    1000: 'sunny',        # Sunny
    1003: 'cloudy',       # Partly cloudy
    1006: 'cloudy',       # Cloudy
    1009: 'cloudy',       # Overcast
    1030: 'fog',          # Mist
    1063: 'rainy',        # Patchy rain possible
    1066: 'snowy',        # Patchy snow possible
    1180: 'rainy',        # Patchy light rain
    1183: 'rainy',        # Light rain
    1186: 'rainy',        # Moderate rain at times
    1189: 'rainy',        # Moderate rain
    1192: 'rainy',        # Heavy rain at times
    1195: 'rainy',        # Heavy rain
    1210: 'snowy',        # Patchy light snow
    1213: 'snowy',        # Light snow
    # ... その他のコード
}

def categorize_weather(weather_code: int) -> str:
    """
    天気コードをカテゴリに変換

    Parameters:
    -----------
    weather_code : int
        天気コード

    Returns:
    --------
    str
        天気カテゴリ（'sunny', 'cloudy', 'rainy', 'snowy', 'fog'）
    """
    return WEATHER_CATEGORY_MAPPING.get(weather_code, 'unknown')
```

---

## 9. セキュリティ

### 9.1 APIキーの管理

APIキーは環境変数または`.env`ファイルで管理し、**Gitにコミットしない**ようにします。

#### .env ファイル

```bash
WEATHER_API_KEY=your_api_key_here
```

#### .gitignore

```
.env
config/.env
*.env
```

#### Pythonでの読み込み

```python
from dotenv import load_dotenv
import os

load_dotenv()
API_KEY = os.getenv('WEATHER_API_KEY')
```

---

## 10. モニタリングとログ

APIコールの状況をログに記録します。

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/weather_api.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger('WeatherAPI')

# 使用例
logger.info(f"Fetching weather data for {location} on {date}")
logger.error(f"Failed to fetch weather data: {error}")
```

---

## 更新履歴

| 日付 | バージョン | 更新内容 | 作成者 |
|------|------------|----------|--------|
| 2025-10-13 | 1.0 | 初版作成 | Claude |
