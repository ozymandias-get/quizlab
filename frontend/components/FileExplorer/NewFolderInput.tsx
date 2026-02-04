import React from 'react'
import { FolderPlusIcon } from './icons/FileExplorerIcons'
import { useLanguage } from '../../context/LanguageContext'

interface NewFolderInputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    onCancel: () => void;
    autoFocus?: boolean;
}

/**
 * New folder creation input component
 */
const NewFolderInput: React.FC<NewFolderInputProps> = ({ value, onChange, onSubmit, onCancel, autoFocus = true }) => {
    const { t } = useLanguage()

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            onSubmit()
        } else if (e.key === 'Escape') {
            onCancel()
        }
    }

    return (
        <div className="px-4 py-3 border-b border-stone-800/50 bg-gradient-to-r from-amber-500/5 to-transparent">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <FolderPlusIcon />
                </div>
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('folder_name_placeholder')}
                    autoFocus={autoFocus}
                    className="flex-1 bg-stone-800/60 border border-stone-700/50 rounded-xl px-4 py-2
                           text-sm text-stone-200 placeholder-stone-500
                           focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50
                           transition-all duration-200"
                />
                <button
                    onClick={onSubmit}
                    disabled={!value.trim()}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 
                           text-white text-sm font-semibold
                           hover:shadow-lg hover:shadow-amber-500/25 hover:scale-105
                           disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none
                           transition-all duration-200"
                >
                    {t('add')}
                </button>
                <button
                    onClick={onCancel}
                    className="p-2 rounded-xl text-stone-400 hover:text-stone-200 hover:bg-stone-700/50
                           transition-colors duration-200"
                >
                    ✕
                </button>
            </div>
        </div>
    )
}

export default NewFolderInput
