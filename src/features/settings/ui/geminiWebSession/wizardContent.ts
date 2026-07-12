import { useMemo } from 'react'

export function useRiskItems(t: (key: string) => string) {
  return useMemo(
    () => [
      t('gws_risk_unofficial'),
      t('gws_risk_challenge'),
      t('gws_risk_expiry'),
      t('gws_risk_profile_access'),
      t('gws_risk_behavior_changes'),
      t('gws_risk_multi_device')
    ],
    [t]
  )
}

export function useMitigationItems(t: (key: string) => string) {
  return useMemo(
    () => [
      t('gws_mitigation_dedicated_profile'),
      t('gws_mitigation_stable_network'),
      t('gws_mitigation_manual_reauth'),
      t('gws_mitigation_no_shared_machine')
    ],
    [t]
  )
}
