'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import YearlyHeatmapCalendar from '@/components/YearlyHeatmapCalendar'

interface UploadHistory {
  id: number
  file_name: string
  file_size: number
  row_count: number | null
  status: string
  error_message: string | null
  created_at: string
}

export default function DataManagementPage() {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [uploadHistory, setUploadHistory] = useState<UploadHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadProgress, setUploadProgress] = useState<string>('')
  const [uploadPercentage, setUploadPercentage] = useState<number>(0)
  const [currentFileName, setCurrentFileName] = useState<string>('')
  const [deleting, setDeleting] = useState<number | null>(null)
  const [journalDates, setJournalDates] = useState<string[]>([])
  const [loadingDates, setLoadingDates] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchUploadHistory()
    fetchJournalDates()
  }, [])

  // Auto-dismiss success message after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [success])

  // Auto-dismiss error message after 8 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null)
      }, 8000)
      return () => clearTimeout(timer)
    }
  }, [error])

  const fetchUploadHistory = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      // Add timestamp to bypass any caching
      const timestamp = Date.now()
      const { data, error } = await supabase
        .from('upload_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error

      console.log(`Fetched upload history at ${timestamp}:`, data)
      setUploadHistory(data || [])
    } catch (err: unknown) {
      console.error('Error fetching upload history:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchJournalDates = async () => {
    try {
      setLoadingDates(true)
      const response = await fetch('/api/journal-dates')

      if (!response.ok) {
        throw new Error('Failed to fetch journal dates')
      }

      const data = await response.json()
      setJournalDates(data.dates || [])
    } catch (err: unknown) {
      console.error('Error fetching journal dates:', err)
    } finally {
      setLoadingDates(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (selectedFiles && selectedFiles.length > 0) {
      const csvFiles: File[] = []
      const invalidFiles: string[] = []

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        if (file.name.endsWith('.csv')) {
          csvFiles.push(file)
        } else {
          invalidFiles.push(file.name)
        }
      }

      if (invalidFiles.length > 0) {
        setError(`以下のファイルはCSV形式ではありません: ${invalidFiles.join(', ')}`)
      } else {
        setError(null)
      }

      setFiles(csvFiles)
    }
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      setError('ファイルを選択してください')
      return
    }

    setUploading(true)
    setError(null)
    setSuccess(null)
    setUploadProgress('')
    setUploadPercentage(0)
    setCurrentFileName('')

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('ログインが必要です')
      }

      // Check for duplicate filenames in upload history
      const existingFilenames = new Set(uploadHistory.map((upload) => upload.file_name))
      const duplicateFiles: string[] = []
      const filesToUpload: File[] = []

      for (const file of files) {
        if (existingFilenames.has(file.name)) {
          duplicateFiles.push(file.name)
        } else {
          filesToUpload.push(file)
        }
      }

      // Show warning for duplicate files
      if (duplicateFiles.length > 0) {
        const warningMessage = `以下のファイルは既にアップロード済みのため、スキップされました:\n${duplicateFiles.join('\n')}`
        setError(warningMessage)
      }

      // If no files to upload after filtering duplicates
      if (filesToUpload.length === 0) {
        setUploadProgress('')
        setUploading(false)
        return
      }

      let successCount = 0
      let totalRows = 0
      const errors: string[] = []

      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i]
        const currentFileNumber = i + 1
        const percentage = Math.round((currentFileNumber / filesToUpload.length) * 100)

        setCurrentFileName(file.name)
        setUploadPercentage(percentage)
        setUploadProgress(
          `${currentFileNumber}/${filesToUpload.length} ファイルをアップロード中`
        )

        try {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('user_id', user.id)

          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            const errorData = await response.json()
            errors.push(`${file.name}: ${errorData.error || 'アップロードに失敗しました'}`)
          } else {
            const result = await response.json()
            successCount++
            totalRows += result.row_count || 0
          }
        } catch (err: unknown) {
          errors.push(`${file.name}: ${err instanceof Error ? err.message : 'アップロード中にエラーが発生しました'}`)
        }
      }

      // Show results
      let successMessage = ''
      if (successCount > 0) {
        successMessage = `${successCount}個のファイルを正常にアップロードしました。合計${totalRows}行のデータが処理されました。`
      }

      if (duplicateFiles.length > 0 && successCount > 0) {
        successMessage += `\n\n${duplicateFiles.length}個の重複ファイルをスキップしました。`
      }

      if (successMessage) {
        setSuccess(successMessage)
      }

      if (errors.length > 0) {
        const errorMessage = `以下のファイルでエラーが発生しました:\n${errors.join('\n')}`
        if (duplicateFiles.length > 0) {
          setError(
            `${errorMessage}\n\n以下のファイルは既にアップロード済みのため、スキップされました:\n${duplicateFiles.join('\n')}`
          )
        } else {
          setError(errorMessage)
        }
      }

      setFiles([])
      setUploadProgress('')
      setUploadPercentage(0)
      setCurrentFileName('')

      // Reset file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement
      if (fileInput) {
        fileInput.value = ''
      }

      // Refresh upload history and journal dates
      await fetchUploadHistory()
      await fetchJournalDates()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'アップロード中にエラーが発生しました')
      setUploadProgress('')
      setUploadPercentage(0)
      setCurrentFileName('')
    } finally {
      setUploading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status: string) => {
    const statusStyles: { [key: string]: string } = {
      success: 'bg-green-100 text-green-800',
      processing: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
    }

    const statusLabels: { [key: string]: string } = {
      success: '完了',
      processing: '処理中',
      failed: '失敗',
    }

    return (
      <span
        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
          statusStyles[status] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {statusLabels[status] || status}
      </span>
    )
  }

  const handleDelete = async (uploadId: number, fileName: string) => {
    if (
      !confirm(
        `「${fileName}」を削除してもよろしいですか？\n\nこのファイルに関連するすべてのデータがデータベースから削除されます。この操作は取り消せません。`
      )
    ) {
      return
    }

    setDeleting(uploadId)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/delete-upload', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ upload_id: uploadId }),
      })

      const responseData = await response.json()

      if (!response.ok) {
        throw new Error(responseData.error || '削除に失敗しました')
      }

      console.log('Delete successful, refreshing history...')

      // Immediately remove the item from local state for instant UI feedback
      setUploadHistory((prev) => prev.filter((item) => item.id !== uploadId))

      // Then refresh from server to ensure consistency
      setTimeout(async () => {
        await fetchUploadHistory()
        await fetchJournalDates()
      }, 100)

      // Show success message after refresh
      setSuccess(`${fileName} を削除しました`)
    } catch (err: unknown) {
      console.error('Delete error:', err)
      setError(err instanceof Error ? err.message : '削除中にエラーが発生しました')
      // If delete failed, refresh to show current state
      await fetchUploadHistory()
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">データ管理</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          ジャーナル履歴CSVファイルをアップロードして予測モデルに反映させます
        </p>
      </div>

      {/* Upload Section */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          ジャーナル履歴CSVアップロード
        </h2>

        <div className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-red-800">エラー</h3>
                  <p className="mt-2 text-sm text-red-700 whitespace-pre-line">{error}</p>
                </div>
                <div className="ml-auto pl-3">
                  <button
                    onClick={() => setError(null)}
                    className="inline-flex rounded-md bg-red-50 p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-red-50"
                  >
                    <span className="sr-only">閉じる</span>
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="rounded-md bg-green-50 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm text-green-700 whitespace-pre-line">{success}</p>
                </div>
                <div className="ml-auto pl-3">
                  <button
                    onClick={() => setSuccess(null)}
                    className="inline-flex rounded-md bg-green-50 p-1.5 text-green-500 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 focus:ring-offset-green-50"
                  >
                    <span className="sr-only">閉じる</span>
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="file-upload"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              CSVファイルを選択（複数選択可）
            </label>
            <input
              id="file-upload"
              type="file"
              accept=".csv"
              multiple
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 dark:text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                dark:file:bg-blue-900/20 dark:file:text-blue-400
                dark:hover:file:bg-blue-900/30"
            />
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  選択されたファイル ({files.length}個):
                </p>
                <ul className="space-y-1">
                  {files.map((f, index) => (
                    <li key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                      <svg
                        className="h-4 w-4 text-green-500 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      {f.name} ({formatFileSize(f.size)})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div>
            <button
              onClick={handleUpload}
              disabled={files.length === 0 || uploading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  アップロード中...
                </>
              ) : (
                <>
                  <svg
                    className="-ml-1 mr-2 h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  アップロード
                </>
              )}
            </button>
          </div>

          {uploadProgress && (
            <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-600 font-medium">{uploadProgress}</span>
                  <span className="text-blue-600 font-semibold">{uploadPercentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadPercentage}%` }}
                  ></div>
                </div>
                {currentFileName && (
                  <p className="text-xs text-gray-600 truncate">
                    処理中: {currentFileName}
                  </p>
                )}
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Airレジからエクスポートしたジャーナル履歴CSVファイルをアップロードしてください。
                  複数のファイルを一度に選択してアップロードできます。
                  データは自動的に処理され、予測モデルの精度向上に使用されます。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Journal Calendar */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg mb-6">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">ジャーナルカレンダー</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            緑色でハイライトされた日付にジャーナルデータが存在します
          </p>
        </div>
        <div className="p-6">
          {loadingDates ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              カレンダーを読み込み中...
            </div>
          ) : journalDates.length > 0 ? (
            <YearlyHeatmapCalendar highlightedDates={journalDates} />
          ) : (
            <div className="text-center py-8">
              <svg
                className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                ジャーナルデータなし
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                CSVファイルをアップロードすると、データのある日付がカレンダーに表示されます
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Upload History */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">アップロードデータ</h2>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">読み込み中...</div>
          ) : uploadHistory.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    ファイル名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    サイズ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    行数
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    ステータス
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    アップロード日時
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {uploadHistory.map((upload) => (
                  <tr key={upload.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {upload.file_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatFileSize(upload.file_size)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {upload.row_count?.toLocaleString() || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(upload.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(upload.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={() => handleDelete(upload.id, upload.file_name)}
                        disabled={deleting === upload.id}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                      >
                        {deleting === upload.id ? (
                          <>
                            <svg
                              className="animate-spin h-4 w-4 mr-1"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            削除中...
                          </>
                        ) : (
                          <>
                            <svg
                              className="h-4 w-4 mr-1"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                            削除
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                アップロード履歴なし
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                まだファイルをアップロードしていません
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
