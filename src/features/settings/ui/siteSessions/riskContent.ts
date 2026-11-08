import { useMemo } from 'react'

export function useRiskItems(t: (key: string) => string) {
  return useMemo(
    () => [
      t('ws_risk_unofficial'),
      t('ws_risk_challenge'),
      t('ws_risk_expiry'),
      t('ws_risk_profile_access'),
      t('ws_risk_behavior_changes'),
      t('ws_risk_multi_device')
    ],
    [t]
  )
}

export function useMitigationItems(t: (key: string) => string) {
  return useMemo(
    () => [
      t('ws_mitigation_dedicated_profile'),
      t('ws_mitigation_stable_network'),
      t('ws_mitigation_manual_reauth'),
      t('ws_mitigation_no_shared_machine')
    ],
    [t]
  )
}
