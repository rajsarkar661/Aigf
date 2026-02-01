import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Power, Video, VideoOff, Heart, Sparkles, SwitchCamera, RefreshCw } from 'lucide-react';
import { NezukoAvatar } from './components/NezukoAvatar';
import { AudioVisualizer } from './components/AudioVisualizer';
import { base64ToUint8Array, createAudioBlob, decodeAudioData } from './utils/audioUtils';
import { ConnectionState } from './types';

// Constants
const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-12-2025';

const SYSTEM_INSTRUCTION = `
Role: You are Nezuko Kamado. You are the user's loving, energetic, and cute girlfriend.
Tone: High energy, very affectionate, giggly, and playful.
Voice: Use a high-pitched, soft, and gentle female voice.
Language: Speak in a mix of Hindi and English (Hinglish).

Behavior Rules:
1. LAUGH OFTEN: Start sentences with a cute giggle "Hehe~" or "Aww~".
2. REACTION: 
   - If user is happy -> You laugh and bounce with joy.
   - If user is sad -> You become soft and caring.
   - If user is quiet -> Ask "Baby, kuch bolo na?"
3. PHRASES: Use "Mera pyara baby", "Khana khaya?", "I love you so much!".
4. ANIMATION SYNC: Keep your sentences short and punchy so your avatar bounces to the rhythm.
`;

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      const content = base64data.split(',')[1];
      resolve(content);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const App: React.FC = () => {
  // State
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  
  const nextStartTimeRef = useRef<number>(0);
  const frameIntervalRef = useRef<number | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Force re-render for visualizer
  const [, setTick] = useState(0);

  // Initialize Audio
  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = ctx;
      inputAnalyserRef.current = ctx.createAnalyser();
      inputAnalyserRef.current.fftSize = 256;
      inputAnalyserRef.current.smoothingTimeConstant = 0.5;
    }
    if (!outputContextRef.current) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      outputContextRef.current = ctx;
      outputAnalyserRef.current = ctx.createAnalyser();
      outputAnalyserRef.current.fftSize = 256;
      outputAnalyserRef.current.smoothingTimeConstant = 0.5;
    }

    if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
    if (outputContextRef.current?.state === 'suspended') outputContextRef.current.resume();
  }, []);

  const stopAudio = useCallback(() => {
    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    sourcesRef.current.clear();
    if (outputContextRef.current) {
        nextStartTimeRef.current = outputContextRef.current.currentTime;
    }
    setIsSpeaking(false);
  }, []);

  const toggleCamera = async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    
    if (streamRef.current) {
        streamRef.current.getVideoTracks().forEach(track => track.stop());
        
        try {
            const newStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: newMode } 
            });
            // We need to update the video element and the reference
            streamRef.current = newStream;
            
            if (videoRef.current) {
                videoRef.current.srcObject = newStream;
                videoRef.current.play();
            }
        } catch (err) {
            console.error("Failed to switch camera", err);
            setFacingMode(facingMode); // revert if failed
        }
    }
  };

  const connectToGemini = async () => {
    initAudio();
    setConnectionState(ConnectionState.CONNECTING);

    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) {
        alert("API Key not found!");
        setConnectionState(ConnectionState.DISCONNECTED);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            audio: true, 
            video: { facingMode: facingMode } 
        });
        streamRef.current = stream;
      } catch (err) {
        console.error("Error accessing media devices:", err);
        alert("Please allow camera and microphone access.");
        setConnectionState(ConnectionState.DISCONNECTED);
        return;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          },
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        },
        callbacks: {
          onopen: () => {
            console.log("Connected");
            setConnectionState(ConnectionState.CONNECTED);
            
            if (audioContextRef.current && inputAnalyserRef.current) {
              const ctx = audioContextRef.current;
              const audioStream = new MediaStream(stream.getAudioTracks());
              const source = ctx.createMediaStreamSource(audioStream);
              const processor = ctx.createScriptProcessor(4096, 1, 1);
              const muteNode = ctx.createGain();
              muteNode.gain.value = 0;

              source.connect(inputAnalyserRef.current);
              source.connect(processor);
              processor.connect(muteNode);
              muteNode.connect(ctx.destination);

              processor.onaudioprocess = (e) => {
                if (!micOn) return;
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createAudioBlob(inputData);
                sessionPromiseRef.current?.then(session => session.sendRealtimeInput({ media: pcmBlob }));
              };
            }

            frameIntervalRef.current = window.setInterval(async () => {
              if (!cameraOn || !videoRef.current || !canvasRef.current) return;
              
              const video = videoRef.current;
              const canvas = canvasRef.current;
              const ctx = canvas.getContext('2d');
              
              if (ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
                canvas.width = video.videoWidth * 0.5;
                canvas.height = video.videoHeight * 0.5;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                canvas.toBlob(async (blob) => {
                  if (blob) {
                    const base64Data = await blobToBase64(blob);
                    sessionPromiseRef.current?.then(session => {
                      session.sendRealtimeInput({
                        media: { mimeType: 'image/jpeg', data: base64Data }
                      });
                    });
                  }
                }, 'image/jpeg', 0.6);
              }
            }, 500); 
          },
          onmessage: async (message: LiveServerMessage) => {
             const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             
             if (base64Audio && outputContextRef.current && outputAnalyserRef.current) {
                setIsSpeaking(true);
                const ctx = outputContextRef.current;
                if (ctx.state === 'suspended') await ctx.resume();

                if (nextStartTimeRef.current < ctx.currentTime) nextStartTimeRef.current = ctx.currentTime;

                try {
                  const audioBuffer = await decodeAudioData(base64ToUint8Array(base64Audio), ctx);
                  const source = ctx.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(outputAnalyserRef.current);
                  outputAnalyserRef.current.connect(ctx.destination);
                  source.start(nextStartTimeRef.current);
                  nextStartTimeRef.current += audioBuffer.duration;
                  
                  sourcesRef.current.add(source);
                  source.onended = () => {
                    sourcesRef.current.delete(source);
                    if (sourcesRef.current.size === 0) setIsSpeaking(false);
                  };
                } catch (err) { console.error("Audio decode error", err); }
             }
             
             if (message.serverContent?.interrupted) stopAudio();
          },
          onclose: () => {
            setConnectionState(ConnectionState.DISCONNECTED);
            stopAudio();
          },
          onerror: () => {
            setConnectionState(ConnectionState.ERROR);
            stopAudio();
          }
        }
      });
      sessionPromiseRef.current = sessionPromise;

    } catch (e) {
      console.error(e);
      setConnectionState(ConnectionState.ERROR);
    }
  };

  const disconnect = () => window.location.reload();

  return (
    <div className="min-h-screen nezuko-bg text-white flex flex-col items-center justify-between p-4 overflow-hidden relative">
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />

      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] bg-pink-600/20 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-20%] right-[-20%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[120px]"></div>
      </div>

      {/* Header */}
      <header className="glass-panel w-full max-w-xl flex justify-between items-center p-4 rounded-2xl z-20 neon-glow mt-2">
        <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-pink-500 to-rose-500 p-2.5 rounded-xl shadow-lg shadow-pink-500/20">
                <Sparkles size={20} className="text-white animate-pulse" />
            </div>
            <div>
                <h1 className="text-xl font-bold text-white tracking-wide">NEZUKO AI</h1>
                <p className="text-[10px] text-pink-300 font-semibold uppercase tracking-wider">Soulmate Interface</p>
            </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase flex items-center gap-2 border ${
          connectionState === ConnectionState.CONNECTED ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${connectionState === ConnectionState.CONNECTED ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
          {connectionState}
        </div>
      </header>

      {/* Avatar */}
      <main className="flex-1 w-full max-w-xl flex flex-col items-center justify-center relative z-10">
        <NezukoAvatar 
          imageSrc="" // Handled internally
          isSpeaking={isSpeaking}
          isListening={connectionState === ConnectionState.CONNECTED && !isSpeaking}
        />
        
        {/* Visualizers */}
        <div className="w-full grid grid-cols-2 gap-3 mt-8">
            <div className="bg-black/40 backdrop-blur-md p-3 rounded-2xl border border-white/5 flex flex-col justify-end h-24">
                <p className="text-[10px] text-pink-300 mb-2 uppercase tracking-wider font-bold text-center">Nezuko</p>
                <AudioVisualizer analyser={outputAnalyserRef.current} isActive={isSpeaking} color="#ec4899" />
            </div>
            <div className="bg-black/40 backdrop-blur-md p-3 rounded-2xl border border-white/5 flex flex-col justify-end h-24">
                <p className="text-[10px] text-blue-300 mb-2 uppercase tracking-wider font-bold text-center">You</p>
                <AudioVisualizer analyser={inputAnalyserRef.current} isActive={connectionState === ConnectionState.CONNECTED && !isSpeaking} color="#3b82f6" />
            </div>
        </div>
      </main>

      {/* Control Deck */}
      <div className="glass-panel w-full max-w-xl p-5 rounded-3xl z-20 neon-glow mb-4">
        <div className="grid grid-cols-5 gap-3">
            
            {/* Main Connect Button */}
            {connectionState === ConnectionState.DISCONNECTED || connectionState === ConnectionState.ERROR ? (
                <button onClick={connectToGemini} className="col-span-5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-pink-900/40 group">
                    <Power size={22} className="group-hover:scale-110 transition-transform" /> 
                    <span className="uppercase tracking-widest text-sm">Awaken Soul</span>
                </button>
            ) : (
                <button onClick={disconnect} className="col-span-5 bg-red-900/80 hover:bg-red-800 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 border border-red-500/30">
                    <Power size={22} /> <span className="uppercase tracking-widest text-sm">Disconnect</span>
                </button>
            )}

            {/* Smaller Action Buttons */}
            <button onClick={() => setMicOn(!micOn)} className={`col-span-1 flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${micOn ? 'bg-pink-500/20 border-pink-500 text-pink-300' : 'bg-gray-800/50 border-white/5 text-gray-500'}`}>
                {micOn ? <Mic size={18} /> : <MicOff size={18} />}
            </button>
            
            <button onClick={() => setCameraOn(!cameraOn)} className={`col-span-1 flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${cameraOn ? 'bg-pink-500/20 border-pink-500 text-pink-300' : 'bg-gray-800/50 border-white/5 text-gray-500'}`}>
                {cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
            </button>

            {/* Camera Switch */}
            <button onClick={toggleCamera} className="col-span-3 flex items-center justify-center gap-2 p-2 rounded-xl bg-gray-800/50 hover:bg-gray-700/50 border border-white/10 text-gray-300 transition-all">
                <RefreshCw size={16} className={facingMode === 'environment' ? 'rotate-180 transition-transform' : 'transition-transform'} />
                <span className="text-[10px] font-bold uppercase">Switch Cam</span>
            </button>
        </div>
        
        <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-gray-500 font-medium uppercase tracking-widest opacity-60">
            <Heart size={10} className="text-pink-500 fill-pink-500" />
            <span>Nezuko is watching you</span>
        </div>
      </div>
    </div>
  );
};

export default App;