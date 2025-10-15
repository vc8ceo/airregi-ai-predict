"""
Supabase database service for fetching user historical data
"""
from supabase import create_client, Client
import pandas as pd
import os
from typing import Optional
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()


class SupabaseService:
    """Service class for Supabase database operations"""

    def __init__(self):
        """Initialize Supabase client"""
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

        if not supabase_url or not supabase_key:
            raise ValueError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables"
            )

        self.client: Client = create_client(supabase_url, supabase_key)

    async def fetch_with_pagination(
        self, table: str, select: str, filters: dict, order_by: str = "date"
    ) -> list:
        """
        Fetch data from Supabase with pagination to handle > 1000 rows
        """
        all_data = []
        range_start = 0
        range_size = 1000
        has_more = True

        while has_more:
            # Build query
            query = self.client.table(table).select(select)

            # Apply filters
            for key, value in filters.items():
                query = query.eq(key, value)

            # Apply range and order
            query = query.order(order_by, desc=False)
            query = query.range(range_start, range_start + range_size - 1)

            # Execute query
            response = query.execute()

            if not response.data:
                has_more = False
            else:
                all_data.extend(response.data)
                has_more = len(response.data) == range_size
                range_start += range_size

                print(f"Fetched {len(all_data)} records so far...")

        return all_data


# Global instance
supabase_service = SupabaseService()


async def get_user_historical_data(user_id: str) -> pd.DataFrame:
    """
    Get historical aggregated data for a user.
    First checks daily_aggregated table, falls back to journal_data if needed.
    """
    try:
        print(f"Fetching historical data for user {user_id}")

        # First try to get data from daily_aggregated table
        aggregated_data = await supabase_service.fetch_with_pagination(
            table="daily_aggregated",
            select="date, visitor_count, sales_amount, day_of_week, is_holiday, avg_per_customer",
            filters={"user_id": user_id},
            order_by="date",
        )

        if aggregated_data and len(aggregated_data) >= 30:
            print(f"Found {len(aggregated_data)} days in daily_aggregated table")
            df = pd.DataFrame(aggregated_data)
            df["date"] = pd.to_datetime(df["date"])
            return df.sort_values("date").reset_index(drop=True)

        # If not enough aggregated data, aggregate from journal_data
        print("Insufficient aggregated data. Aggregating from journal_data...")

        journal_data = await supabase_service.fetch_with_pagination(
            table="journal_data",
            select="sales_date, receipt_no, subtotal, tax_amount",
            filters={"user_id": user_id},
            order_by="sales_date",
        )

        if not journal_data:
            return pd.DataFrame()

        # Convert to DataFrame
        df_journal = pd.DataFrame(journal_data)

        # Ensure proper data types
        df_journal["subtotal"] = pd.to_numeric(df_journal["subtotal"], errors="coerce")
        df_journal["tax_amount"] = pd.to_numeric(
            df_journal["tax_amount"], errors="coerce"
        )

        # Group by date and aggregate
        daily_data = []
        for date in df_journal["sales_date"].unique():
            if not date:
                continue

            day_data = df_journal[df_journal["sales_date"] == date]

            # Calculate metrics
            visitor_count = day_data["receipt_no"].nunique()
            sales_amount = (
                day_data["subtotal"].sum() + day_data["tax_amount"].sum()
            )
            avg_per_customer = (
                sales_amount / visitor_count if visitor_count > 0 else 0
            )

            # Get day of week
            date_obj = pd.to_datetime(date)
            day_of_week = date_obj.dayofweek  # Monday=0, Sunday=6

            daily_data.append(
                {
                    "date": date,
                    "visitor_count": visitor_count,
                    "sales_amount": sales_amount,
                    "avg_per_customer": avg_per_customer,
                    "day_of_week": day_of_week,
                    "is_holiday": False,  # Will be updated with holiday detection
                }
            )

        if not daily_data:
            return pd.DataFrame()

        # Create DataFrame and sort by date
        df_aggregated = pd.DataFrame(daily_data)
        df_aggregated["date"] = pd.to_datetime(df_aggregated["date"])
        df_aggregated = df_aggregated.sort_values("date").reset_index(drop=True)

        # Save aggregated data back to database for future use
        print("Saving aggregated data to daily_aggregated table...")
        for _, row in df_aggregated.iterrows():
            try:
                supabase_service.client.table("daily_aggregated").upsert(
                    {
                        "user_id": user_id,
                        "date": row["date"].strftime("%Y-%m-%d"),
                        "visitor_count": int(row["visitor_count"]),
                        "sales_amount": float(row["sales_amount"]),
                        "avg_per_customer": float(row["avg_per_customer"]),
                        "day_of_week": int(row["day_of_week"]),
                        "is_holiday": bool(row["is_holiday"]),
                    },
                    on_conflict="user_id,date",
                ).execute()
            except Exception as e:
                print(f"Warning: Failed to save aggregated data for {row['date']}: {e}")
                continue

        print(f"Aggregated {len(df_aggregated)} days of data")
        return df_aggregated

    except Exception as e:
        print(f"Error fetching historical data: {e}")
        raise


async def get_user_profile(user_id: str) -> Optional[dict]:
    """
    Get user profile information including store location
    """
    try:
        response = (
            supabase_service.client.table("profiles")
            .select("*")
            .eq("id", user_id)
            .single()
            .execute()
        )

        return response.data if response.data else None

    except Exception as e:
        print(f"Error fetching user profile: {e}")
        return None


async def save_prediction_to_db(
    user_id: str,
    prediction_date: str,
    prediction_data: dict,
    model_version: str = "v1.0.0",
):
    """
    Save prediction results to the predictions table
    """
    try:
        supabase_service.client.table("predictions").insert(
            {
                "user_id": user_id,
                "prediction_date": prediction_date,
                "predicted_visitor_count": int(
                    prediction_data["predictions"]["visitor_count"]["value"]
                ),
                "predicted_sales_amount": float(
                    prediction_data["predictions"]["sales_amount"]["value"]
                ),
                "visitor_count_confidence_lower": int(
                    prediction_data["predictions"]["visitor_count"]["confidence_lower"]
                ),
                "visitor_count_confidence_upper": int(
                    prediction_data["predictions"]["visitor_count"]["confidence_upper"]
                ),
                "sales_amount_confidence_lower": float(
                    prediction_data["predictions"]["sales_amount"]["confidence_lower"]
                ),
                "sales_amount_confidence_upper": float(
                    prediction_data["predictions"]["sales_amount"]["confidence_upper"]
                ),
                "weather_forecast": prediction_data.get("weather_forecast"),
                "model_version": model_version,
                "created_at": datetime.now().isoformat(),
            }
        ).execute()

        print(f"Saved prediction for {user_id} on {prediction_date}")

    except Exception as e:
        print(f"Error saving prediction: {e}")
        # Non-critical error, don't raise