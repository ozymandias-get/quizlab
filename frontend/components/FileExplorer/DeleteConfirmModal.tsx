import React from 'react'
import { DeleteModalIcon } from './icons/FileExplorerIcons'
import { useLanguage } from '../../context/LanguageContext'

interface DeleteConfirmModalProps {
    isOpen: boolean;
    type: string; // 'single' | 'all'
    itemName: string;
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * Delete confirmation modal component
 */
const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ isOpen, type, itemName, onConfirm, onCancel }) => {
    const { t } = useLanguage()

    if (!isOpen) return null

    return (
        <div className="absolute inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm transition-opacity duration-300"
                onClick={onCancel}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-sm bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl shadow-black/50 p-6">
                <div className="flex flex-col items-center text-center gap-4">
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mb-1 ring-1 ring-rose-500/20">
                        <DeleteModalIcon />
                    </div>

                    {/* Text */}
                    <div>
                        <h3 className="text-lg font-bold text-stone-200 mb-2">
                            {t('confirm_delete')}
                        </h3>
                        <div className="text-sm text-stone-400 leading-relaxed">
                            <span className="font-semibold text-stone-300">
                                {type === 'all' ? (t('all_library')) : `"${itemName}"`}
                            </span>
                            {type === 'all'
                                ? ` ${t('will_be_cleared')}`
                                : ` ${t('will_be_deleted')}`
                            }
                            <br />
                            {t('undone_action')}
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex items-center gap-3 w-full mt-2">
                        <button
                            onClick={onCancel}
                            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-stone-400 bg-stone-800 hover:bg-stone-750 hover:text-stone-200 transition-colors duration-200"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-rose-100 bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-900/20 transition-all duration-200"
                        >
                            {t('yes_delete')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DeleteConfirmModal
