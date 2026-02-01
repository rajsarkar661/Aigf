import React, { useState, useEffect } from 'react';

interface NezukoAvatarProps {
  imageSrc: string; 
  isSpeaking: boolean;
  isListening: boolean;
}

// =================================================================
// 📸 USER PROVIDED PHOTOS
// =================================================================

const PHOTOS = {
  // PHOTO 1: Talking (Main speaking face)
  TALKING: "https://i.postimg.cc/ZRdTTMHy/file_000000003a5c72098e2b4921e371abad.png",

  // PHOTO 2: Laughing/Smiling (Happy emotion)
  LAUGHING: "https://i.postimg.cc/zvYq3FPz/file_0000000078087206aa2887c6558aaa1f.png",

  // PHOTO 3: Listening (Silent/Attentive)
  LISTENING: "https://i.postimg.cc/PJbTDvBT/file_0000000085ec7209b692f8171df4c19d.png"
};

// =================================================================

export const NezukoAvatar: React.FC<NezukoAvatarProps> = ({ isSpeaking, isListening }) => {
  const [currentPhoto, setCurrentPhoto] = useState(PHOTOS.LISTENING);
  const [isLaughingState, setIsLaughingState] = useState(false);

  // Logic to handle Photo Switching
  useEffect(() => {
    let talkInterval: any;

    if (isSpeaking) {
      // --- TALKING MODE ---
      // Start with Talking
      setCurrentPhoto(PHOTOS.TALKING);
      
      // Cycle between Talking and Laughing faster (every 1.2s) to look more animated
      talkInterval = setInterval(() => {
        setIsLaughingState((prev) => {
           const newState = !prev;
           setCurrentPhoto(newState ? PHOTOS.LAUGHING : PHOTOS.TALKING);
           return newState;
        });
      }, 1200);

    } else {
      // --- LISTENING MODE ---
      // When silent, show the Listening photo (Photo 3)
      setCurrentPhoto(PHOTOS.LISTENING);
      setIsLaughingState(false);
    }

    return () => clearInterval(talkInterval);
  }, [isSpeaking]);

  return (
    <div className="relative w-full max-w-[320px] mx-auto aspect-square flex items-center justify-center my-6 perspective-1000">
      
      {/* 1. Dynamic Aura (Glow) */}
      <div 
        className={`absolute inset-0 rounded-full blur-3xl transition-all duration-300 ${
          isSpeaking 
            ? 'bg-pink-500/60 scale-110 animate-pulse-fast' 
            : isListening 
              ? 'bg-blue-400/20 scale-105' 
              : 'bg-pink-900/10 scale-95'
        }`}
      />
      
      {/* 2. Main Avatar Container */}
      <div 
        className={`
          relative w-full h-full rounded-[40px] overflow-hidden shadow-2xl z-10
          transition-all duration-300 ease-in-out
          border-4 bg-[#1a0b10]
          ${isSpeaking ? 'border-pink-400 scale-105' : 'border-pink-900/30 scale-100'}
        `}
      >
         {/* 
            PHOTO DISPLAY
            Uses key to force re-render for smooth transitions
         */}
         <img 
            key={currentPhoto}
            src={currentPhoto}
            alt="Nezuko"
            className={`
                absolute inset-0 w-full h-full object-cover transition-opacity duration-300
                ${isLaughingState ? 'animate-bounce-subtle' : ''}
                ${isSpeaking && !isLaughingState ? 'animate-talk-shake' : ''}
                ${!isSpeaking ? 'animate-breathe' : ''}
            `}
         />

         {/* Status Text Overlay */}
         <div className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-bold uppercase tracking-widest transition-colors border ${isSpeaking ? 'text-pink-300 border-pink-500/50' : 'text-gray-400 border-white/10'}`}>
            {isSpeaking ? (isLaughingState ? 'Happy!' : 'Speaking...') : 'Listening...'}
         </div>
      </div>

      {/* Cinematic Gloss Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-white/10 pointer-events-none mix-blend-overlay rounded-[40px]" />

      <style>{`
        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        
        @keyframes bounceSubtle {
            0%, 100% { transform: translateY(0) scale(1.05); }
            50% { transform: translateY(-6px) scale(1.05); }
        }

        @keyframes talkShake {
            0%, 100% { transform: rotate(0deg); }
            25% { transform: rotate(1deg); }
            75% { transform: rotate(-1deg); }
        }

        .animate-breathe {
          animation: breathe 4s ease-in-out infinite;
        }
        
        .animate-bounce-subtle {
            animation: bounceSubtle 0.5s ease-in-out infinite;
        }

        .animate-talk-shake {
            animation: talkShake 0.3s ease-in-out infinite;
        }

        .animate-pulse-fast {
          animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .perspective-1000 {
          perspective: 1000px;
        }
      `}</style>
    </div>
  );
};