import { SITE_SESSION_PROTOCOL_VERSION } from '@shared-core/constants/siteSessionProtocol'
import type { NativeMessagingExtensionProfile } from '@shared-core/types'

import { useNativeMessagingStatusQuery } from '@platform/electron/api/useNativeMessagingApi'
import { useSelectExtensionProfileMutation } from '@platform/electron/api/useSiteSessionApi'

import { useToastActions } from '@shared/stores/toastStore'
import { Button, SettingsSection } from '@shared/ui/components/primitives'
import { SettingsIcon } from '@ui/components/Icons'

import { Check, Laptop } from 'lucide-react'
import { memo, useCallback } from 'react'

interface ExtensionProfileSelectorProps {
  t: (key: string) => string
}

function profileStateKey(profile: NativeMessagingExtensionProfile): string {
  if (!profile.connected) return 'ws_profile_disconnected'
  if (profile.protocolVersion !== null && profile.protocolVersion < SITE_SESSION_PROTOCOL_VERSION) {
    return 'ws_profile_outdated'
  }
  if (!profile.paired) return 'ws_profile_pairing'
  return 'ws_profile_connected'
}

/**
 * One readiness signal instead of a protocol log: green means the profile can
 * be used right now, amber means connected but still pairing (or an outdated
 * extension), grey means no bridge at all.
 */
function profileLampTone(profile: NativeMessagingExtensionProfile): string {
  if (profile.connected && profile.paired) {
    return 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.16),0_0_10px_rgba(16,185,129,0.65)]'
  }
  if (profile.connected) {
    return 'bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.16),0_0_10px_rgba(245,158,11,0.55)]'
  }
  return 'bg-muted-foreground/70'
}

/**
 * The Chrome profiles the extension runs in.
 *
 * Chrome gives every profile a separate extension storage, so a user with two
 * profiles has two independent copies of the same extension. Only one of them
 * may feed the app at a time: this picker is that choice, and the bridge
 * refuses packets from every other profile.
 */
function ExtensionProfileSelector({ t }: ExtensionProfileSelectorProps) {
  const { data } = useNativeMessagingStatusQuery()
  const selectMutation = useSelectExtensionProfileMutation()
  const { showError } = useToastActions()

  const profiles = data?.profiles ?? []
  const selectedProfileId = data?.selectedProfileId ?? null

  const onSelect = useCallback(
    (profileId: string) => {
      void selectMutation
        .mutateAsync({ profileId })
        .then((result) => {
          if (!result.success) {
            showError(result.error ? t(`ws_error_${result.error}`) : t('ws_profile_select_error'))
          }
        })
        .catch(() => {
          // The mutation hook already surfaced the transport error.
        })
    },
    [selectMutation, showError, t]
  )

  if (profiles.length === 0) return null

  return (
    <SettingsSection icon={<SettingsIcon className="h-4 w-4" />} title={t('ws_profile_title')}>
      <div className="flex flex-col gap-3">
        <p className="text-ql-12 text-muted-foreground leading-relaxed">{t('ws_profile_desc')}</p>

        <div className="flex flex-col gap-2" role="list">
          {profiles.map((profile) => {
            const selected = profile.id === selectedProfileId
            return (
              <div
                key={profile.id}
                role="listitem"
                className={`border-border/60 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${
                  selected ? 'bg-primary/5 border-primary/30' : 'bg-background/40'
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className={`size-2.5 shrink-0 rounded-full transition-shadow ${profileLampTone(profile)}`}
                  />
                  <Laptop className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-ql-13 text-foreground truncate font-semibold">
                        {profile.name}
                      </span>
                      {selected && (
                        <span className="bg-primary/10 text-primary border-primary/20 text-ql-10 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold">
                          <Check className="h-3 w-3" />
                          {t('ws_profile_selected')}
                        </span>
                      )}
                    </div>
                    <span className="text-ql-11 text-muted-foreground">
                      {t(profileStateKey(profile))}
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant={selected ? 'outline' : 'default'}
                  size="xs"
                  onClick={() => onSelect(profile.id)}
                  disabled={selected || selectMutation.isPending}
                  className="shrink-0"
                >
                  <span className="text-ql-11 font-semibold">
                    {selected ? t('ws_profile_selected') : t('ws_profile_select_btn')}
                  </span>
                </Button>
              </div>
            )
          })}
        </div>

        <p className="text-ql-11 text-muted-foreground leading-relaxed">{t('ws_profile_hint')}</p>
      </div>
    </SettingsSection>
  )
}

export default memo(ExtensionProfileSelector)
