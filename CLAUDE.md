# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Airレジ予測システム - A dual-stack application combining machine learning prediction with a SaaS web interface:

1. **Python ML Backend**: Processes POS (Airレジ) journal history data and weather forecasts to predict daily store visitor count and sales using LightGBM, Prophet, and LSTM models
2. **Next.js Frontend**: Multi-tenant SaaS application with user authentication, dashboard analytics, and prediction interface

## Repository Structure

```
airregi_ai_predict/
├── airregi-predict-app/        # Next.js 14 SaaS frontend (TypeScript)
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/            # Auth pages (login, signup)
│   │   ├── (dashboard)/       # Protected dashboard pages
│   │   └── api/               # API Routes (predict, upload)
│   ├── lib/supabase/          # Supabase client utilities (client, server, middleware)
│   ├── types/database.types.ts # TypeScript database schema
│   └── middleware.ts           # Auth middleware
├── scripts/                    # Python utility scripts
│   └── merge_journal_data.py   # CSV merging utility
├── data/                       # Data storage
│   ├── raw/journal/           # Raw journal CSV files
│   ├── processed/             # Processed feature data
│   └── models/                # Trained ML models
├── docs/                       # Comprehensive documentation
│   ├── 01_data_dictionary.md  # 70-column CSV schema
│   ├── 02_system_architecture.md
│   ├── 03_data_pipeline.md
│   ├── 04_ml_models.md
│   ├── 05_weather_api_integration.md
│   ├── 06_prediction_api.md
│   ├── 07_implementation_plan.md
│   ├── 08_nextjs_app_architecture.md
│   └── 09_supabase_setup_guide.md
└── input_data/                 # Journal history CSV files (3-month segments)
```

## Development Commands

### Python ML Backend

**Virtual Environment:**
```bash
# Activate virtual environment (always use venv for Python work)
.\venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt
```

**Data Processing:**
```bash
# Merge multiple journal history CSVs chronologically
python scripts/merge_journal_data.py \
  --input-dir input_data \
  --output data/raw/journal/merged_journal_history.csv \
  --summary

# Run with venv on Windows
powershell -Command "cd 'D:\Projects\airregi_ai_predict'; .\venv\Scripts\python.exe scripts/merge_journal_data.py --summary"
```

**Testing:**
```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_data/test_loader.py

# Run with coverage
pytest --cov=src tests/
```

**Code Quality:**
```bash
# Format code
black src/ tests/

# Lint code
flake8 src/ tests/

# Type check
mypy src/
```

### Next.js Frontend

**Development:**
```bash
cd airregi-predict-app

# Install dependencies
npm install

# Run development server
npm run dev  # Starts on http://localhost:3000

# Build for production
npm run build

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

## Architecture Insights

### Data Flow Architecture

**Journal History CSV Processing:**
- CSVs are **CP932/Shift-JIS encoded** (Japanese Windows encoding) - always use `encoding='cp932'`
- 70 columns per row (see docs/01_data_dictionary.md)
- Must be sorted chronologically by `売上日` + `売上日時` columns (columns 2-3)
- Visitor count = unique `伝票No` (receipt numbers) per day
- Sales amount = sum of `小計` (column 30) + `消費税額` (column 41)

**Multi-Tenant Database Design:**
- Supabase PostgreSQL with Row Level Security (RLS)
- Each user's data is isolated via `user_id` foreign key
- 5 main tables: `profiles`, `journal_data`, `daily_aggregated`, `predictions`, `upload_history`
- RLS policies enforce `auth.uid() = user_id` on all operations

**Prediction Workflow:**
1. User uploads CSV via Next.js → `/api/upload` route
2. CSV parsed and inserted into `journal_data` table (batched inserts, max 1000 rows)
3. Daily aggregation creates `daily_aggregated` records
4. Prediction request → `/api/predict` → calls external ML API (FastAPI, not yet implemented)
5. ML API fetches user's historical data + weather forecast → generates prediction
6. Prediction saved to `predictions` table and returned to frontend

### Authentication Flow

**Supabase Auth Integration:**
- Three Supabase client types:
  - `lib/supabase/client.ts` - Browser client (client components)
  - `lib/supabase/server.ts` - Server client (server components, API routes)
  - `lib/supabase/middleware.ts` - Middleware for session refresh
- `middleware.ts` intercepts all routes, refreshes session, redirects unauthenticated users
- Google OAuth flow: Login → Supabase → `/auth/callback` → Dashboard
- On signup, profile record auto-created in `profiles` table

### Route Groups Convention

**Next.js App Router:**
- `(auth)` group - Public authentication pages, no layout
- `(dashboard)` group - Protected pages with shared `layout.tsx` (nav, logout button)
- Root `/page.tsx` redirects based on auth state

## Critical Implementation Details

### CSV Upload and Processing

When implementing CSV upload logic:
```typescript
// Upload API route pattern (app/api/upload/route.ts)
// 1. Validate file type (.csv only)
// 2. Create upload_history record with status='processing'
// 3. Parse CSV - handle CP932 encoding if needed
// 4. Batch insert into journal_data (max 1000 rows per batch)
// 5. Update upload_history status='success' with row_count
// 6. On error: status='failed' with error_message
```

### Supabase RLS Policies

All tables require RLS policies for multi-tenancy:
```sql
-- Standard pattern for SELECT
CREATE POLICY "Users can view own data"
  ON table_name FOR SELECT
  USING (auth.uid() = user_id);

