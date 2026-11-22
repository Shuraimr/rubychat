// WebRTC engine for ONE audio call: microphone, RTCPeerConnection, batched ICE candidates, remote audio playback.
// It knows nothing about Matrix or Svelte; the state machine in durum/arama.svelte.ts drives it.
// TEK bir sesli arama için WebRTC motoru: mikrofon, RTCPeerConnection, toplu ICE adayları, karşı sesin çalınması.
// Matrix'i ya da Svelte'i bilmez; onu durum/arama.svelte.ts içindeki durum makinesi sürer.
import type { AramaAday, TurnSunucu } from "../api/tipler";

export interface MotorKancalari {
  /** A batch of local ICE candidates is ready to be sent (every ~200 ms) · Yerel ICE adaylarından bir grup gönderilmeye hazır (~200 ms'de bir) */
  adaylar(liste: AramaAday[]): void;
  baglandi(): void;
  /** ICE failed or stayed disconnected · ICE başarısız oldu ya da kopuk kaldı */
  koptu(): void;
}

export class MikrofonHatasi extends Error {
  constructor(public readonly neden: "izin" | "yok" | "diger") {
    super(neden);
  }
}

/** Opens the microphone with the processing constraints. · Mikrofonu işleme kısıtlarıyla açar. */
export async function mikrofonAl(gurultuEngelleme: boolean): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new MikrofonHatasi("yok");
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { noiseSuppression: gurultuEngelleme, echoCancellation: true, autoGainControl: true },
      video: false,
    });
  } catch (e) {
    const ad = (e as DOMException).name;
    if (ad === "NotAllowedError" || ad === "SecurityError") throw new MikrofonHatasi("izin");
    if (ad === "NotFoundError" || ad === "OverconstrainedError") throw new MikrofonHatasi("yok");
    throw new MikrofonHatasi("diger");
  }
}

export class Motor {
  readonly #pc: RTCPeerConnection;
  readonly #yerel: MediaStream;
  readonly #kancalar: MotorKancalari;
  readonly #ses = document.createElement("audio");
  #bekleyenAdaylar: AramaAday[] = [];
  /** Remote candidates that arrived before the remote description was set · Uzak tanım kurulmadan gelen uzak adaylar */
  #uzakBekleyen: AramaAday[] = [];
  #uzakTanimVar = false;
  #gonderimAcik = false;
  #gonderZamanlayici: ReturnType<typeof setTimeout> | undefined;
  #kopukZamanlayici: ReturnType<typeof setTimeout> | undefined;
  #kapali = false;

  constructor(yerel: MediaStream, turn: TurnSunucu[], kancalar: MotorKancalari) {
    this.#yerel = yerel;
    this.#kancalar = kancalar;
    this.#pc = new RTCPeerConnection({ iceServers: turn });
    for (const iz of yerel.getAudioTracks()) this.#pc.addTrack(iz, yerel);

    this.#ses.autoplay = true;
    this.#ses.setAttribute("playsinline", "");
    this.#pc.ontrack = (e) => {
      this.#ses.srcObject = e.streams[0] ?? new MediaStream([e.track]);
      void this.#ses.play().catch(() => {});
    };
    this.#pc.onicecandidate = (e) => {
      // `null` = gathering finished; Matrix marks the end with an empty candidate string.
      // `null` = toplama bitti; Matrix sonu boş aday metniyle belirtir.
      this.#bekleyenAdaylar.push(
        e.candidate
          ? { candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid, sdpMLineIndex: e.candidate.sdpMLineIndex }
          : { candidate: "", sdpMid: null, sdpMLineIndex: null },
      );
      this.#gonderPlanla();
    };
    this.#pc.oniceconnectionstatechange = () => {
      const d = this.#pc.iceConnectionState;
      clearTimeout(this.#kopukZamanlayici);
      if (d === "connected" || d === "completed") this.#kancalar.baglandi();
      else if (d === "failed") this.#kancalar.koptu();
      else if (d === "disconnected") {
        // Brief disconnects heal by themselves (wifi → mobile); give it 8 s. · Kısa kopmalar kendiliğinden düzelir; 8 sn bekle.
        this.#kopukZamanlayici = setTimeout(() => this.#kancalar.koptu(), 8000);
      }
    };
  }

  /** Candidates are held back until the invite/answer event has been sent (Matrix needs that order). */
  /** Davet/cevap olayı gönderilene kadar adaylar tutulur (Matrix bu sırayı ister). */
  adayGonderiminiAc() {
    this.#gonderimAcik = true;
    this.#gonderPlanla();
  }

  #gonderPlanla() {
    if (!this.#gonderimAcik || this.#gonderZamanlayici || this.#kapali) return;
    this.#gonderZamanlayici = setTimeout(() => {
      this.#gonderZamanlayici = undefined;
      if (this.#bekleyenAdaylar.length === 0 || this.#kapali) return;
      const grup = this.#bekleyenAdaylar;
      this.#bekleyenAdaylar = [];
      this.#kancalar.adaylar(grup);
    }, 200);
  }

  async teklifOlustur(): Promise<string> {
    const t = await this.#pc.createOffer();
    await this.#pc.setLocalDescription(t);
    return t.sdp ?? "";
  }

  async cevapOlustur(teklifSdp: string): Promise<string> {
    await this.#pc.setRemoteDescription({ type: "offer", sdp: teklifSdp });
    await this.#uzakTanimKuruldu();
    const c = await this.#pc.createAnswer();
    await this.#pc.setLocalDescription(c);
    return c.sdp ?? "";
  }

  async cevapUygula(cevapSdp: string) {
    await this.#pc.setRemoteDescription({ type: "answer", sdp: cevapSdp });
    await this.#uzakTanimKuruldu();
  }

  async #uzakTanimKuruldu() {
    this.#uzakTanimVar = true;
    const bekleyen = this.#uzakBekleyen;
    this.#uzakBekleyen = [];
    await this.adayEkle(bekleyen);
  }

  async adayEkle(liste: AramaAday[]) {
    if (!this.#uzakTanimVar) {
      this.#uzakBekleyen.push(...liste);
      return;
    }
    for (const a of liste) {
      // Empty candidate = end of candidates; nothing to add. · Boş aday = aday sonu; eklenecek bir şey yok.
      if (!a.candidate) continue;
      try {
        await this.#pc.addIceCandidate({ candidate: a.candidate, sdpMid: a.sdpMid, sdpMLineIndex: a.sdpMLineIndex });
      } catch (e) {
        console.warn("ICE adayı eklenemedi", e);
      }
    }
  }

  sessizeAl(sessiz: boolean) {
    for (const iz of this.#yerel.getAudioTracks()) iz.enabled = !sessiz;
  }

  /** Live change of noise suppression; false when the engine refuses. · Gürültü engellemenin canlı değişimi; motor reddederse false. */
  async gurultuEngelle(ac: boolean): Promise<boolean> {
    try {
      for (const iz of this.#yerel.getAudioTracks()) await iz.applyConstraints({ noiseSuppression: ac });
      return true;
    } catch {
      return false;
    }
  }

  kapat() {
    this.#kapali = true;
    clearTimeout(this.#gonderZamanlayici);
    clearTimeout(this.#kopukZamanlayici);
    this.#pc.onicecandidate = null;
    this.#pc.oniceconnectionstatechange = null;
    this.#pc.ontrack = null;
    this.#pc.close();
    for (const iz of this.#yerel.getTracks()) iz.stop();
    this.#ses.srcObject = null;
  }
}
