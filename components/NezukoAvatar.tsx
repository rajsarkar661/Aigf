import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

interface NezukoAvatarProps {
  imageSrc: string; 
  isSpeaking: boolean;
  isListening: boolean;
}

// Image Fallback System
// If one fails, we automatically try the next one
const IDLE_IMAGES = [
  "https://wsrv.nl/?url=https://i.pinimg.com/736x/c0/86/94/c086940a97d9532585994f1ba6393166.jpg&w=500&output=webp",
  "https://wsrv.nl/?url=https://i.pinimg.com/originals/88/2c/3f/882c3f592634e55e8c201460391d3780.jpg&w=500&output=webp",
  "https://image.civitai.com/xG1nkqKTMzGDvpLrqFT7WA/468b8719-5823-4416-928d-905166297316/width=450/468b8719-5823-4416-928d-905166297316.jpeg", // Fallback
];

const TALKING_IMAGES = [
  "https://wsrv.nl/?url=https://i.pinimg.com/736x/88/2c/3f/882c3f592634e55e8c201460391d3780.jpg&w=500&output=webp",
  "https://wsrv.nl/?url=https://i.pinimg.com/736x/c0/86/94/c086940a97d9532585994f1ba6393166.jpg&w=500&output=webp", // Swap for variety
  "https://image.civitai.com/xG1nkqKTMzGDvpLrqFT7WA/468b8719-5823-4416-928d-905166297316/width=450/468b8719-5823-4416-928d-905166297316.jpeg",
];

export const NezukoAvatar: React.FC<NezukoAvatarProps> = ({ isSpeaking, isListening }) => {
  const [imgStatus, setImgStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [currentIdleIndex, setCurrentIdleIndex] = useState(0);
  const [currentTalkingIndex, setCurrentTalkingIndex] = useState(0);

  // Preload images logic
  useEffect(() => {
    loadImages(currentIdleIndex, currentTalkingIndex);
  }, [currentIdleIndex, currentTalkingIndex]);

  const loadImages = (idleIdx: number, talkIdx: number) => {
    setImgStatus('loading');
    
    const img1 = new Image();
    img1.referrerPolicy = "no-referrer";
    img1.src = IDLE_IMAGES[idleIdx];
    img1.onload = () => setImgStatus('loaded');
    img1.onerror = () => handleImageError();

    const img2 = new Image();
    img2.referrerPolicy = "no-referrer";
    img2.src = TALKING_IMAGES[talkIdx];
  };

  const handleImageError = () => {
    // Try next image if available
    if (currentIdleIndex < IDLE_IMAGES.length - 1) {
      console.log("Image failed, trying backup...");
      setCurrentIdleIndex(prev => prev + 1);
      setCurrentTalkingIndex(prev => prev + 1);
    } else {
      setImgStatus('error');
    }
  };

  const manualRetry = () => {
    setCurrentIdleIndex(0);
    setCurrentTalkingIndex(0);
    loadImages(0, 0);
  };

  return (
    <div className="relative w-full max-w-[350px] mx-auto aspect-square flex items-center justify-center my-4 perspective-1000">
      
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
          relative w-full h-full rounded-3xl overflow-hidden shadow-2xl z-10
          transition-all duration-200 ease-in-out
          border-4 bg-gray-900/80
          ${isSpeaking ? 'border-pink-400 animate-talk-physics' : 'animate-breathe-physics'}
          ${isListening && !isSpeaking ? 'scale-105 border-blue-400/40' : 'border-pink-500/20'}
        `}
      >
        {/* Loading / Error State */}
        {imgStatus !== 'loaded' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 z-20 bg-black/50 backdrop-blur-sm">
                {imgStatus === 'loading' ? (
                    <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                    <div className="text-pink-300 flex flex-col items-center">
                        <p className="font-bold mb-2">Nezuko Offline</p>
                        <button 
                          onClick={manualRetry}
                          className="flex items-center gap-2 px-3 py-1 bg-pink-600 rounded-full text-xs hover:bg-pink-500 transition"
                        >
                          <RefreshCw size={12} /> Retry
                        </button>
                    </div>
                )}
            </div>
        )}

        {/* Images */}
        <div className={`absolute inset-0 w-full h-full transition-opacity duration-150 ${imgStatus === 'loaded' ? 'opacity-100' : 'opacity-0'}`}>
             {/* IDLE Image */}
            <img 
              src={IDLE_IMAGES[currentIdleIndex]} 
              alt="Nezuko Idle" 
              referrerPolicy="no-referrer"
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-100 ${
                isSpeaking ? 'opacity-0' : 'opacity-100'
              }`}
            />

            {/* TALKING Image */}
            <img 
              src={TALKING_IMAGES[currentTalkingIndex]} 
              alt="Nezuko Talking" 
              referrerPolicy="no-referrer"
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-100 ${
                isSpeaking ? 'opacity-100 scale-110' : 'opacity-0 scale-100'
              }`}
            />
        </div>
        
        {/* Cinematic Gloss Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-white/10 pointer-events-none mix-blend-overlay" />
        
        {/* Cheek Blush (Appears when talking) */}
        <div className={`absolute top-[45%] left-[25%] w-8 h-8 bg-pink-500/30 blur-xl rounded-full transition-opacity ${isSpeaking ? 'opacity-100' : 'opacity-0'}`} />
        <div className={`absolute top-[45%] right-[25%] w-8 h-8 bg-pink-500/30 blur-xl rounded-full transition-opacity ${isSpeaking ? 'opacity-100' : 'opacity-0'}`} />
      </div>

      <style>{`
        /* Idle: Gentle float */
        @keyframes breathe {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-6px) scale(1.02); }
        }

        /* Talking: Happy bounce / Head Shake / Laugh */
        @keyframes talk-shake {
          0% { transform: scale(1.05) translateY(0) rotate(0deg); }
          25% { transform: scale(1.08) translateY(4px) rotate(-3deg); }
          50% { transform: scale(1.05) translateY(-2px) rotate(0deg); }
          75% { transform: scale(1.08) translateY(4px) rotate(3deg); }
          100% { transform: scale(1.05) translateY(0) rotate(0deg); }
        }

        .animate-breathe-physics {
          animation: breathe 3.5s ease-in-out infinite;
        }

        .animate-talk-physics {
          animation: talk-shake 0.4s ease-in-out infinite;
        }

        .perspective-1000 {
          perspective: 1000px;
        }
        
        .animate-pulse-fast {
          animation: pulse 0.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
};