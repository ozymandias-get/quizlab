import {
  useDoclingGpuDetect,
  useDoclingGpuInstallCuda,
  useDoclingGpuPrefs,
  useDoclingGpuSetEnabled
} from '@platform/electron/api/useDoclingGpuApi'

import { Button } from '@app/components/ui/button'
import { SurfaceCard } from '@shared/ui/components/primitives'

import { Cpu, Download, Zap } from 'lucide-react'
import { memo } from 'react'

import SettingsToggleSwitch from '../shared/SettingsToggleSwitch'

interface Props {
  isInstalled: boolean
}

const DoclingGpuCard = memo(function DoclingGpuCard({ isInstalled }: Props) {
  const { data: gpuPrefs } = useDoclingGpuPrefs()
  const {
    data: gpuDetect,
    isLoading: gpuDetectLoading,
    refetch: refetchGpuDetect
  } = useDoclingGpuDetect(!!isInstalled)
  const gpuToggle = useDoclingGpuSetEnabled()
  const gpuCuda = useDoclingGpuInstallCuda()
  const gpuEnabled = !!gpuPrefs?.enabled
  const gpuAvailable = !!gpuDetect?.available
  const gpuDeviceLabel = gpuDetect?.device ?? gpuPrefs?.lastDetected ?? 'cpu'
  const isCudaDriverFoundButTorchCpu =
    !!gpuDetect?.detail?.includes('torch CUDA') || (!gpuAvailable && gpuDeviceLabel === 'cuda')
  const showCudaDownload = gpuEnabled && isInstalled && !gpuAvailable
  const hideGenericGpuWarning = isCudaDriverFoundButTorchCpu

  return (
    <SurfaceCard className="space-y-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 text-primary rounded-md p-1.5">
            {gpuEnabled ? <Zap className="h-4 w-4" /> : <Cpu className="h-4 w-4" />}
          </div>
          <div>
            <h3 className="text-ql-13 font-semibold">GPU Hızlandırma (Deneysel)</h3>
            <p className="text-ql-11 text-muted-foreground">
              Akıllı okuma dönüşümünü GPU ile hızlandırır. Kapatılırsa CPU kullanılır.
            </p>
          </div>
        </div>
        <SettingsToggleSwitch
          checked={gpuEnabled}
          onChange={(val) => gpuToggle.mutate(val)}
          disabled={gpuToggle.isPending}
        />
      </div>
      <div className="text-ql-12 text-muted-foreground space-y-1">
        <div className="flex items-center gap-1.5">
          <span>Algılanan cihaz:</span>
          <span className="text-foreground font-mono font-medium">
            {gpuDetectLoading ? 'taranıyor…' : gpuDeviceLabel}
          </span>
          {gpuAvailable ? (
            <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
              kullanılabilir
            </span>
          ) : isCudaDriverFoundButTorchCpu ? (
            <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-700 dark:text-amber-300">
              CUDA kurulumu gerekli
            </span>
          ) : (
            <span className="rounded-full bg-zinc-500/15 px-1.5 py-0.5 text-[11px]">
              {isInstalled ? 'CPU kullanılacak' : 'Docling kurulu değil'}
            </span>
          )}
        </div>
        {gpuDetect?.detail && (
          <p className="text-ql-11 break-words opacity-80">{gpuDetect.detail}</p>
        )}
        {gpuEnabled && !gpuAvailable && !hideGenericGpuWarning && (
          <p className="text-amber-600 dark:text-amber-300">
            GPU açık ama cihaz bulunamadı — işlem otomatik CPU’ya düşecek. NVIDIA driver / CUDA veya
            Apple MPS gereklidir.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => refetchGpuDetect()}
            className="text-ql-11 text-primary hover:underline"
          >
            Yeniden tara
          </button>
          {showCudaDownload && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => gpuCuda.mutate()}
              disabled={gpuCuda.isPending}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span>
                {gpuCuda.isPending ? 'CUDA indiriliyor…' : 'CUDA Paketlerini İndir (~2 GB)'}
              </span>
            </Button>
          )}
        </div>
        {gpuCuda.isSuccess && gpuCuda.data?.detail && (
          <p className="text-ql-11 text-emerald-600 dark:text-emerald-300">{gpuCuda.data.detail}</p>
        )}
        {gpuCuda.isError && (
          <p className="text-ql-11 text-destructive break-words">
            {(gpuCuda.error as Error)?.message ?? 'CUDA indirilemedi'}
          </p>
        )}
      </div>
    </SurfaceCard>
  )
})

export default DoclingGpuCard
