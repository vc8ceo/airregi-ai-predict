# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Airレジ予測システム - A dual-stack application combining machine learning prediction with a SaaS web interface:

1. **Python ML Backend**: Processes POS (Airレジ) journal history data and weather forecasts to predict daily store visitor count and sales using LightGBM, Prophet, and LSTM models
2. **Next.js Frontend**: Multi-tenant SaaS application with user authentication, dashboard analytics, and prediction interface

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

# Run development server with Turbopack
npm run dev  # Starts on http://localhost:3000

# Build for production (uses Turbopack)
npm run build

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

**Deployment:**
- **Platform**: Vercel (currently deployed)
- **Production URL**: https://airregi-ai-predict-cigam1230s-projects.vercel.app
- **Auto-deploy**: Pushes to main branch trigger automatic deployment
- **Root Directory**: `airregi-predict-app` (configured in Vercel project settings)
- **Framework**: Next.js 15.5.4 with Turbopack

## Architecture Insights

### Data Flow Architecture

**Journal History CSV Processing:**
- CSVs are **CP932/Shift-JIS encoded** (Japanese Windows encoding) - always use `encoding='cp932'`
- 70 columns per row (see [docs/01_data_dictionary.md](docs/01_data_dictionary.md))
- Must be sorted chronologically by `売上日` + `売上日時` columns (columns 2-3)
- Visitor count = unique `伝票No` (receipt numbers) per day
- Sales amount = sum of `小計` (column 30) + `消費税額` (column 41)

**Multi-Tenant Database Design:**
- Supabase PostgreSQL with Row Level Security (RLS)
- Each user's data is isolated via `user_id` foreign key
- 5 main tables: `profiles`, `journal_data`, `daily_aggregated`, `predictions`, `upload_history`
- RLS policies enforce `auth.uid() = user_id` on all operations
- Database schema and types: [airregi-predict-app/types/database.types.ts](airregi-predict-app/types/database.types.ts)

**Prediction Workflow:**
1. User uploads CSV via Next.js → [/api/upload](airregi-predict-app/app/api/upload/route.ts) route
2. CSV parsed and inserted into `journal_data` table (batched inserts, max 1000 rows)
3. Daily aggregation creates `daily_aggregated` records
4. Prediction request → [/api/predict](airregi-predict-app/app/api/predict/route.ts) → calls external ML API (FastAPI, not yet implemented)
5. ML API fetches user's historical data + weather forecast → generates prediction
6. Prediction saved to `predictions` table and returned to frontend

### Authentication Flow

**Supabase Auth Integration:**
- Three Supabase client types:
  - [lib/supabase/client.ts](airregi-predict-app/lib/supabase/client.ts) - Browser client (client components)
  - [lib/supabase/server.ts](airregi-predict-app/lib/supabase/server.ts) - Server client (server components, API routes)
  - [lib/supabase/middleware.ts](airregi-predict-app/lib/supabase/middleware.ts) - Middleware for session refresh
- [middleware.ts](airregi-predict-app/middleware.ts) intercepts all routes, refreshes session, redirects unauthenticated users
- Google OAuth flow: Login → Supabase → `/auth/callback` → Dashboard
- On signup, profile record auto-created in `profiles` table

### Route Groups Convention

**Next.js App Router:**
- `(auth)` group - Public authentication pages ([login](airregi-predict-app/app/(auth)/login/page.tsx), [signup](airregi-predict-app/app/(auth)/signup/page.tsx)), no layout
- `(dashboard)` group - Protected pages with shared [layout.tsx](airregi-predict-app/app/(dashboard)/layout.tsx) (nav, logout button)
  - [dashboard](airregi-predict-app/app/(dashboard)/dashboard/page.tsx) - KPI metrics and overview
  - [prediction](airregi-predict-app/app/(dashboard)/prediction/page.tsx) - Run predictions
  - [data-management](airregi-predict-app/app/(dashboard)/data-management/page.tsx) - Upload/manage CSV data
- Root [/page.tsx](airregi-predict-app/app/page.tsx) redirects based on auth state

## Critical Implementation Details

### TypeScript Error Handling Best Practices

When catching errors in TypeScript, **always use `error: unknown`** instead of `error: any`:

