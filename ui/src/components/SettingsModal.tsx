"use client";

import { X, Palette, Check, Sun, Moon, Crown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type Theme = "dark" | "light" | "premium";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentTheme: Theme;
    onThemeChange: (theme: Theme) => void;
}

const themes: { id: Theme; label: string; icon: any; color: string; desc: string }[] = [
    {
        id: "dark",
        label: "Midnight Indigo",
        icon: Moon,
        color: "bg-indigo-500",
        desc: "The classic high-performance dark mode."
    },
    {
        id: "light",
        label: "Pure Astral",
        icon: Sun,
        color: "bg-blue-400",
        desc: "A clean, vibrant light theme for high visibility."
    },
    {
        id: "premium",
        label: "Royal Emerald",
        icon: Crown,
        color: "bg-emerald-500",
        desc: "A luxurious gold and emerald dark aesthetic."
    },
];

export default function SettingsModal({ isOpen, onClose, currentTheme, onThemeChange }: SettingsModalProps) {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="w-full max-w-md glass-card overflow-hidden shadow-2xl border border-white/10"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                <Palette className="text-purple-400" size={20} />
                            </div>
                            <h2 className="font-semibold text-xl">Settings</h2>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Appearance</h3>
                            <div className="space-y-3">
                                {themes.map((theme) => (
                                    <button
                                        key={theme.id}
                                        onClick={() => onThemeChange(theme.id)}
                                        className={`w-full p-4 rounded-2xl border transition-all flex items-center justify-between group ${currentTheme === theme.id
                                                ? "bg-white/10 border-white/20 ring-2 ring-purple-500/50"
                                                : "bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/8"
                                            }`}
                                    >
                                        <div className="flex items-center space-x-4">
                                            <div className={`w-12 h-12 rounded-xl ${theme.color} flex items-center justify-center shadow-lg`}>
                                                <theme.icon className="text-white" size={24} />
                                            </div>
                                            <div className="text-left">
                                                <p className="font-semibold text-gray-200">{theme.label}</p>
                                                <p className="text-xs text-gray-500">{theme.desc}</p>
                                            </div>
                                        </div>
                                        {currentTheme === theme.id && (
                                            <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                                                <Check className="text-white" size={14} />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-white/5 bg-white/2">
                        <p className="text-[10px] text-center text-gray-500 uppercase tracking-widest">
                            Application Configuration v1.2
                        </p>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
