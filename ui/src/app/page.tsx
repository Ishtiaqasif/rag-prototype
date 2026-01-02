"use client";

import { useState } from "react";
import ChatContainer from "@/components/ChatContainer";
import DataManagementModal from "@/components/DataManagementModal";
import SettingsModal, { Theme } from "@/components/SettingsModal";
import { Database, Settings } from "lucide-react";

export default function Home() {
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");

  const themeConfig = {
    dark: {
      bg: "bg-[#0a0a0b]",
      gradients: ["bg-indigo-500/10", "bg-pink-500/10", "bg-purple-500/10"],
      text: "from-indigo-400 via-purple-400 to-pink-400",
      grid: "opacity-[0.03]"
    },
    light: {
      bg: "bg-slate-50",
      gradients: ["bg-blue-500/5", "bg-cyan-500/5", "bg-sky-500/5"],
      text: "from-blue-600 via-indigo-600 to-cyan-600",
      grid: "opacity-[0.05] grayscale"
    },
    premium: {
      bg: "bg-[#050505]",
      gradients: ["bg-emerald-500/15", "bg-teal-500/15", "bg-amber-500/10"],
      text: "from-emerald-400 via-teal-400 to-yellow-500",
      grid: "opacity-[0.04] sepia"
    }
  };

  const current = themeConfig[theme];

  return (
    <main className={`h-screen relative flex flex-col p-4 md:p-6 overflow-hidden transition-colors duration-500 ${current.bg} ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
      {/* Dynamic Background Elements */}
      <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full animate-float transition-colors duration-1000 ${current.gradients[0]}`} />
      <div className={`absolute bottom-[0%] right-[-5%] w-[35%] h-[35%] blur-[120px] rounded-full animate-float transition-colors duration-1000 ${current.gradients[1]}`} style={{ animationDelay: '2s' }} />
      <div className={`absolute top-[20%] right-[10%] w-[25%] h-[25%] blur-[100px] rounded-full animate-float transition-colors duration-1000 ${current.gradients[2]}`} style={{ animationDelay: '4s' }} />

      {/* Grid Pattern */}
      <div className={`absolute inset-0 -z-5 pointer-events-none transition-opacity duration-1000 ${current.grid}`}
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, gray 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      {/* Top Action Buttons */}
      <div className="absolute top-6 right-6 z-20 flex items-center space-x-3">
        <button
          onClick={() => setIsSettingsModalOpen(true)}
          className={`p-3 rounded-2xl transition-all border flex items-center space-x-2 group ${theme === 'light' ? 'bg-white/80 border-slate-200 text-slate-600 hover:bg-white' : 'glass-card border-white/5 text-gray-400 hover:bg-white/10'
            }`}
        >
          <Settings className="group-hover:rotate-90 transition-transform" size={20} />
          <span className="text-xs font-semibold uppercase tracking-tighter hidden sm:inline">Settings</span>
        </button>
        <button
          onClick={() => setIsDataModalOpen(true)}
          className={`p-3 rounded-2xl transition-all border flex items-center space-x-2 group ${theme === 'light' ? 'bg-white/80 border-slate-200 text-slate-600 hover:bg-white' : 'glass-card border-white/5 text-gray-400 hover:bg-white/10'
            }`}
        >
          <Database className={`${theme === 'premium' ? 'text-emerald-400' : 'text-indigo-400'} group-hover:scale-110 transition-transform`} size={20} />
          <span className="text-xs font-semibold uppercase tracking-tighter hidden sm:inline">Management</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col w-full max-w-5xl mx-auto animate-fade-in overflow-hidden">
        <header className="mb-4 text-center shrink-0">
          <h1 className={`text-2xl md:text-4xl font-bold tracking-tight mb-1 bg-clip-text text-transparent bg-gradient-to-r transition-all duration-1000 ${current.text}`}>
            Intelligent Talent Sourcing
          </h1>
          <p className={`${theme === 'light' ? 'text-slate-500' : 'text-gray-400'} text-xs md:text-sm max-w-lg mx-auto font-light`}>
            Chat with our advanced RAG engine to find the highest-performing candidates.
          </p>
        </header>

        <ChatContainer theme={theme} />

        <footer className={`${theme === 'light' ? 'text-slate-400' : 'text-gray-500'} py-4 text-[10px] flex items-center justify-center space-x-4 shrink-0`}>
          <span className="hover:text-indigo-400 cursor-pointer transition-colors">Documentation</span>
          <span className="w-1 h-1 rounded-full bg-gray-700/20" />
          <span className="hover:text-indigo-400 cursor-pointer transition-colors">Privacy Policy</span>
          <span className="w-1 h-1 rounded-full bg-gray-700/20" />
          <span className="hover:text-indigo-400 cursor-pointer transition-colors">v1.2.0-beta</span>
        </footer>
      </div>

      <DataManagementModal
        isOpen={isDataModalOpen}
        onClose={() => setIsDataModalOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        currentTheme={theme}
        onThemeChange={setTheme}
      />
    </main>
  );
}
