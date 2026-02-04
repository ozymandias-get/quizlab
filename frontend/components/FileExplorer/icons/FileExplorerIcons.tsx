import React from 'react'

interface IconProps {
    className?: string;
    isOpen?: boolean;
}

/**
 * FileExplorer bileşenleri için modern SVG ikonları
 */

export const FolderIcon: React.FC<IconProps> = ({ isOpen, className = '' }) => (
    <div className={`relative ${className}`}>
        <svg
            className={`w-5 h-5 transition-all duration-300 ${isOpen ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'text-amber-500/90'}`}
            fill="currentColor"
            viewBox="0 0 24 24"
        >
            {isOpen ? (
                <path d="M2 6a2 2 0 012-2h5l2 2h9a2 2 0 012 2v2H2V6zm0 4h20v8a2 2 0 01-2 2H4a2 2 0 01-2-2v-8z" />
            ) : (
                <path d="M4 4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-7.586a1 1 0 01-.707-.293L10.293 4.293A1 1 0 009.586 4H4z" />
            )}
        </svg>
        {isOpen && (
            <div className="absolute inset-0 bg-amber-400/20 blur-md rounded-full animate-pulse" />
        )}
    </div>
)

export const PdfIcon: React.FC<IconProps> = ({ className = '' }) => (
    <div className={`relative group/pdf ${className}`}>
        <svg
            className="w-5 h-5 text-rose-400 transition-all duration-200 group-hover/pdf:text-rose-300 group-hover/pdf:drop-shadow-[0_0_6px_rgba(251,113,133,0.5)]"
            viewBox="0 0 24 24"
            fill="currentColor"
        >
            <path d="M7 2a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V8l-6-6H7zm7 1.5L18.5 9H14V3.5zM9 13h1.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5H10v1.5H9V13zm1 2h.5c.28 0 .5-.22.5-.5s-.22-.5-.5-.5H10v1zm3-2h1.8c.99 0 1.7.71 1.7 1.7v1.1c0 .99-.71 1.7-1.7 1.7h-.3v1H14V13h1.8zm1 3.5h.3c.39 0 .7-.31.7-.7v-1.1c0-.39-.31-.7-.7-.7H15v2.5z" />
        </svg>
    </div>
)

export const ChevronIcon: React.FC<{ isOpen: boolean }> = ({ isOpen }) => (
    <svg
        className={`w-3.5 h-3.5 text-stone-500 transition-all duration-300 ease-out ${isOpen ? 'rotate-90 text-amber-400' : ''}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        viewBox="0 0 24 24"
    >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
)

export const FolderPlusIcon: React.FC = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
)

export const DocumentPlusIcon: React.FC = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
)

export const TrashIcon: React.FC = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12.56 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
)

export const SparklesIcon: React.FC = () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
)

export const UploadCloudIcon: React.FC = () => (
    <svg className="w-10 h-10 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
)

export const CheckIcon: React.FC = () => (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
    </svg>
)

export const DownloadIcon: React.FC = () => (
    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
)

export const DeleteModalIcon: React.FC = () => (
    <svg className="w-6 h-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
)
