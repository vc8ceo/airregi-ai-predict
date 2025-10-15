"""
Model cache system for storing prediction results
"""
from typing import Dict, Optional, Any
from datetime import datetime, timedelta
import json


class ModelCache:
    """Simple in-memory cache for model predictions"""

    def __init__(self):
        self.cache: Dict[str, Dict[str, Any]] = {}

    def get(self, key: str) -> Optional[Any]:
        """
        Get cached value if exists and not expired

        Args:
            key: Cache key

        Returns:
            Cached value or None if not found/expired
        """
        if key in self.cache:
            entry = self.cache[key]
            if datetime.now() < entry["expires_at"]:
                print(f"Cache hit for key: {key}")
                return entry["value"]
            else:
                # Remove expired entry
                del self.cache[key]
                print(f"Cache expired for key: {key}")

        return None

    def set(self, key: str, value: Any, ttl_hours: int = 6):
        """
        Set cache value with TTL

        Args:
            key: Cache key
            value: Value to cache
            ttl_hours: Time to live in hours
        """
        self.cache[key] = {
            "value": value,
            "expires_at": datetime.now() + timedelta(hours=ttl_hours),
            "created_at": datetime.now(),
        }
        print(f"Cached result for key: {key} (TTL: {ttl_hours} hours)")

    def clear_user_cache(self, user_id: str):
        """
        Clear all cache entries for a specific user

        Args:
            user_id: User ID to clear cache for
        """
        keys_to_remove = [key for key in self.cache.keys() if key.startswith(user_id)]

        for key in keys_to_remove:
            del self.cache[key]

        print(f"Cleared {len(keys_to_remove)} cache entries for user {user_id}")

    def clear_all(self):
        """Clear entire cache"""
        count = len(self.cache)
        self.cache.clear()
        print(f"Cleared all {count} cache entries")

    def get_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics

        Returns:
            Dictionary with cache statistics
        """
        now = datetime.now()
        active_entries = sum(
            1 for entry in self.cache.values() if now < entry["expires_at"]
        )
        expired_entries = len(self.cache) - active_entries

        return {
            "total_entries": len(self.cache),
            "active_entries": active_entries,
            "expired_entries": expired_entries,
            "cache_keys": list(self.cache.keys())[:10],  # Show first 10 keys
        }

    def cleanup_expired(self):
        """Remove all expired entries from cache"""
        now = datetime.now()
        keys_to_remove = [
            key for key, entry in self.cache.items() if now >= entry["expires_at"]
        ]

        for key in keys_to_remove:
            del self.cache[key]

        if keys_to_remove:
            print(f"Cleaned up {len(keys_to_remove)} expired cache entries")


# For future: File-based cache for persistence
class PersistentModelCache:
    """
    File-based cache for model persistence (future enhancement)
    """

    def __init__(self, cache_dir: str = "cache"):
        import os

        self.cache_dir = cache_dir
        if not os.path.exists(cache_dir):
            os.makedirs(cache_dir)

    def get_model_path(self, user_id: str, model_type: str) -> str:
        """Get file path for cached model"""
        import os

        return os.path.join(self.cache_dir, f"{user_id}_{model_type}.pkl")

    def save_model(self, model: Any, user_id: str, model_type: str):
        """Save trained model to file"""
        import joblib

        path = self.get_model_path(user_id, model_type)
        joblib.dump(model, path)
        print(f"Saved {model_type} model for user {user_id} to {path}")

    def load_model(self, user_id: str, model_type: str) -> Optional[Any]:
        """Load trained model from file"""
        import os
        import joblib

        path = self.get_model_path(user_id, model_type)
        if os.path.exists(path):
            # Check if model is recent (within 7 days)
            file_age = datetime.now() - datetime.fromtimestamp(os.path.getmtime(path))
            if file_age < timedelta(days=7):
                print(f"Loading cached {model_type} model for user {user_id}")
                return joblib.load(path)
            else:
                print(f"Cached model for {user_id} is too old ({file_age.days} days)")
        return None

    def clear_user_models(self, user_id: str):
        """Delete cached models for a user"""
        import os
        import glob

        pattern = os.path.join(self.cache_dir, f"{user_id}_*.pkl")
        files = glob.glob(pattern)

        for file in files:
            os.remove(file)

        print(f"Removed {len(files)} cached models for user {user_id}")