```typescript
// ✓ CORRECT - Type-safe error handling
try {
  // ... code that might throw
} catch (error: unknown) {
  console.error('Error:', error)
  const message = error instanceof Error ? error.message : 'An unknown error occurred'
  // Use message
}

// ✗ WRONG - Violates @typescript-eslint/no-explicit-any
try {
  // ... code that might throw
} catch (error: any) {
  console.error('Error:', error.message)  // ESLint error!
}
```

**Type Guards for Union Types:**
When dealing with values that can be multiple types (e.g., `string | number`), use type guards:

```typescript
// Example from dashboard/page.tsx
const totalSales = dailyData.reduce(
  (sum, day) => sum + (typeof day.sales_amount === 'number' ? day.sales_amount : parseFloat(day.sales_amount)),
  0
)
```

### CSV Upload and Processing

Upload API route pattern ([app/api/upload/route.ts](airregi-predict-app/app/api/upload/route.ts)):
1. Validate file type (.csv only)
2. Create upload_history record with status='processing'
3. Parse CSV - handle CP932 encoding if needed
4. Batch insert into journal_data (max 1000 rows per batch)
5. Update upload_history status='success' with row_count
6. On error: status='failed' with error_message

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

Complete schema and policies: [docs/09_supabase_setup_guide.md](docs/09_supabase_setup_guide.md)

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

**Vercel Environment Variables:**
- Configured in Vercel project settings
- Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- All env vars are set for production, preview, and development targets

## Common Pitfalls

1. **Windows Path Handling**: Use PowerShell for Python venv commands, not Git Bash
2. **CSV Encoding**: Always specify `encoding='cp932'` for journal CSVs
3. **Supabase Client Selection**: Server components use `await createClient()` from `lib/supabase/server.ts`, client components use `createClient()` from `lib/supabase/client.ts`
4. **Middleware Order**: Supabase middleware must call `getUser()` before any logic
5. **RLS Policies**: Always test with multiple user accounts to verify data isolation
6. **Batch Inserts**: Supabase has limits - use batches of 1000 rows max
7. **TypeScript Paths**: Always use `@/*` imports for absolute paths in Next.js
8. **TypeScript Error Handling**: Never use `error: any`, always use `error: unknown` with type guards
9. **Vercel Deployment**: Do not create a `vercel.json` if the project rootDirectory is already set in project settings

## Project Status

**Implemented:**
- ✅ Python virtual environment and dependencies
- ✅ CSV merging utility (19 files → 176,210 rows)
- ✅ Complete Next.js application with auth, dashboard, prediction, data management
- ✅ Supabase integration with RLS policies
- ✅ TypeScript database types
- ✅ API routes for prediction and upload
- ✅ Comprehensive documentation (9 markdown files)
- ✅ Production deployment on Vercel (auto-deploy from main branch)
- ✅ Type-safe error handling throughout Next.js app

**Not Yet Implemented:**
- ⏳ FastAPI ML prediction service
- ⏳ Actual ML model training (LightGBM, Prophet, LSTM)
- ⏳ Weather API integration
- ⏳ Daily aggregation background job
- ⏳ Recharts data visualization in dashboard
- ⏳ Google OAuth configuration

## Target Accuracy Goals

- **Visitor Count**: MAPE < 15%, MAE < 8 visitors
- **Sales Amount**: MAPE < 20%, MAE < 500 yen

## Key Documentation References

- **CSV Schema**: [docs/01_data_dictionary.md](docs/01_data_dictionary.md) (all 70 columns explained)
- **Supabase Setup**: [docs/09_supabase_setup_guide.md](docs/09_supabase_setup_guide.md) (complete SQL schema and RLS policies)
- **Next.js Architecture**: [docs/08_nextjs_app_architecture.md](docs/08_nextjs_app_architecture.md) (full system design)
- **ML Models**: [docs/04_ml_models.md](docs/04_ml_models.md) (LightGBM, Prophet, LSTM specifications)
- **API Specification**: [docs/06_prediction_api.md](docs/06_prediction_api.md) (FastAPI endpoint design)
- **README**: [README.md](README.md) (Japanese project overview and setup)

## Recent Changes

- **2025-01-14**: Successfully deployed to Vercel with auto-deployment from main branch
- **2025-01-14**: Fixed all TypeScript ESLint errors (replaced `any` with `unknown` + type guards)
- **2025-01-14**: Added type safety for `sales_amount` handling (string | number union type)
- **2025-01-14**: Removed conflicting vercel.json file (project settings handle build configuration)
