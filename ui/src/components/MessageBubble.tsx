"use client";

import { motion } from "framer-motion";
import { User, Bot } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface Message {
    role: "user" | "ai";
    content: string;
}

export default function MessageBubble({ message }: { message: Message }) {
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
                    "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                    isAI ? "bg-indigo-500/20 text-indigo-400 mr-3" : "bg-pink-500/20 text-pink-400 ml-3"
                )}>
                    {isAI ? <Bot size={18} /> : <User size={18} />}
                </div>

                <div className={cn(
                    "px-4 py-3 shadow-lg",
                    isAI ? "chat-bubble-ai" : "chat-bubble-user"
                )}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {message.content}
                    </p>
                </div>
            </div>
        </motion.div>
    );
}
