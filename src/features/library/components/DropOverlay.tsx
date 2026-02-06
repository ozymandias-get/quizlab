import React from 'react'
import { DownloadIcon } from './icons/FileExplorerIcons'

interface DropOverlayProps {
    isVisible: boolean;
}

/**
 * Harici dosya sürüklenirken gösterilen overlay bileşeni
 */
const DropOverlay: React.FC<DropOverlayProps> = ({ isVisible }) => {
    if (!isVisible) return null

    return (
        <div className="absolute inset-x-0 bottom-6 flex justify-center z-50 pointer-events-none">
            <div className="bg-stone-900/95 border border-emerald-500/50 rounded-full px-6 py-3 shadow-2xl shadow-emerald-900/50 flex items-center gap-3 backdrop-blur-md animate-bounce">
                <div className="bg-emerald-500/20 p-1.5 rounded-full">
                    <DownloadIcon />
                </div>
                <div>
                    <p className="text-emerald-400 font-bold text-sm">Dosyaları Bırakın</p>
                    <p className="text-emerald-500/70 text-[10px] font-medium leading-none">Kütüphaneye eklemek için</p>
                </div>
            </div>
        </div>
    )
}

export default DropOverlay
