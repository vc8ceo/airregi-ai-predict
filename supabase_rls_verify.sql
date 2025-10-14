-- Supabase RLS ポリシー確認用SQL
-- このSQLをSupabaseダッシュボードのSQL Editorで実行して、
-- upload_historyとdaily_aggregatedテーブルのDELETEポリシーが存在するか確認します

-- 1. upload_historyテーブルのポリシー一覧を確認
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'upload_history'
ORDER BY policyname;

-- 2. daily_aggregatedテーブルのポリシー一覧を確認
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'daily_aggregated'
ORDER BY policyname;

-- 期待される結果:
-- upload_historyには以下の3つのポリシーが存在するはず:
--   1. "Users can view own upload history" (SELECT)
--   2. "Users can insert own upload history" (INSERT)
--   3. "Users can delete own upload history" (DELETE)
--
-- daily_aggregatedには以下の4つのポリシーが存在するはず:
--   1. "Users can view own aggregated data" (SELECT)
--   2. "Users can insert own aggregated data" (INSERT)
--   3. "Users can update own aggregated data" (UPDATE)
--   4. "Users can delete own aggregated data" (DELETE)

-- もしDELETEポリシーが存在しない場合は、以下のSQLを実行してください:

-- upload_history テーブルの DELETE ポリシーを追加
CREATE POLICY "Users can delete own upload history"
  ON upload_history FOR DELETE
  USING (auth.uid() = user_id);

-- daily_aggregated テーブルの DELETE ポリシーを追加
CREATE POLICY "Users can delete own aggregated data"
  ON daily_aggregated FOR DELETE
  USING (auth.uid() = user_id);
