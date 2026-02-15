import React, { useEffect, useRef, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

export interface MenuItem {
    label: string;
    icon?: LucideIcon;
    onClick: () => void;
    shortcut?: string;
    danger?: boolean;
    separator?: boolean;
}

interface ContextMenuProps {
    x: number;
    y: number;
    items: MenuItem[];
    onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
    // We attach the ref to the inner div for bounding box calculation, 
    // or the outer one. Let's use outer for positioning.
    const menuRef = useRef<HTMLDivElement>(null);
    const [adjustedPosition, setAdjustedPosition] = useState({ x, y });

    // Handle Closing
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleScroll = () => onClose();
        const handleResize = () => onClose();

        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleResize);

        // Block default context menu on the menu itself
        const preventDefault = (e: Event) => e.preventDefault();
        menuRef.current?.addEventListener('contextmenu', preventDefault);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleResize);
            menuRef.current?.removeEventListener('contextmenu', preventDefault);
        };
    }, [onClose]);

    // Keep menu within viewport
    useLayoutEffect(() => {
        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            let newX = x;
            let newY = y;

            if (x + rect.width > window.innerWidth) {
                newX = window.innerWidth - rect.width - 10;
            }
            if (y + rect.height > window.innerHeight) {
                newY = window.innerHeight - rect.height - 10;
            }

            setAdjustedPosition({ x: newX, y: newY });
        }
    }, [x, y]);

    return createPortal(
        <AnimatePresence>
            <motion.div
                ref={menuRef}
                initial={{ opacity: 0, scale: 0.95, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -5 }}
                transition={{ duration: 0.1, ease: "easeOut" }}
                className="fixed z-[9999] origin-top-left"
                style={{ top: adjustedPosition.y, left: adjustedPosition.x }}
            >
                {/* 
                  Visual styling wrapper separated from motion.div
                  This prevents framer-motion from trying to animate backdrop-blur or other filters
                  which can cause "Invalid keyframe value for property filter: blur(-0.01679px)" errors
                */}
                <div className="min-w-[220px] bg-[#1a1a1a]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/80 p-1.5 overflow-hidden ring-1 ring-white/5">
                    {items.map((item, index) => {
                        if (item.separator) {
                            return <div key={index} className="h-[1px] bg-white/10 my-1 mx-2" />;
                        }

                        const Icon = item.icon;

                        return (
                            <button
                                key={index}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    item.onClick();
                                    onClose();
                                }}
                                className={`
                                    w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-200 group relative overflow-hidden
                                    ${item.danger
                                        ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
                                        : 'text-stone-300 hover:bg-white/10 hover:text-white hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]'
                                    }
                                `}
                            >
                                <div className="flex items-center gap-3 relative z-10">
                                    {Icon && (
                                        <Icon
                                            size={15}
                                            strokeWidth={2}
                                            className={`transition-colors duration-200 ${item.danger
                                                ? 'text-red-400'
                                                : 'text-stone-500 group-hover:text-cyan-400'
                                                }`}
                                        />
                                    )}
                                    <span className="font-medium tracking-wide">{item.label}</span>
                                </div>
                                {item.shortcut && (
                                    <span className={`text-[10px] uppercase tracking-wider font-semibold opacity-50 relative z-10 ${item.danger ? 'text-red-400' : 'text-stone-500 group-hover:text-stone-400'
                                        }`}>
                                        {item.shortcut}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
};
