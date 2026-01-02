"use client";

import { motion } from "framer-motion";
import { User, Bot } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

import { Theme } from "./SettingsModal";

interface Message {
    role: "user" | "ai";
    content: string;
}

export default function MessageBubble({ message, theme }: { message: Message, theme: Theme }) {
    const isAI = message.role === "ai";

    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={cn(
                "flex w-full mb-6",
                isAI ? "justify-start" : "justify-end"
            )}
        >
            <div className={cn(
                "flex max-w-[85%] sm:max-w-[75%]",
                isAI ? "flex-row" : "flex-row-reverse"
            )}>
                <div className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-500",
                    isAI
                        ? (theme === 'light' ? "bg-blue-100 text-blue-600 mr-3" : theme === 'premium' ? "bg-emerald-500/20 text-emerald-400 mr-3" : "bg-indigo-500/20 text-indigo-400 mr-3")
                        : (theme === 'light' ? "bg-indigo-100 text-indigo-600 ml-3" : "bg-pink-500/20 text-pink-400 ml-3")
                )}>
                    {isAI ? <Bot size={18} /> : <User size={18} />}
                </div>

                <div className={cn(
                    "px-4 py-3 shadow-lg transition-all duration-500",
                    isAI
                        ? (theme === 'light' ? "bg-white border border-slate-100 text-slate-800 rounded-2xl rounded-tl-none" : "chat-bubble-ai")
                        : (theme === 'light' ? "bg-blue-600 text-white rounded-2xl rounded-tr-none" : "chat-bubble-user")
                )}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {message.content}
                    </p>
                </div>
            </div>
        </motion.div>
    );
}
