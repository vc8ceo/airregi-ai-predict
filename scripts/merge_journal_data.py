"""
複数のジャーナル履歴CSVファイルをマージして時系列順に並べるスクリプト
"""
import os
import glob
import pandas as pd
from pathlib import Path
from typing import List
import argparse


def load_journal_csv(file_path: str) -> pd.DataFrame:
    """
    ジャーナル履歴CSVを読み込む

    Parameters:
    -----------
    file_path : str
        CSVファイルのパス

    Returns:
    --------
    pd.DataFrame
        読み込まれたデータフレーム
    """
    print(f"Loading: {os.path.basename(file_path)}...", end=' ')

    try:
        # CP932エンコーディングで読み込み
        df = pd.read_csv(file_path, encoding='cp932')
        print(f"OK ({len(df):,} rows)")
        return df
    except Exception as e:
        print(f"ERROR: {e}")
        return None


def merge_journal_files(
    input_dir: str,
    output_file: str,
    pattern: str = "ジャーナル履歴_*.csv"
) -> pd.DataFrame:
    """
    複数のジャーナル履歴CSVファイルをマージ

    Parameters:
    -----------
    input_dir : str
        入力ディレクトリ
    output_file : str
        出力ファイルパス
    pattern : str
        ファイル名パターン

    Returns:
    --------
    pd.DataFrame
        マージされたデータフレーム
    """
    # CSVファイルを検索
    search_path = os.path.join(input_dir, pattern)
    csv_files = sorted(glob.glob(search_path))

    if not csv_files:
        print(f"WARNING: No CSV files found in {input_dir}")
        return None

    print(f"\n{'='*60}")
    print(f"Found {len(csv_files)} CSV files")
    print(f"{'='*60}\n")

    # 各CSVファイルを読み込んでリストに格納
    dataframes = []
    for csv_file in csv_files:
        df = load_journal_csv(csv_file)
        if df is not None and not df.empty:
            dataframes.append(df)

    if not dataframes:
        print("\nWARNING: No data loaded successfully")
        return None

    print(f"\n{'='*60}")
    print(f"Merging {len(dataframes)} dataframes...")
    print(f"{'='*60}\n")

    # データフレームを結合
    merged_df = pd.concat(dataframes, ignore_index=True)

    print(f"Total rows before sorting: {len(merged_df):,}")

    # 売上日でソート（時系列順）
    date_column = merged_df.columns[2]  # 3番目のカラムが売上日
    time_column = merged_df.columns[3]  # 4番目のカラムが売上日時

    print(f"Sorting by: '{date_column}' and '{time_column}'...")

    # 日付と時刻を結合して datetime に変換
    merged_df['_temp_datetime'] = pd.to_datetime(
        merged_df[date_column] + ' ' + merged_df[time_column],
        format='%Y/%m/%d %H:%M:%S',
        errors='coerce'
    )

    # 時系列順にソート
    merged_df = merged_df.sort_values('_temp_datetime')

    # 一時カラムを削除
    merged_df = merged_df.drop('_temp_datetime', axis=1)

    # インデックスをリセット
    merged_df = merged_df.reset_index(drop=True)

    print(f"Total rows after sorting: {len(merged_df):,}")

    # 日付範囲を表示
    if len(merged_df) > 0:
        first_date = merged_df[date_column].iloc[0]
        last_date = merged_df[date_column].iloc[-1]
        print(f"\nDate range: {first_date} to {last_date}")

    # 保存
    print(f"\nSaving merged data to: {output_file}")
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    merged_df.to_csv(output_file, index=False, encoding='utf-8-sig')

    file_size = os.path.getsize(output_file) / (1024 * 1024)  # MB
    print(f"Saved successfully! (File size: {file_size:.2f} MB)")

    return merged_df


def get_data_summary(df: pd.DataFrame) -> dict:
    """
    データの基本統計を取得

    Parameters:
    -----------
    df : pd.DataFrame
        データフレーム

    Returns:
    --------
    dict
        統計情報
    """
    date_column = df.columns[2]  # 売上日
    receipt_column = df.columns[0]  # 伝票No
    subtotal_column = df.columns[30]  # 小計
    tax_column = df.columns[41]  # 消費税額

    # 日付をパース
    df[date_column] = pd.to_datetime(df[date_column], format='%Y/%m/%d', errors='coerce')

    # 日付の範囲
    date_range = df[date_column].dropna()
    min_date = date_range.min()
    max_date = date_range.max()
    unique_dates = date_range.nunique()

    # 伝票数（取引数）
    unique_receipts = df[receipt_column].nunique()

    # 売上金額（小計 + 消費税）
    df[subtotal_column] = pd.to_numeric(df[subtotal_column], errors='coerce')
    df[tax_column] = pd.to_numeric(df[tax_column], errors='coerce')

    total_sales = (df[subtotal_column] + df[tax_column]).sum()

    # 平均
    avg_daily_receipts = unique_receipts / unique_dates if unique_dates > 0 else 0
    avg_daily_sales = total_sales / unique_dates if unique_dates > 0 else 0
    avg_receipt_amount = total_sales / unique_receipts if unique_receipts > 0 else 0

    return {
        'total_rows': len(df),
        'date_range': (min_date, max_date),
        'unique_dates': unique_dates,
        'unique_receipts': unique_receipts,
        'total_sales': total_sales,
        'avg_daily_receipts': avg_daily_receipts,
        'avg_daily_sales': avg_daily_sales,
        'avg_receipt_amount': avg_receipt_amount
    }


def main():
    parser = argparse.ArgumentParser(
        description='複数のジャーナル履歴CSVファイルをマージ'
    )
    parser.add_argument(
        '--input-dir',
        type=str,
        default='input_data',
        help='入力ディレクトリ（デフォルト: input_data）'
    )
    parser.add_argument(
        '--output',
        type=str,
        default='data/raw/journal/merged_journal_history.csv',
        help='出力ファイルパス（デフォルト: data/raw/journal/merged_journal_history.csv）'
    )
    parser.add_argument(
        '--pattern',
        type=str,
        default='ジャーナル履歴_*.csv',
        help='ファイル名パターン（デフォルト: ジャーナル履歴_*.csv）'
    )
    parser.add_argument(
        '--summary',
        action='store_true',
        help='統計サマリーを表示'
    )

    args = parser.parse_args()

    # マージ実行
    merged_df = merge_journal_files(
        input_dir=args.input_dir,
        output_file=args.output,
        pattern=args.pattern
    )

    if merged_df is None:
        print("\nWARNING: Merge failed")
        return

    # 統計サマリーを表示
    if args.summary:
        print(f"\n{'='*60}")
        print("DATA SUMMARY")
        print(f"{'='*60}\n")

        summary = get_data_summary(merged_df)

        print(f"Total rows: {summary['total_rows']:,}")
        print(f"Business days: {summary['unique_dates']:,}")
        print(f"Total transactions: {summary['unique_receipts']:,}")
        print(f"Total sales: {summary['total_sales']:,.0f} yen")
        print(f"\nPeriod: {summary['date_range'][0].strftime('%Y-%m-%d')} to {summary['date_range'][1].strftime('%Y-%m-%d')}")
        print(f"\nAvg daily visitors: {summary['avg_daily_receipts']:.1f}")
        print(f"Avg daily sales: {summary['avg_daily_sales']:,.0f} yen")
        print(f"Avg per customer: {summary['avg_receipt_amount']:,.0f} yen")

    print(f"\n{'='*60}")
    print("Merge completed successfully!")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
