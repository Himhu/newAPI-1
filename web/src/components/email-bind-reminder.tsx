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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmailBindDialog } from '@/features/security/components/dialogs/email-bind-dialog'
import { getSelf } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

// "Later" only hides the reminder for this page session, so users signed in
// through a third-party provider are asked again on their next visit until
// they bind an email.
let dismissedThisSession = false

/**
 * Asks signed-in users without an email (typically third-party sign-ins) to
 * bind one, reusing the security-verified email binding flow.
 */
export function EmailBindReminder() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.auth.user)
  const setUser = useAuthStore((s) => s.auth.setUser)
  const [open, setOpen] = useState(false)
  const [binding, setBinding] = useState(false)

  const needsEmail = Boolean(user) && !user?.email?.trim()

  useEffect(() => {
    if (needsEmail && !dismissedThisSession) setOpen(true)
    if (!needsEmail) setOpen(false)
  }, [needsEmail])

  const later = () => {
    dismissedThisSession = true
    setOpen(false)
  }

  const refreshUser = async () => {
    try {
      const res = await getSelf()
      if (res?.success && res.data && user) setUser({ ...user, ...res.data })
    } catch {
      // The binding already succeeded; the next page load refreshes the user.
    }
  }

  if (!needsEmail) return null

  return (
    <>
      <Dialog open={open && !binding} onOpenChange={(next) => !next && later()}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('Bind your email')}</DialogTitle>
            <DialogDescription>
              {t(
                'Your account has no email yet. Bind one to receive top-up and security notices and to recover your account if you lose access to your sign-in provider.'
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={later}>
              {t('Later')}
            </Button>
            <Button
              onClick={() => {
                setOpen(false)
                setBinding(true)
              }}
            >
              {t('Bind now')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <EmailBindDialog
        open={binding}
        onOpenChange={(next) => {
          setBinding(next)
          if (!next) dismissedThisSession = true
        }}
        onSuccess={() => {
          void refreshUser()
        }}
      />
    </>
  )
}
