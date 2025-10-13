export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          store_name: string | null
          store_location: string | null
          store_lat: number | null
          store_lon: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          store_name?: string | null
          store_location?: string | null
          store_lat?: number | null
          store_lon?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          store_name?: string | null
          store_location?: string | null
          store_lat?: number | null
          store_lon?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      journal_data: {
        Row: {
          id: number
          user_id: string
          receipt_no: string
          sales_date: string
          sales_time: string
          product_name: string | null
          category: string | null
          quantity: number
          unit_price: number
          subtotal: number
          discount_amount: number
          tax_amount: number
          payment_method: string | null
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          receipt_no: string
          sales_date: string
          sales_time: string
          product_name?: string | null
          category?: string | null
          quantity: number
          unit_price: number
          subtotal: number
          discount_amount: number
          tax_amount: number
          payment_method?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          receipt_no?: string
          sales_date?: string
          sales_time?: string
          product_name?: string | null
          category?: string | null
          quantity?: number
          unit_price?: number
          subtotal?: number
          discount_amount?: number
          tax_amount?: number
          payment_method?: string | null
          created_at?: string
        }
      }
      daily_aggregated: {
        Row: {
          id: number
          user_id: string
          date: string
          visitor_count: number
          sales_amount: number
          avg_per_customer: number | null
          weather_condition: string | null
          temp_max: number | null
          temp_min: number | null
          precipitation: number | null
          day_of_week: number
          is_holiday: boolean
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          date: string
          visitor_count: number
          sales_amount: number
          avg_per_customer?: number | null
          weather_condition?: string | null
          temp_max?: number | null
          temp_min?: number | null
          precipitation?: number | null
          day_of_week: number
          is_holiday: boolean
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          date?: string
          visitor_count?: number
          sales_amount?: number
          avg_per_customer?: number | null
          weather_condition?: string | null
          temp_max?: number | null
          temp_min?: number | null
          precipitation?: number | null
          day_of_week?: number
          is_holiday?: boolean
          created_at?: string
        }
      }
      predictions: {
        Row: {
          id: number
          user_id: string
          prediction_date: string
          predicted_visitor_count: number
          predicted_sales_amount: number
          visitor_count_confidence_lower: number | null
          visitor_count_confidence_upper: number | null
          sales_amount_confidence_lower: number | null
          sales_amount_confidence_upper: number | null
          actual_visitor_count: number | null
          actual_sales_amount: number | null
          model_version: string | null
          weather_forecast: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          user_id: string
          prediction_date: string
          predicted_visitor_count: number
          predicted_sales_amount: number
          visitor_count_confidence_lower?: number | null
          visitor_count_confidence_upper?: number | null
          sales_amount_confidence_lower?: number | null
          sales_amount_confidence_upper?: number | null
          actual_visitor_count?: number | null
          actual_sales_amount?: number | null
          model_version?: string | null
          weather_forecast?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          prediction_date?: string
          predicted_visitor_count?: number
          predicted_sales_amount?: number
          visitor_count_confidence_lower?: number | null
          visitor_count_confidence_upper?: number | null
          sales_amount_confidence_lower?: number | null
          sales_amount_confidence_upper?: number | null
          actual_visitor_count?: number | null
          actual_sales_amount?: number | null
          model_version?: string | null
          weather_forecast?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      upload_history: {
        Row: {
          id: number
          user_id: string
          file_name: string
          file_size: number
          row_count: number | null
          status: string
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          file_name: string
          file_size: number
          row_count?: number | null
          status: string
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          file_name?: string
          file_size?: number
          row_count?: number | null
          status?: string
          error_message?: string | null
          created_at?: string
        }
      }
    }
  }
}
