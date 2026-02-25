import React from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Monitor, DownloadCloud } from 'lucide-react'

const BrowserFallback: React.FC = () => {
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-zinc-950 p-6 z-[9999] overflow-hidden">
            {/* Aesthetic Background Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="relative z-10 max-w-lg w-full bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl flex flex-col items-center text-center overflow-hidden"
            >
                {/* Accent Glow inside the card */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50" />

                {/* Icon Container */}
                <motion.div
                    initial={{ rotate: -10 }}
                    animate={{ rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 10, delay: 0.2 }}
                    className="relative mb-6"
                >
                    <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
                    <div className="relative w-24 h-24 flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/5 rounded-2xl shadow-inner">
                        <Monitor className="w-12 h-12 text-blue-400 opacity-90" />
                        <AlertTriangle className="absolute -bottom-2 -right-2 w-10 h-10 text-amber-400 bg-zinc-900 rounded-lg p-1.5 border border-white/10" />
                    </div>
                </motion.div>

                {/* Typography */}
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-4">
                    Masaüstü Ortamı Gerekli
                </h1>

                <p className="text-zinc-400 leading-relaxed mb-8">
                    Bu uygulama, dosya sistemi ve yerel işlemlere erişim sağlayabilmek için <strong className="text-zinc-200">sadece Electron veya masaüstü ortamında</strong> bütünleşik olarak çalışacak şekilde tasarlanmıştır. Tarayıcı önizlemesi (Web) desteklenmemektedir.
                </p>

                {/* Call To Action Buttons (Mock/Informational) */}
                <div className="w-full flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={() => window.location.href = "https://github.com/ozymandias-get/quizlab"}
                        className="flex-1 flex items-center justify-center gap-2 bg-white text-zinc-950 px-5 py-3 rounded-xl font-medium hover:bg-zinc-200 active:bg-zinc-300 transition-colors"
                    >
                        <DownloadCloud className="w-4 h-4" />
                        İndir & Kur
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        className="flex-1 flex items-center justify-center gap-2 bg-white/5 text-white px-5 py-3 rounded-xl font-medium border border-white/10 hover:bg-white/10 transition-colors"
                    >
                        Yeniden Dene
                    </button>
                </div>
            </motion.div>
        </div>
    )
}

export default BrowserFallback
