class StadiumAudioEngine {
  private ctx: AudioContext | null = null;
  private ambientOsc: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;
  private isMuted: boolean = false;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  private init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    this.ctx = new AudioContextClass();
    this.startAmbient();
  }

  public setMuted(mute: boolean) {
    this.isMuted = mute;
    if (this.ambientGain) {
      this.ambientGain.gain.setValueAtTime(mute ? 0 : 0.03, this.ctx?.currentTime || 0);
    }
  }

  public getIsMuted() {
    return this.isMuted;
  }

  private startAmbient() {
    if (!this.ctx || this.isMuted) return;
    try {
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.03, this.ctx.currentTime);
      this.ambientGain.connect(this.ctx.destination);

      // Low ambient hum
      this.ambientOsc = this.ctx.createOscillator();
      this.ambientOsc.type = 'triangle';
      this.ambientOsc.frequency.setValueAtTime(55, this.ctx.currentTime); // A1 note
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(100, this.ctx.currentTime);

      this.ambientOsc.connect(filter);
      filter.connect(this.ambientGain);
      this.ambientOsc.start();
    } catch (e) {
      console.warn('Failed to start ambient audio:', e);
    }
  }

  public playChime() {
    this.init();
    if (this.isMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.1); // E6

      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {
      console.warn('Failed to play chime:', e);
    }
  }

  public playAlert() {
    this.init();
    if (this.isMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6

      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.01);
      gain.gain.setValueAtTime(0.06, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1500, now);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {
      console.warn('Failed to play alert:', e);
    }
  }

  private evacSirenInterval: any = null;
  private evacSirenOscs: OscillatorNode[] = [];
  private evacSirenGains: GainNode[] = [];

  public startEvacSiren() {
    this.init();
    if (this.evacSirenInterval) return;
    if (this.isMuted || !this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'triangle';
      
      osc1.frequency.setValueAtTime(440, now);
      osc2.frequency.setValueAtTime(444, now); // slightly detuned

      gainNode.gain.setValueAtTime(0.0, now);
      gainNode.gain.linearRampToValueAtTime(0.04, now + 0.1);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);

      this.evacSirenOscs = [osc1, osc2];
      this.evacSirenGains = [gainNode];

      let sweepUp = true;
      this.evacSirenInterval = setInterval(() => {
        if (!this.ctx || this.isMuted) return;
        const sweepTime = this.ctx.currentTime;
        if (sweepUp) {
          osc1.frequency.exponentialRampToValueAtTime(700, sweepTime + 0.7);
          osc2.frequency.exponentialRampToValueAtTime(704, sweepTime + 0.7);
        } else {
          osc1.frequency.exponentialRampToValueAtTime(350, sweepTime + 0.7);
          osc2.frequency.exponentialRampToValueAtTime(354, sweepTime + 0.7);
        }
        sweepUp = !sweepUp;
      }, 800);
    } catch (e) {
      console.warn('Failed to start siren:', e);
    }
  }

  public stopEvacSiren() {
    if (this.evacSirenInterval) {
      clearInterval(this.evacSirenInterval);
      this.evacSirenInterval = null;
    }
    
    try {
      const now = this.ctx?.currentTime || 0;
      this.evacSirenGains.forEach(gain => {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      });
      setTimeout(() => {
        this.evacSirenOscs.forEach(osc => {
          try { osc.stop(); } catch(e){}
        });
        this.evacSirenOscs = [];
        this.evacSirenGains = [];
      }, 300);
    } catch(e) {
      console.warn(e);
    }
  }

  public announceText(text: string) {
    if (this.isMuted) return;
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 0.95;
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(voice => 
        voice.name.includes('Google US English') || 
        voice.name.includes('Google UK English Female') ||
        voice.name.includes('Microsoft Zira') ||
        voice.lang.startsWith('en')
      );
      if (preferredVoice) utterance.voice = preferredVoice;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Failed speech synthesis:', e);
    }
  }
}

export const audioEngine = new StadiumAudioEngine();
