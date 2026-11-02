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
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

const createGroupMinTopupDialogSchema = (t: (key: string) => string) =>
  z.object({
    group: z.string().trim().min(1, t('Group name is required')),
    minAmount: z
      .number()
      .positive(t('Minimum amount must be greater than 0'))
      .int(t('Minimum amount must be a whole number')),
  })

type GroupMinTopupDialogFormValues = z.infer<
  ReturnType<typeof createGroupMinTopupDialogSchema>
>

const GROUP_MIN_TOPUP_FORM_ID = 'group-min-topup-form'

export type GroupMinTopupData = {
  group: string
  minAmount: number
}

type GroupMinTopupDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: GroupMinTopupData) => void
  editData?: GroupMinTopupData | null
}

export function GroupMinTopupDialog({
  open,
  onOpenChange,
  onSave,
  editData,
}: GroupMinTopupDialogProps) {
  const { t } = useTranslation()
  const isEditMode = !!editData
  const groupMinTopupDialogSchema = createGroupMinTopupDialogSchema(t)

  const form = useForm<GroupMinTopupDialogFormValues>({
    resolver: zodResolver(groupMinTopupDialogSchema),
    defaultValues: {
      group: '',
      minAmount: 0,
    },
  })

  useEffect(() => {
    if (editData) {
      form.reset(editData)
    } else {
      form.reset({
        group: '',
        minAmount: 0,
      })
    }
  }, [editData, form, open])

  const handleSubmit = (values: GroupMinTopupDialogFormValues) => {
    onSave({
      group: values.group.trim(),
      minAmount: values.minAmount,
    })
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        isEditMode
          ? t('Edit group minimum top-up')
          : t('Add group minimum top-up')
      }
      description={t(
        'Set a minimum recharge amount for a specific user group. Groups without a configured value fall back to the global minimum.'
      )}
      contentClassName='sm:max-w-[500px]'
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button type='submit' form={GROUP_MIN_TOPUP_FORM_ID}>
            {isEditMode ? t('Update') : t('Add')}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id={GROUP_MIN_TOPUP_FORM_ID}
          onSubmit={form.handleSubmit(handleSubmit)}
          className='space-y-4'
        >
          <FormField
            control={form.control}
            name='group'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('User Group')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('e.g., vip')}
                    {...field}
                    disabled={isEditMode}
                  />
                </FormControl>
                <FormDescription>
                  {isEditMode
                    ? t('Group cannot be changed when editing.')
                    : t(
                        'The user group name, including admin-assigned special groups.'
                      )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='minAmount'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Minimum Top-up Amount')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    step='1'
                    min='1'
                    placeholder={t('e.g., 100')}
                    {...field}
                    onChange={(e) =>
                      field.onChange(Number.parseInt(e.target.value) || 0)
                    }
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Minimum recharge amount required for users in this group.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </Dialog>
  )
}
