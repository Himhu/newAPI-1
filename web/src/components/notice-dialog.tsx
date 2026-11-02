/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { RichContent } from '@/components/rich-content'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getNotice } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'
import { useNotificationStore } from '@/stores/notification-store'

// Closing with × only hides the notice for the current page session, so it
// stays hidden while navigating between the public and console layouts.
let dismissedThisSession = false

/**
 * Pops up the system notice once per notice revision so users actually see
 * it. "Got it" hides this revision until the admin edits it; "Don't show
 * again today" hides it until tomorrow.
 */
export function NoticeDialog() {
  const { t } = useTranslation()
  const { data } = useQuery({
    queryKey: ['notice'],
    queryFn: async () => requireServerSuccess(await getNotice()),
    staleTime: 1000 * 60 * 5,
  })
  const lastReadNotice = useNotificationStore((s) => s.lastReadNotice)
  const closedUntilDate = useNotificationStore((s) => s.closedUntilDate)
  const markNoticeRead = useNotificationStore((s) => s.markNoticeRead)
  const setClosedUntilDate = useNotificationStore((s) => s.setClosedUntilDate)
  const [open, setOpen] = useState(false)

  const notice = data?.success ? (data.data || '').trim() : ''

  useEffect(() => {
    if (!notice || dismissedThisSession) return
    if (notice === lastReadNotice) return
    if (closedUntilDate === new Date().toDateString()) return
    setOpen(true)
  }, [notice, lastReadNotice, closedUntilDate])

  const close = () => {
    dismissedThisSession = true
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('System Notice')}</DialogTitle>
        </DialogHeader>
        <ScrollArea className='max-h-[min(60vh,32rem)] pr-3'>
          <RichContent breaks content={notice} />
        </ScrollArea>
        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => {
              setClosedUntilDate(new Date().toDateString())
              close()
            }}
          >
            {t("Don't show again today")}
          </Button>
          <Button
            onClick={() => {
              markNoticeRead(notice)
              close()
            }}
          >
            {t('Got it')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
