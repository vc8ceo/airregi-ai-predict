import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get upload_id from request body
    const { upload_id } = await request.json()

    if (!upload_id) {
      return NextResponse.json({ error: 'upload_id is required' }, { status: 400 })
    }

    // Get upload history record to verify ownership and get file_name for fallback
    const { data: uploadRecord, error: fetchError } = await supabase
      .from('upload_history')
      .select('user_id, file_name')
      .eq('id', upload_id)
      .single()

    if (fetchError || !uploadRecord) {
      return NextResponse.json({ error: 'Upload record not found' }, { status: 404 })
    }

    // Verify that the upload belongs to the current user
    if (uploadRecord.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check if there are any journal_data records with upload_id
    const { count: journalCountWithId } = await supabase
      .from('journal_data')
      .select('*', { count: 'exact', head: true })
      .eq('upload_id', upload_id)

    // Delete journal_data records associated with this upload
    if (journalCountWithId && journalCountWithId > 0) {
      // New data with upload_id
      const { error: deleteJournalError } = await supabase
        .from('journal_data')
        .delete()
        .eq('upload_id', upload_id)

      if (deleteJournalError) {
        console.error('Error deleting journal data by upload_id:', deleteJournalError)
        return NextResponse.json(
          { error: 'Failed to delete journal data: ' + deleteJournalError.message },
          { status: 500 }
        )
      }
    } else {
      // Legacy data without upload_id - delete all data for this user
      // Note: This deletes ALL journal data for the user since we can't identify specific upload
      const { error: deleteJournalError } = await supabase
        .from('journal_data')
        .delete()
        .eq('user_id', user.id)

      if (deleteJournalError) {
        console.error('Error deleting legacy journal data:', deleteJournalError)
        return NextResponse.json(
          { error: 'Failed to delete journal data: ' + deleteJournalError.message },
          { status: 500 }
        )
      }
    }

    // Delete daily_aggregated records associated with this upload
    const { count: dailyCountWithId } = await supabase
      .from('daily_aggregated')
      .select('*', { count: 'exact', head: true })
      .eq('upload_id', upload_id)

    if (dailyCountWithId && dailyCountWithId > 0) {
      const { error: deleteDailyError } = await supabase
        .from('daily_aggregated')
        .delete()
        .eq('upload_id', upload_id)

      if (deleteDailyError) {
        console.error('Error deleting daily aggregated data:', deleteDailyError)
      }
    } else {
      // Legacy data - delete all for user
      const { error: deleteDailyError } = await supabase
        .from('daily_aggregated')
        .delete()
        .eq('user_id', user.id)

      if (deleteDailyError) {
        console.error('Error deleting legacy daily data:', deleteDailyError)
      }
    }

    // Delete the upload history record
    const { error: deleteUploadError } = await supabase
      .from('upload_history')
      .delete()
      .eq('id', upload_id)

    if (deleteUploadError) {
      console.error('Error deleting upload history:', deleteUploadError)
      return NextResponse.json(
        { error: 'Failed to delete upload history: ' + deleteUploadError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Upload data deleted successfully',
    })
  } catch (error: unknown) {
    console.error('Error in delete-upload API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
