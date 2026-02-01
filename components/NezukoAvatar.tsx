import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

interface NezukoAvatarProps {
  imageSrc: string; 
  isSpeaking: boolean;
  isListening: boolean;
}

// Better Image Sources
const IDLE_IMAGES = [
  "https://wsrv.nl/?url=https://i.pinimg.com/736x/8a/36/41/8a3641261a942a781a9514e866848792.jpg&w=500&output=webp",
  "https://wsrv.nl/?url=https://i.pinimg.com/736x/c0/86/94/c086940a97d9532585994f1ba6393166.jpg&w=500&output=webp",
];

const TALKING_IMAGES = [
  "https://wsrv.nl/?url=https://i.pinimg.com/736x/2b/19/31/2b19315629f6225b2977759491703666.jpg&w=500&output=webp",
  "https://wsrv.nl/?url=https://i.pinimg.com/736x/88/2c/3f/882c3f592634e55e8c201460391d3780.jpg&w=500&output=webp", 
];

export const NezukoAvatar: React.FC<NezukoAvatarProps> = ({ isSpeaking, isListening }) => {
  const [imgStatus, setImgStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [useFallbackMode, setUseFallbackMode] = useState(false);
  const [currentIdleIndex, setCurrentIdleIndex] = useState(0);
  const [currentTalkingIndex, setCurrentTalkingIndex] = useState(0);

  // Preload images logic
  useEffect(() => {
    if (!useFallbackMode) {
      loadImages(currentIdleIndex, currentTalkingIndex);
    }
  }, [currentIdleIndex, currentTalkingIndex, useFallbackMode]);

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
      // If all images fail, switch to Safe Mode (CSS Avatar)
      console.log("All images failed. Switching to Safe Mode.");
      setUseFallbackMode(true);
      setImgStatus('loaded');
    }
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
        {/* State: Loading */}
        {!useFallbackMode && imgStatus === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm z-20">
                 <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )}

        {/* State: Normal Image Mode */}
        {!useFallbackMode && imgStatus === 'loaded' && (
            <div className="absolute inset-0 w-full h-full">
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
        )}

        {/* State: Safe Mode (High Fidelity CSS Avatar) */}
        {useFallbackMode && (
            <div className="absolute inset-0 w-full h-full overflow-hidden bg-[#2a0a14]">
                {/* Kimono Pattern Background */}
                <div className="absolute inset-0 opacity-20" style={{
                    backgroundImage: `repeating-linear-gradient(60deg, #ff69b4 0, #ff69b4 2px, transparent 2px, transparent 10px), repeating-linear-gradient(-60deg, #ff69b4 0, #ff69b4 2px, transparent 2px, transparent 10px)`
                }}></div>

                {/* Anime Face Constructed with CSS */}
                <div className="relative w-full h-full flex flex-col items-center justify-center pt-8">
                    
                    {/* Hair (Back) */}
                    <div className="absolute w-64 h-72 bg-gradient-to-b from-black via-black to-[#ff4500] rounded-[50px] top-10 z-0 scale-x-125"></div>

                    {/* Face Shape */}
                    <div className="relative w-40 h-48 bg-[#fff0e5] rounded-[40px] z-10 flex flex-col items-center shadow-lg">
                        
                        {/* Eyes Container */}
                        <div className="flex justify-between w-full px-6 mt-16 relative z-20">
                            {/* Left Eye */}
                            <div className="w-10 h-10 bg-white rounded-full border-t-4 border-l-2 border-r-2 border-black overflow-hidden relative">
                                <div className="absolute inset-0 bg-[#ff69b4] scale-75 rounded-full flex items-center justify-center">
                                     <div className="w-1 h-6 bg-black rounded-full"></div> {/* Slit Pupil */}
                                </div>
                                <div className="absolute top-1 left-2 w-3 h-3 bg-white rounded-full opacity-80"></div>
                                {/* Blink Animation */}
                                <div className="animate-blink absolute inset-0 bg-[#fff0e5] origin-top"></div>
                            </div>

                            {/* Right Eye */}
                            <div className="w-10 h-10 bg-white rounded-full border-t-4 border-l-2 border-r-2 border-black overflow-hidden relative">
                                <div className="absolute inset-0 bg-[#ff69b4] scale-75 rounded-full flex items-center justify-center">
                                     <div className="w-1 h-6 bg-black rounded-full"></div>
                                </div>
                                <div className="absolute top-1 left-2 w-3 h-3 bg-white rounded-full opacity-80"></div>
                                {/* Blink Animation */}
                                <div className="animate-blink absolute inset-0 bg-[#fff0e5] origin-top"></div>
                            </div>
                        </div>

                        {/* Blush */}
                        <div className="absolute top-24 left-4 w-8 h-4 bg-red-400/30 blur-md rounded-full"></div>
                        <div className="absolute top-24 right-4 w-8 h-4 bg-red-400/30 blur-md rounded-full"></div>

                        {/* Bamboo Muzzle */}
                        <div className="absolute bottom-8 w-16 h-8 bg-green-600 rounded-lg border-2 border-green-800 shadow-md flex items-center justify-center z-30">
                            <div className="w-full h-1 bg-green-800 opacity-50 absolute top-2"></div>
                            <div className="w-full h-1 bg-green-800 opacity-50 absolute bottom-2"></div>
                            {/* Red Ribbon */}
                            <div className="absolute left-[-5px] w-2 h-6 bg-red-600 rounded"></div>
                            <div className="absolute right-[-5px] w-2 h-6 bg-red-600 rounded"></div>
                        </div>

                        {/* Forehead Marking (Demon Form Hint) */}
                        <div className="absolute top-10 right-8 w-4 h-6 opacity-0"></div> 

                        {/* Hair (Bangs) */}
                         <div className="absolute -top-4 -left-4 w-16 h-24 bg-black rounded-br-3xl z-20 rotate-12"></div>
                         <div className="absolute -top-4 -right-4 w-16 h-24 bg-black rounded-bl-3xl z-20 -rotate-12"></div>
                         <div className="absolute top-[-5px] w-8 h-4 bg-pink-400/50 rounded-full z-30 opacity-50 blur-sm"></div> {/* Ribbon glow hint */}
                    </div>

                    {/* Ribbon in Hair */}
                    <div className="absolute top-12 left-20 w-8 h-8 bg-pink-500 rounded-md rotate-45 z-20"></div>

                </div>
                
                {/* Fallback Text */}
                <div className="absolute bottom-4 left-0 right-0 text-center text-pink-300/50 font-bold text-[10px] uppercase tracking-widest">
                    Nezuko Mode: Safe
                </div>
            </div>
        )}

        {/* Cinematic Gloss Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-white/10 pointer-events-none mix-blend-overlay" />
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

        /* Eye Blink */
        @keyframes blink {
            0%, 96%, 100% { transform: scaleY(0); }
            98% { transform: scaleY(1); }
        }

        .animate-blink {
             animation: blink 4s infinite;
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