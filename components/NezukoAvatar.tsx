import React, { useState, useEffect } from 'react';

interface NezukoAvatarProps {
  imageSrc: string; // We'll ignore this prop now and use internal high-quality assets for animation
  isSpeaking: boolean;
  isListening: boolean;
}

// High-quality assets for state switching
const IDLE_IMAGE = "https://i.pinimg.com/736x/88/2c/3f/882c3f592634e55e8c201460391d3780.jpg"; // Smiling, mouth closed
const TALKING_IMAGE = "https://i.pinimg.com/736x/58/0b/40/580b40b171549447e11d6197b1021422.jpg"; // Happy, mouth open/laughing

export const NezukoAvatar: React.FC<NezukoAvatarProps> = ({ isSpeaking, isListening }) => {
  // Preload images to prevent flickering
  useEffect(() => {
    const img1 = new Image(); img1.src = IDLE_IMAGE;
    const img2 = new Image(); img2.src = TALKING_IMAGE;
  }, []);

  return (
    <div className="relative w-full max-w-[350px] mx-auto aspect-square flex items-center justify-center my-4 perspective-1000">
      
      {/* 1. Aura/Glow Effect */}
      <div 
        className={`absolute inset-0 rounded-full blur-3xl transition-all duration-300 ${
          isSpeaking 
            ? 'bg-pink-500/60 scale-110 animate-pulse-fast' 
            : isListening 
              ? 'bg-blue-400/20 scale-100' 
              : 'bg-pink-900/10 scale-90'
        }`}
      />
      
      {/* 2. Avatar Container with Physics Animations */}
      <div 
        className={`
          relative w-full h-full rounded-3xl overflow-hidden shadow-2xl z-10
          transition-all duration-300 ease-in-out
          border-4
          ${isSpeaking ? 'border-pink-400 animate-talk-physics' : 'animate-breathe-physics'}
          ${isListening && !isSpeaking ? 'scale-110 border-blue-400/30' : 'border-pink-500/20'}
        `}
      >
        {/* IDLE IMAGE (Visible when NOT speaking) */}
        <img 
          src={IDLE_IMAGE} 
          alt="Nezuko Idle" 
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-100 ${
             isSpeaking ? 'opacity-0' : 'opacity-100'
          }`}
        />

        {/* TALKING IMAGE (Visible when SPEAKING) */}
        <img 
          src={TALKING_IMAGE} 
          alt="Nezuko Talking" 
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-100 ${
             isSpeaking ? 'opacity-100 scale-110' : 'opacity-0 scale-100'
          }`}
        />
        
        {/* Cinematic Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-white/5 pointer-events-none mix-blend-overlay" />
      </div>

      <style>{`
        /* Idle: Gentle floating */
        @keyframes breathe {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-5px) scale(1.02); }
        }

        /* Talking: Head shaking, bouncing, and zooming */
        @keyframes talk-shake {
          0% { transform: scale(1.05) rotate(0deg) translateY(0); }
          25% { transform: scale(1.08) rotate(-3deg) translateY(3px); }
          50% { transform: scale(1.05) rotate(0deg) translateY(0); }
          75% { transform: scale(1.08) rotate(3deg) translateY(3px); }
          100% { transform: scale(1.05) rotate(0deg) translateY(0); }
        }

        .animate-breathe-physics {
          animation: breathe 4s ease-in-out infinite;
        }

        .animate-talk-physics {
          animation: talk-shake 0.35s ease-in-out infinite; /* Fast speed for laughing effect */
        }

        .perspective-1000 {
          perspective: 1000px;
        }
      `}</style>
    </div>
  );
};