-- Standard pattern for INSERT
CREATE POLICY "Users can insert own data"
  ON table_name FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### Python Data Processing Notes

**Encoding Handling:**
- Journal CSVs: **Must** use `encoding='cp932'` when reading with pandas
- Output CSVs: Use `encoding='utf-8-sig'` for Excel compatibility
- Unicode characters (✓, ✗, ⚠) cause errors in Windows console - use ASCII alternatives

**Date/Time Processing:**
```python
# Combine date and time columns for chronological sorting
df['_temp_datetime'] = pd.to_datetime(
    df['売上日'] + ' ' + df['売上日時'],
    format='%Y/%m/%d %H:%M:%S',
    errors='coerce'
)
df = df.sort_values('_temp_datetime')
df = df.drop('_temp_datetime', axis=1)
```

### ML Model Integration (Future)

The ML API endpoints (FastAPI) are designed but not implemented. When implementing:
- Expected endpoint: `POST /predict/next-day`
- Request: `{user_id, location: {lat, lon}}`
- Response: Prediction with confidence intervals + weather forecast
- Must fetch user's historical data from Supabase
- Must call WeatherAPI for forecast data
- Models: LightGBM (primary), Prophet (trend), LSTM (optional)

## Environment Configuration

**Python (.env):**
```bash
WEATHER_API_KEY=your_weather_api_key
API_KEY=your_internal_api_key
```

**Next.js (.env.local):**
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
ML_API_URL=your_ml_api_url  # Not yet implemented
ML_API_KEY=your_ml_api_key
WEATHER_API_KEY=your_weather_api_key
WEATHER_API_URL=https://api.weatherapi.com/v1
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Common Pitfalls

1. **Windows Path Handling**: Use PowerShell for Python venv commands, not Git Bash
2. **CSV Encoding**: Always specify `encoding='cp932'` for journal CSVs
3. **Supabase Client Selection**: Server components use `await createClient()` from `lib/supabase/server.ts`, client components use `createClient()` from `lib/supabase/client.ts`
4. **Middleware Order**: Supabase middleware must call `getUser()` before any logic
5. **RLS Policies**: Always test with multiple user accounts to verify data isolation
6. **Batch Inserts**: Supabase has limits - use batches of 1000 rows max
7. **TypeScript Paths**: Always use `@/*` imports for absolute paths in Next.js

## Project Status

**Implemented:**
- ✅ Python virtual environment and dependencies
- ✅ CSV merging utility (19 files → 176,210 rows)
- ✅ Complete Next.js application with auth, dashboard, prediction, data management
- ✅ Supabase integration with RLS policies
- ✅ TypeScript database types
- ✅ API routes for prediction and upload
- ✅ Comprehensive documentation (9 markdown files)

**Not Yet Implemented:**
- ⏳ FastAPI ML prediction service
- ⏳ Actual ML model training (LightGBM, Prophet, LSTM)
- ⏳ Weather API integration
- ⏳ Daily aggregation background job
- ⏳ Recharts data visualization in dashboard
- ⏳ Production deployment (Vercel + Supabase)

## Target Accuracy Goals

- **Visitor Count**: MAPE < 15%, MAE < 8 visitors
- **Sales Amount**: MAPE < 20%, MAE < 500 yen

## Key Documentation References

- **CSV Schema**: docs/01_data_dictionary.md (all 70 columns explained)
- **Supabase Setup**: docs/09_supabase_setup_guide.md (complete SQL schema and RLS policies)
- **Next.js Architecture**: docs/08_nextjs_app_architecture.md (full system design)
- **ML Models**: docs/04_ml_models.md (LightGBM, Prophet, LSTM specifications)
- **API Specification**: docs/06_prediction_api.md (FastAPI endpoint design)
