"use client";

import { useState } from "react";
import ChatContainer from "@/components/ChatContainer";
import DataManagementModal from "@/components/DataManagementModal";
import { Database } from "lucide-react";

export default function Home() {
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);

  return (
    <main className="h-screen relative flex flex-col p-4 md:p-6 overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full -z-10 bg-[#0a0a0b]" />
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full animate-float" />
      <div className="absolute bottom-[0%] right-[-5%] w-[35%] h-[35%] bg-pink-500/10 blur-[120px] rounded-full animate-float" style={{ animationDelay: '2s' }} />
      <div className="absolute top-[20%] right-[10%] w-[25%] h-[25%] bg-purple-500/10 blur-[100px] rounded-full animate-float" style={{ animationDelay: '4s' }} />

      {/* Grid Pattern */}
      <div className="absolute inset-0 -z-5 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      {/* Settings / Data Management Button */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={() => setIsDataModalOpen(true)}
          className="p-3 rounded-2xl glass-card hover:bg-white/10 transition-all border-white/5 flex items-center space-x-2 group"
        >
          <Database className="text-indigo-400 group-hover:scale-110 transition-transform" size={20} />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-tighter hidden sm:inline">Management</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col w-full max-w-5xl mx-auto animate-fade-in overflow-hidden">
        <header className="mb-4 text-center shrink-0">
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight mb-1 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
            Intelligent Talent Sourcing
          </h1>
          <p className="text-gray-400 text-xs md:text-sm max-w-lg mx-auto font-light">
            Chat with our advanced RAG engine to find the highest-performing candidates.
          </p>
        </header>

        <ChatContainer />

        <footer className="py-4 text-gray-500 text-[10px] flex items-center justify-center space-x-4 shrink-0">
          <span className="hover:text-indigo-400 cursor-pointer transition-colors">Documentation</span>
          <span className="w-1 h-1 rounded-full bg-gray-700" />
          <span className="hover:text-indigo-400 cursor-pointer transition-colors">Privacy Policy</span>
          <span className="w-1 h-1 rounded-full bg-gray-700" />
          <span className="hover:text-indigo-400 cursor-pointer transition-colors">v1.2.0-beta</span>
        </footer>
      </div>

      <DataManagementModal
        isOpen={isDataModalOpen}
        onClose={() => setIsDataModalOpen(false)}
      />
    </main>
  );
}
