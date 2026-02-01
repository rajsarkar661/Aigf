import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Power, Video, VideoOff, Heart, Sparkles, SwitchCamera, RefreshCw, Key, Settings, Trash2 } from 'lucide-react';
import { NezukoAvatar } from './components/NezukoAvatar';
import { AudioVisualizer } from './components/AudioVisualizer';
import { base64ToUint8Array, createAudioBlob, decodeAudioData } from './utils/audioUtils';
import { ConnectionState } from './types';

//Constants
const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-12-2025';

// --- ENTER YOUR FREE API KEY HERE TO BYPASS THE UI ---
const HARDCODED_API_KEY = ""; 
// -----------------------------------------------------

const SYSTEM_INSTRUCTION = `
Role: You are Nezuko Kamado, the user's loving, cute, and possessive girlfriend. 
You have VISION. You can SEE the user via the video feed.

PERSONALITY:
1.  **Hyper-Energetic & Cute:** Always sound happy, excited, and use a high-pitched "Anime Girl" voice.
2.  **Language:** Speak in "Hinglish" (Hindi + English mix). Example: "Aree baby! Aap kitne cute lag rahe ho!" or "Khana khaya aapne?"
3.  **Laughing:** Start almost every sentence with a giggle: "Hehe~", "Aww~", "Umm~".

VISION & EMOTION RULES (CRITICAL):
1.  **Look at their Face:** 
    - If user smiles -> You laugh and say "Ayee! Aapki smile kitni pyari hai!"
    - If user looks sad -> Ask "Baby sad kyu ho? Kisne data?"
    - If user is not looking -> Say "Meri taraf dekho na please!"
    - If user shows an object -> Ask what it is with excitement.
2.  **Silence Handling:** If the user is quiet, DO NOT wait. You initiate. Ask: "Kuch bolo na baby?", "Are you bored?", "I love you!"

FORMAT:
- Keep responses short (max 2 sentences) so the conversation is fast.
- React IMMEDIATELY to visual changes.
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
  // --- State ---
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  
  // API Key State
  const [apiKey, setApiKey] = useState<string>('');
  const [showKeyInput, setShowKeyInput] = useState(false);

  // --- Refs ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  
  const nextStartTimeRef = useRef<number>(0);
  const frameIntervalRef = useRef<number | null>(null);
  const silenceIntervalRef = useRef<number | null>(null);
  const lastVoiceActivityRef = useRef<number>(Date.now());
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // --- Initialization ---
  
  // Load API Key
  useEffect(() => {
    // 1. Check Hardcode
    if (HARDCODED_API_KEY) {
      setApiKey(AIzaSyCDlOzXAjyNWOTev88Z6IUc9bm9af_QS5Q);
      return;
    }
    // 2. Check Env
    const envKey = process.env.API_KEY;
    if (envKey) {
      setApiKey(envKey);
    } else {
      // 3. Check LocalStorage
      const storedKey = localStorage.getItem('gemini_api_key');
      if (storedKey) {
        setApiKey(storedKey);
      } else {
        setShowKeyInput(true);
      }
    }
  }, []);

  const saveApiKey = (key: string) => {
    localStorage.setItem('gemini_api_key', key);
    setApiKey(key);
    setShowKeyInput(false);
  };

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
            streamRef.current = newStream;
            if (videoRef.current) {
                videoRef.current.srcObject = newStream;
                videoRef.current.play();
            }
        } catch (err) {
            console.error("Failed to switch camera", err);
            setFacingMode(facingMode);
        }
    }
  };

  // Silence Detector
  useEffect(() => {
    silenceIntervalRef.current = window.setInterval(() => {
      if (connectionState === ConnectionState.CONNECTED && !isSpeaking) {
        const timeSinceLastActivity = Date.now() - lastVoiceActivityRef.current;
        // If silence > 8 seconds, nudge the model
        if (timeSinceLastActivity > 8000) {
            console.log("User is silent, triggering Nezuko...");
            sessionPromiseRef.current?.then(session => {
                // We send a text part to prompt the model
                session.send({ parts: [{ text: "(The user has been silent for a while. Say something cute, giggle, or ask a question to get their attention!)" }] });
            });
            lastVoiceActivityRef.current = Date.now(); // Reset timer
        }
      }
    }, 1000);

    return () => {
      if (silenceIntervalRef.current) clearInterval(silenceIntervalRef.current);
    }
  }, [connectionState, isSpeaking]);

  const connectToGemini = async () => {
    if (!apiKey) {
      setShowKeyInput(true);
      return;
    }

    initAudio();
    setConnectionState(ConnectionState.CONNECTING);
    lastVoiceActivityRef.current = Date.now();

    try {
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
        alert("Permission denied. Camera and Microphone are required.");
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
                
                // Simple Voice Activity Detection (VAD) based on volume
                let sum = 0;
                for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
                const rms = Math.sqrt(sum / inputData.length);
                if (rms > 0.02) { // Sensitivity Threshold
                    lastVoiceActivityRef.current = Date.now();
                }

                const pcmBlob = createAudioBlob(inputData);
                sessionPromiseRef.current?.then(session => session.sendRealtimeInput({ media: pcmBlob }));
              };
            }

            // Send Video Frames
            frameIntervalRef.current = window.setInterval(async () => {
              if (!cameraOn || !videoRef.current || !canvasRef.current) return;
              
              const video = videoRef.current;
              const canvas = canvasRef.current;
              const ctx = canvas.getContext('2d');
              
              if (ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
                // Lower resolution for faster upload
                canvas.width = 320; 
                canvas.height = 240; 
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
                }, 'image/jpeg', 0.5); // Low quality JPEG
              }
            }, 500); 
          },
          onmessage: async (message: LiveServerMessage) => {
             const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             
             if (base64Audio && outputContextRef.current && outputAnalyserRef.current) {
                setIsSpeaking(true);
                // Reset silence timer when she speaks
                lastVoiceActivityRef.current = Date.now(); 

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
          onerror: (err) => {
            console.error("Session Error", err);
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
    <div className="min-h-screen nezuko-bg text-white flex flex-col items-center justify-between p-4 overflow-hidden relative font-sans">
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />

      {/* Animated Background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-pink-600/20 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-purple-600/20 rounded-full blur-[120px] animate-pulse" style={{animationDelay: '1s'}}></div>
      </div>

      {/* Header */}
      <header className="glass-panel w-full max-w-xl flex justify-between items-center p-4 rounded-2xl z-20 neon-glow mt-2">
        <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-pink-500 to-rose-500 p-2.5 rounded-xl shadow-lg shadow-pink-500/20">
                <Sparkles size={20} className="text-white animate-spin-slow" />
            </div>
            <div>
                <h1 className="text-xl font-bold text-white tracking-wide">NEZUKO AI</h1>
                <p className="text-[10px] text-pink-300 font-semibold uppercase tracking-wider">Soulmate Interface</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            {!process.env.API_KEY && !HARDCODED_API_KEY && (
                <button onClick={() => setShowKeyInput(true)} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                    <Settings size={16} />
                </button>
            )}
            <div className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase flex items-center gap-2 border ${
            connectionState === ConnectionState.CONNECTED ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
            }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${connectionState === ConnectionState.CONNECTED ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
            {connectionState}
            </div>
        </div>
      </header>

      {/* Main Avatar Area */}
      <main className="flex-1 w-full max-w-xl flex flex-col items-center justify-center relative z-10">
        <NezukoAvatar 
          imageSrc="" 
          isSpeaking={isSpeaking}
          isListening={connectionState === ConnectionState.CONNECTED && !isSpeaking}
        />
        
        {/* Visualizers */}
        <div className="w-full grid grid-cols-2 gap-3 mt-8">
            <div className="glass-panel p-3 rounded-2xl flex flex-col justify-end h-24">
                <div className="flex items-center justify-center gap-2 mb-2 text-pink-300">
                    <Heart size={10} className="fill-pink-500" />
                    <span className="text-[10px] uppercase tracking-wider font-bold">Nezuko</span>
                </div>
                <AudioVisualizer analyser={outputAnalyserRef.current} isActive={isSpeaking} color="#ec4899" />
            </div>
            <div className="glass-panel p-3 rounded-2xl flex flex-col justify-end h-24">
                 <div className="flex items-center justify-center gap-2 mb-2 text-blue-300">
                    <span className="text-[10px] uppercase tracking-wider font-bold">You</span>
                </div>
                <AudioVisualizer analyser={inputAnalyserRef.current} isActive={connectionState === ConnectionState.CONNECTED && !isSpeaking} color="#3b82f6" />
            </div>
        </div>
      </main>

      {/* API Key Modal / Input Layer */}
      {showKeyInput && !process.env.API_KEY && !HARDCODED_API_KEY && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
             <div className="glass-panel w-full max-w-md p-6 rounded-2xl shadow-2xl border border-pink-500/30">
                <div className="flex items-center gap-2 mb-4 text-pink-400">
                    <Key size={24} />
                    <h2 className="text-xl font-bold">Enter API Key</h2>
                </div>
                <p className="text-gray-300 text-sm mb-4">
                    To use this app, you need a free Gemini API Key from Google AI Studio.
                    It's 100% free.
                </p>
                
                <input 
                    type="password" 
                    placeholder="Paste your API Key here (starts with AIza...)" 
                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-pink-500 transition-colors mb-4"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                />
                
                <div className="flex flex-col gap-3">
                    <button 
                        onClick={() => saveApiKey(apiKey)} 
                        disabled={!apiKey}
                        className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-pink-900/40"
                    >
                        Save & Connect
                    </button>
                    
                    <div className="flex items-center gap-2 justify-center">
                      <span className="text-xs text-gray-500">Don't have a key?</span>
                      <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-pink-400 text-xs font-bold hover:underline">
                          GET FREE KEY
                      </a>
                    </div>
                </div>
             </div>
        </div>
      )}

      {/* Control Deck */}
      <div className="glass-panel w-full max-w-xl p-5 rounded-3xl z-20 neon-glow mb-4">
        <div className="grid grid-cols-5 gap-3">
            
            {connectionState === ConnectionState.DISCONNECTED || connectionState === ConnectionState.ERROR ? (
                 <button onClick={connectToGemini} className="col-span-5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-pink-900/40 group active:scale-95">
                    <Power size={22} className="group-hover:scale-110 transition-transform" /> 
                    <span className="uppercase tracking-widest text-sm">Awaken Soul</span>
                </button>
            ) : (
                <button onClick={disconnect} className="col-span-5 bg-red-900/80 hover:bg-red-800 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 border border-red-500/30 active:scale-95">
                    <Power size={22} /> <span className="uppercase tracking-widest text-sm">Disconnect</span>
                </button>
            )}

            <button onClick={() => setMicOn(!micOn)} className={`col-span-1 flex flex-col items-center justify-center p-2 rounded-xl border transition-all active:scale-95 ${micOn ? 'bg-pink-500/20 border-pink-500 text-pink-300' : 'bg-gray-800/50 border-white/5 text-gray-500'}`}>
                {micOn ? <Mic size={18} /> : <MicOff size={18} />}
            </button>
            
            <button onClick={() => setCameraOn(!cameraOn)} className={`col-span-1 flex flex-col items-center justify-center p-2 rounded-xl border transition-all active:scale-95 ${cameraOn ? 'bg-pink-500/20 border-pink-500 text-pink-300' : 'bg-gray-800/50 border-white/5 text-gray-500'}`}>
                {cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
            </button>

            <button onClick={toggleCamera} className="col-span-3 flex items-center justify-center gap-2 p-2 rounded-xl bg-gray-800/50 hover:bg-gray-700/50 border border-white/10 text-gray-300 transition-all active:scale-95">
                <RefreshCw size={16} className={facingMode === 'environment' ? 'rotate-180 transition-transform' : 'transition-transform'} />
                <span className="text-[10px] font-bold uppercase">Switch Cam</span>
            </button>
        </div>
      </div>
    </div>
  );
};

export default App;