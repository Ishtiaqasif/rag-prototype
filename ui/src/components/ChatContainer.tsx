"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import MessageBubble from "./MessageBubble";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { getOrCreateSessionId } from "@/lib/sessionUtils";

import { Theme } from "./SettingsModal";

interface Message {
    role: "user" | "ai";
    content: string;
}

interface ChatContainerProps {
    theme: Theme;
}

export default function ChatContainer({ theme }: ChatContainerProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "ai",
            content: "Hello! I'm your AI Recruiter Assistant. How can I help you find the perfect candidate today?",
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput("");
        setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
        setIsLoading(true);

        try {
            const sessionId = getOrCreateSessionId();
            const response = await axios.post("/api/chat", { message: userMessage }, {
                headers: { "x-session-id": sessionId }
            });
            const aiResponse = response.data.response;
            setMessages((prev) => [...prev, { role: "ai", content: aiResponse }]);
        } catch (error) {
            console.error("Error sending message:", error);
            setMessages((prev) => [
                ...prev,
                { role: "ai", content: "Sorry, I encountered an error processing your request. Please try again." },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`flex flex-col flex-1 min-h-0 w-full max-w-4xl mx-auto overflow-hidden transition-all duration-500 border rounded-[2rem] ${theme === 'light'
            ? 'bg-white/80 border-slate-200 shadow-xl shadow-slate-200/50 backdrop-blur-xl'
            : theme === 'premium'
                ? 'bg-black/60 border-emerald-500/20 shadow-2xl shadow-emerald-500/10 backdrop-blur-2xl'
                : 'glass-card border-white/5 shadow-2xl backdrop-blur-xl'
            }`}>
            {/* Header */}
            <div className={`p-6 border-b flex items-center justify-between transition-colors duration-500 ${theme === 'light' ? 'bg-slate-50/50 border-slate-100' : 'bg-white/5 border-white/5'
                }`}>
                <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-all duration-500 ${theme === 'light' ? 'bg-blue-600 shadow-blue-500/20' : theme === 'premium' ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-indigo-500 shadow-indigo-500/20'
                        }`}>
                        <Sparkles className="text-white" size={20} />
                    </div>
                    <div>
                        <h2 className="font-semibold text-lg">AI Recruiter Assistant</h2>
                        <div className="flex items-center text-xs text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                            Pulse Active
                        </div>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <AnimatePresence initial={false}>
                    {messages.map((msg, i) => (
                        <MessageBubble key={i} message={msg} theme={theme} />
                    ))}
                </AnimatePresence>

                {isLoading && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start mb-6"
                    >
                        <div className="chat-bubble-ai px-4 py-3 flex items-center space-x-2">
                            <Loader2 className="animate-spin text-indigo-400" size={18} />
                            <span className="text-sm text-indigo-400 font-medium">Analyzing candidate data...</span>
                        </div>
                    </motion.div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className={`p-6 transition-colors duration-500 ${theme === 'light' ? 'bg-slate-50/50' : 'bg-white/2'}`}>
                <div className="relative flex items-center">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                        placeholder="Ask about candidates, skills, or experience..."
                        className={`w-full border rounded-2xl px-6 py-4 pr-16 focus:outline-none focus:ring-4 transition-all text-sm ${theme === 'light'
                            ? 'bg-white border-slate-200 text-slate-900 focus:ring-blue-500/10 focus:border-blue-500/50 placeholder:text-slate-400'
                            : theme === 'premium'
                                ? 'bg-white/5 border-white/10 text-white focus:ring-emerald-500/20 focus:border-emerald-500/50 placeholder:text-gray-500'
                                : 'bg-white/5 border-white/10 text-white focus:ring-indigo-500/50 focus:border-indigo-500/50 placeholder:text-gray-500'
                            }`}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className={`absolute right-2 p-3 rounded-xl text-white transition-all shadow-lg disabled:opacity-50 ${theme === 'light'
                            ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                            : theme === 'premium'
                                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20 text-black font-bold'
                                : 'bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/20'
                            }`}
                    >
                        <Send size={20} />
                    </button>
                </div>
                <p className={`text-[10px] text-center mt-3 uppercase tracking-widest font-medium ${theme === 'light' ? 'text-slate-400' : 'text-gray-500'}`}>
                    Powered by RAG-Prototype v1.0
                </p>
            </div>
        </div>
    );
}
