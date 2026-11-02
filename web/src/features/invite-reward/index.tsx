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
import {
  ArrowRightLeft,
  BadgeCheck,
  BarChart3,
  CircleCheck,
  Clock,
  Gift,
  Link2,
  Snowflake,
  Ticket,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getSelf } from '@/lib/api'
import { formatQuota, formatTimestampToDate } from '@/lib/format'

import { getInvitedUsers, getTopupInfo } from '../wallet/api'
import { TransferDialog } from '../wallet/components/dialogs/transfer-dialog'
import { useAffiliate } from '../wallet/hooks'
import type { InvitedUser, TopupInfo, UserWalletData } from '../wallet/types'

function formatRemaining(unlockAt: number, nowSec: number): string {
  const diff = unlockAt - nowSec
  if (diff <= 0) return ''
  const days = Math.floor(diff / 86400)
  const hours = Math.floor((diff % 86400) / 3600)
  const minutes = Math.floor((diff % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return `${diff}s`
}

function formatPercent(ratio: number): string {
  const percent = ratio * 100
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(1)
}

interface InvitedUsersTableProps {
  invitedUsers: InvitedUser[]
  nowSec: number
}

function InvitedUsersTable({ invitedUsers, nowSec }: InvitedUsersTableProps) {
  const { t } = useTranslation()

  if (invitedUsers.length === 0) {
    return (
      <div className='flex flex-col items-center gap-2 py-12 text-center'>
        <div className='bg-muted flex size-12 items-center justify-center rounded-full'>
          <Users className='text-muted-foreground size-5' />
        </div>
        <p className='text-sm font-medium'>{t('No invitations yet')}</p>
        <p className='text-muted-foreground text-xs'>
          {t('Share your invite link to start earning rebates')}
        </p>
      </div>
    )
  }

  return (
    <div className='overflow-x-auto rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow className='bg-muted/40 hover:bg-muted/40'>
            <TableHead className='h-9 px-4 text-xs'>{t('User')}</TableHead>
            <TableHead className='h-9 text-xs'>{t('Email')}</TableHead>
            <TableHead className='h-9 text-xs'>{t('Registered')}</TableHead>
            <TableHead className='h-9 text-xs'>{t('Total Topup')}</TableHead>
            <TableHead className='h-9 text-xs'>{t('Last Topup')}</TableHead>
            <TableHead className='h-9 text-xs'>{t('Settled')}</TableHead>
            <TableHead className='h-9 w-[190px] pr-4 text-xs'>
              {t('Frozen')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitedUsers.map((user) => {
            const remaining =
              user.pending_quota > 0
                ? formatRemaining(user.earliest_unlock_at, nowSec)
                : ''
            return (
              <TableRow key={user.id} className='hover:bg-muted/30'>
                <TableCell className='px-4 py-3 align-middle text-sm font-medium'>
                  {user.display_name || user.username}
                </TableCell>
                <TableCell className='text-muted-foreground py-3 align-middle font-mono text-xs'>
                  {user.email || '-'}
                </TableCell>
                <TableCell className='text-muted-foreground py-3 align-middle text-xs tabular-nums'>
                  {formatTimestampToDate(user.registered_at).slice(0, 10)}
                </TableCell>
                <TableCell className='py-3 align-middle text-sm tabular-nums'>
                  {user.total_topup_money > 0 ? (
                    user.total_topup_money.toFixed(2)
                  ) : (
                    <span className='text-muted-foreground'>-</span>
                  )}
                </TableCell>
                <TableCell className='text-muted-foreground py-3 align-middle text-xs tabular-nums'>
                  {user.last_topup_at > 0
                    ? formatTimestampToDate(user.last_topup_at).slice(0, 10)
                    : '-'}
                </TableCell>
                <TableCell className='py-3 align-middle text-sm tabular-nums'>
                  {user.settled_quota > 0 ? (
                    <span className='font-medium text-emerald-600 dark:text-emerald-400'>
                      {formatQuota(user.settled_quota)}
                    </span>
                  ) : (
                    <span className='text-muted-foreground'>-</span>
                  )}
                </TableCell>
                <TableCell className='py-3 pr-4 align-middle'>
                  {user.pending_quota > 0 ? (
                    <div className='space-y-0.5'>
                      <div className='text-sm font-medium text-orange-600 tabular-nums dark:text-orange-400'>
                        {formatQuota(user.pending_quota)}
                      </div>
                      <div className='text-muted-foreground flex items-center gap-1 text-xs'>
                        <Clock className='size-3 text-orange-500' />
                        {user.earliest_unlock_at > 0 && remaining === ''
                          ? t('Settling soon')
                          : remaining}
                        {user.pending_count > 1
                          ? ` · ${t('{{count}} pending', { count: user.pending_count })}`
                          : ''}
                      </div>
                    </div>
                  ) : (
                    <span className='text-muted-foreground text-sm'>-</span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export function InviteReward() {
  const { t } = useTranslation()
  const [user, setUser] = useState<UserWalletData | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([])
  const [topupInfo, setTopupInfo] = useState<TopupInfo | null>(null)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000))

  const {
    affiliateLink,
    loading: affiliateLoading,
    transferQuota,
    transferring,
  } = useAffiliate()

  const fetchUser = useCallback(async () => {
    try {
      setUserLoading(true)
      const response = await getSelf()
      if (response.success && response.data) {
        setUser(response.data as UserWalletData)
      }
    } catch {
      // toast handled globally; keep last known user state
    } finally {
      setUserLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
    getInvitedUsers()
      .then((res) => {
        if (res.success && res.data) setInvitedUsers(res.data)
      })
      .catch(() => {})
    getTopupInfo()
      .then((res) => {
        if (res.success && res.data) setTopupInfo(res.data)
      })
      .catch(() => {})
  }, [fetchUser])

  // Tick every minute while any rebate is frozen so countdowns stay fresh
  useEffect(() => {
    const hasPending = invitedUsers.some(
      (u) => u.pending_quota > 0 && u.earliest_unlock_at > 0
    )
    if (!hasPending) return undefined
    const timer = setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000))
    }, 60000)
    return () => clearInterval(timer)
  }, [invitedUsers])

  const handleTransfer = async (amount: number) => {
    const success = await transferQuota(amount)
    if (success) {
      await fetchUser()
    }
    return success
  }

  const complianceConfirmed = topupInfo?.payment_compliance_confirmed !== false
  const ratio = topupInfo?.invite_reward_ratio ?? 0
  const percentText = formatPercent(ratio)
  const settleDays = topupInfo?.invite_reward_settle_days ?? 7
  const includeRedemption =
    topupInfo?.invite_reward_include_redemption !== false
  const inviteeBonus = topupInfo?.quota_for_invitee ?? 0
  const inviterBonus = topupInfo?.quota_for_inviter ?? 0

  const stats = [
    {
      label: t('Transferable'),
      value: formatQuota(user?.aff_quota ?? 0),
      icon: TrendingUp,
    },
    {
      label: t('Frozen'),
      value: formatQuota(user?.aff_pending_quota ?? 0),
      icon: Snowflake,
    },
    {
      label: t('Total Earned'),
      value: formatQuota(user?.aff_history_quota ?? 0),
      icon: BarChart3,
    },
    {
      label: t('Invited Users'),
      value: String(user?.invited_count ?? 0),
      icon: Users,
    },
  ]

  const heroPills = [
    t('Register via your invite link'),
    t('Settles automatically'),
    t('Every payment counts'),
  ]

  const rules = [
    {
      icon: BadgeCheck,
      title: t('How rebates work'),
      body: t(
        'When a friend registers through your invite link, every successful payment they make earns you a {{percent}}% rebate of the credited amount.',
        { percent: percentText }
      ),
    },
    {
      icon: Clock,
      title: t('How rebates settle'),
      body: t(
        'Each rebate stays frozen for {{count}} days first, then settles automatically and becomes transferable.',
        { count: settleDays }
      ),
    },
    {
      icon: ArrowRightLeft,
      title: t('Using your earnings'),
      body: t(
        'Settled earnings can be transferred to your account balance at any time with the transfer button.'
      ),
    },
    {
      icon: Ticket,
      title: t('Redemption codes'),
      body: includeRedemption
        ? t('Redemption code topups by your friends also earn rebates.')
        : t('Redemption code topups do not earn rebates.'),
    },
  ]

  const ruleParams = [
    { label: t('Payment rebate'), value: `${percentText}%` },
    {
      label: t('Settlement period'),
      value: t('{{count}} days', { count: settleDays }),
    },
    {
      label: t('Redemption codes'),
      value: includeRedemption ? t('Included') : t('Excluded'),
    },
  ]

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Invite Rewards')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <div className='mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5'>
            {/* Hero banner */}
            <div className='relative overflow-hidden rounded-xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-emerald-50/60 to-teal-50 p-4 sm:p-6 dark:border-emerald-900/50 dark:from-emerald-950/60 dark:via-emerald-950/30 dark:to-teal-950/40'>
              <div className='flex flex-col gap-5 lg:flex-row lg:items-stretch lg:justify-between'>
                <div className='min-w-0'>
                  <span className='inline-flex items-center gap-1.5 rounded-full border border-emerald-300/70 bg-white/70 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'>
                    <Gift className='size-3.5' />
                    {t('Invite Rewards')} · {t('Ongoing rebates')}
                  </span>
                  <h2 className='mt-3 text-lg font-semibold sm:text-xl'>
                    {t('Earn every time your friends pay')}
                  </h2>
                  <div className='mt-1 flex items-end gap-2'>
                    <span className='text-5xl font-bold tracking-tight text-emerald-600 sm:text-6xl dark:text-emerald-400'>
                      {percentText}%
                    </span>
                    <span className='text-muted-foreground pb-1.5 text-sm font-medium sm:pb-2'>
                      {t('rebate on every payment')}
                    </span>
                  </div>
                  <div className='mt-4 flex flex-wrap gap-2'>
                    {heroPills.map((pill) => (
                      <span
                        key={pill}
                        className='rounded-lg border border-emerald-200/80 bg-white/80 px-3 py-1.5 text-xs font-medium text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-100'
                      >
                        {pill}
                      </span>
                    ))}
                  </div>
                </div>
                <div className='flex shrink-0 flex-col justify-between gap-3 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 p-4 text-white sm:p-5 lg:w-[320px]'>
                  <div>
                    <div className='text-xs font-medium text-emerald-100'>
                      {t('Settlement period')}
                    </div>
                    <div className='mt-1 text-4xl font-bold tracking-tight'>
                      {t('{{count}} days', { count: settleDays })}
                    </div>
                  </div>
                  <p className='rounded-lg bg-white/15 px-3 py-2 text-xs leading-relaxed text-emerald-50'>
                    {t(
                      'Rebates enter a freeze pool first, then settle automatically and become transferable.'
                    )}
                  </p>
                </div>
              </div>
              {inviteeBonus > 0 || inviterBonus > 0 ? (
                <div className='mt-4 rounded-lg border border-emerald-200/70 bg-white/70 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-100'>
                  <span className='font-semibold'>
                    {t('Registration bonus')}:{' '}
                  </span>
                  {inviteeBonus > 0
                    ? t('Your friend receives {{amount}} on signup.', {
                        amount: formatQuota(inviteeBonus),
                      })
                    : null}{' '}
                  {inviterBonus > 0
                    ? t('You receive {{amount}} per signup.', {
                        amount: formatQuota(inviterBonus),
                      })
                    : null}
                </div>
              ) : null}
            </div>

            {/* Earnings + rules */}
            <div className='grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2'>
              <Card data-card-hover='false' className='gap-4'>
                <CardHeader className='flex flex-row items-center justify-between'>
                  <CardTitle className='text-sm font-semibold'>
                    {t('Earnings')}
                  </CardTitle>
                  <Button
                    onClick={() => setTransferDialogOpen(true)}
                    disabled={
                      !complianceConfirmed || (user?.aff_quota ?? 0) <= 0
                    }
                    size='sm'
                    className='h-8 px-3'
                  >
                    <ArrowRightLeft className='size-3.5' />
                    {t('Transfer to Balance')}
                  </Button>
                </CardHeader>
                <CardContent className='flex flex-col gap-4'>
                  <div className='grid grid-cols-2 gap-px overflow-hidden rounded-lg border sm:grid-cols-4'>
                    {stats.map((item) => (
                      <div
                        key={item.label}
                        className='bg-card px-3 py-3 outline outline-1 outline-border/60'
                      >
                        <div className='flex items-center gap-1.5'>
                          <item.icon className='text-muted-foreground/60 size-3.5 shrink-0' />
                          <div className='text-muted-foreground truncate text-[11px] font-medium tracking-wider uppercase'>
                            {item.label}
                          </div>
                        </div>
                        {userLoading ? (
                          <Skeleton className='mt-2 h-6 w-16' />
                        ) : (
                          <div className='mt-1.5 font-mono text-lg font-bold tracking-tight break-all tabular-nums'>
                            {item.value}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className='flex items-center gap-2'>
                    <div className='text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs font-medium'>
                      <Link2 className='size-3.5' />
                      {t('Referral Link')}
                    </div>
                    {affiliateLoading ? (
                      <Skeleton className='h-9 flex-1 rounded-lg' />
                    ) : (
                      <Input
                        value={affiliateLink}
                        readOnly
                        className='border-muted bg-muted/40 h-9 min-w-0 flex-1 font-mono text-xs'
                      />
                    )}
                    <CopyButton
                      value={affiliateLink}
                      className='size-9 shrink-0'
                      iconClassName='size-4'
                      tooltip={t('Copy referral link')}
                      aria-label={t('Copy referral link')}
                    />
                  </div>
                  {!complianceConfirmed ? (
                    <p className='text-muted-foreground text-xs'>
                      {t(
                        'Referral reward transfer is disabled until the administrator confirms compliance terms.'
                      )}
                    </p>
                  ) : null}
                  <ul className='text-muted-foreground space-y-1.5 rounded-lg border border-dashed px-3 py-2.5 text-xs leading-relaxed'>
                    <li className='flex gap-2'>
                      <CircleCheck className='mt-0.5 size-3 shrink-0 text-emerald-500' />
                      {t(
                        'Every successful payment by an invited friend earns you a rebate automatically.'
                      )}
                    </li>
                    <li className='flex gap-2'>
                      <CircleCheck className='mt-0.5 size-3 shrink-0 text-emerald-500' />
                      {t(
                        'Settled earnings can be transferred to your account balance.'
                      )}
                    </li>
                    <li className='flex gap-2'>
                      <CircleCheck className='mt-0.5 size-3 shrink-0 text-emerald-500' />
                      {t('The more friends you invite, the more you earn.')}
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card data-card-hover='false' className='gap-4'>
                <CardHeader>
                  <CardTitle className='flex items-center gap-1.5 text-sm font-semibold'>
                    <BadgeCheck className='size-4 text-emerald-600 dark:text-emerald-400' />
                    {t('Invite Rules')}
                  </CardTitle>
                </CardHeader>
                <CardContent className='flex flex-col gap-4'>
                  <div className='space-y-3.5'>
                    {rules.map((rule) => (
                      <div key={rule.title} className='flex gap-2.5'>
                        <div className='bg-muted mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md'>
                          <rule.icon className='text-muted-foreground size-3.5' />
                        </div>
                        <div className='min-w-0'>
                          <div className='text-sm font-medium'>
                            {rule.title}
                          </div>
                          <p className='text-muted-foreground mt-0.5 text-xs leading-relaxed'>
                            {rule.body}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className='grid grid-cols-3 gap-2'>
                    {ruleParams.map((param) => (
                      <div
                        key={param.label}
                        className='rounded-lg border px-3 py-2'
                      >
                        <div className='text-muted-foreground truncate text-[11px]'>
                          {param.label}
                        </div>
                        <div className='mt-0.5 text-sm font-semibold'>
                          {param.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Invited users detail */}
            <Card data-card-hover='false'>
              <CardHeader>
                <CardTitle className='flex items-center gap-1.5 text-sm font-semibold'>
                  <Users className='text-muted-foreground size-4' />
                  {t('Invited Users')}
                  {invitedUsers.length > 0 ? ` (${invitedUsers.length})` : ''}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <InvitedUsersTable
                  invitedUsers={invitedUsers}
                  nowSec={nowSec}
                />
              </CardContent>
            </Card>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <TransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        onConfirm={handleTransfer}
        availableQuota={user?.aff_quota ?? 0}
        transferring={transferring}
      />
    </>
  )
}
