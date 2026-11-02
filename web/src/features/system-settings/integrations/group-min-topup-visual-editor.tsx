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
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { StaticDataTable } from '@/components/data-table/static/static-data-table'
import { StaticRowActions } from '@/components/data-table/static/static-row-actions'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'

import { safeJsonParseWithValidation } from '../utils/json-parser'
import { isObjectRecord } from '../utils/json-validators'
import {
  GroupMinTopupDialog,
  type GroupMinTopupData,
} from './group-min-topup-dialog'

type GroupMinTopupVisualEditorProps = {
  value: string
  onChange: (value: string) => void
}

export function GroupMinTopupVisualEditor({
  value,
  onChange,
}: GroupMinTopupVisualEditorProps) {
  const { t } = useTranslation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editData, setEditData] = useState<GroupMinTopupData | null>(null)

  const rows = useMemo(() => {
    const parsed = safeJsonParseWithValidation<Record<string, unknown>>(value, {
      fallback: {},
      validator: isObjectRecord,
      validatorMessage: 'Group minimum top-up must be a JSON object',
      context: 'group minimum top-up',
    })

    return Object.entries(parsed)
      .map(([group, min]) => ({
        group,
        minAmount:
          typeof min === 'number' ? min : Number.parseInt(String(min), 10),
      }))
      .filter((item) => item.group !== '' && !Number.isNaN(item.minAmount))
      .sort((a, b) => a.group.localeCompare(b.group))
  }, [value])

  const handleSave = (data: GroupMinTopupData) => {
    const obj = safeJsonParseWithValidation<Record<string, unknown>>(value, {
      fallback: {},
      validator: isObjectRecord,
      silent: true,
    })

    if (editData && editData.group !== data.group) {
      delete obj[editData.group]
    }

    obj[data.group] = data.minAmount

    onChange(JSON.stringify(obj, null, 2))
  }

  const handleDelete = (group: string) => {
    const obj = safeJsonParseWithValidation<Record<string, unknown>>(value, {
      fallback: {},
      validator: isObjectRecord,
      silent: true,
    })

    delete obj[group]

    onChange(JSON.stringify(obj, null, 2))
  }

  const handleEdit = (row: GroupMinTopupData) => {
    setEditData(row)
    setDialogOpen(true)
  }

  const handleAdd = () => {
    setEditData(null)
    setDialogOpen(true)
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Set per-group minimum recharge amounts. Unconfigured groups use the global minimum.'
          )}
        </p>
        <Button
          type='button'
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleAdd()
          }}
          size='sm'
          className='w-full sm:w-auto'
        >
          <Plus className='h-4 w-4 sm:mr-2' />
          <span className='sm:inline'>{t('Add group minimum')}</span>
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className='text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm'>
          {t(
            'No group minimums configured. All groups use the global minimum top-up.'
          )}
        </div>
      ) : (
        <div className='rounded-md border'>
          {/* Desktop table view */}
          <StaticDataTable
            className='hidden rounded-none border-0 sm:block'
            data={rows}
            getRowKey={(row) => row.group}
            columns={[
              {
                id: 'group',
                header: t('User Group'),
                cell: (row) => (
                  <StatusBadge
                    variant='info'
                    className='font-mono'
                    copyable={false}
                  >
                    {row.group}
                  </StatusBadge>
                ),
              },
              {
                id: 'min-amount',
                header: t('Minimum Top-up Amount'),
                cell: (row) => (
                  <code className='bg-muted rounded px-1.5 py-0.5 text-sm'>
                    {row.minAmount}
                  </code>
                ),
              },
              {
                id: 'actions',
                header: t('Actions'),
                className: 'text-right',
                cellClassName: 'text-right',
                cell: (row) => (
                  <StaticRowActions
                    editLabel={t('Edit')}
                    deleteLabel={t('Delete')}
                    menuLabel={t('Open menu')}
                    onEdit={() => handleEdit(row)}
                    onDelete={() => handleDelete(row.group)}
                  />
                ),
              },
            ]}
          />

          {/* Mobile card view */}
          <div className='divide-y sm:hidden'>
            {rows.map((row) => (
              <div key={row.group} className='p-4'>
                <div className='mb-3 flex items-start justify-between'>
                  <div className='flex-1'>
                    <StatusBadge
                      variant='info'
                      className='mb-2 font-mono'
                      copyable={false}
                    >
                      {row.group}
                    </StatusBadge>
                  </div>
                  <div className='flex gap-1'>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleEdit(row)
                      }}
                    >
                      <Pencil className='h-4 w-4' />
                    </Button>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleDelete(row.group)
                      }}
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
                <div className='text-sm'>
                  <span className='text-muted-foreground'>
                    {t('Minimum Top-up Amount')}:{' '}
                  </span>
                  <code className='bg-muted rounded px-1.5 py-0.5 text-xs'>
                    {row.minAmount}
                  </code>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <GroupMinTopupDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        editData={editData}
      />
    </div>
  )
}
