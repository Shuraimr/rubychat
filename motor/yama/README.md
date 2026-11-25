livekit 0.9.7 (Apache-2.0, crates.io) with two changes for stereo sound: / livekit 0.9.7, stereo ses için iki değişiklikle:
- `local_participant.rs`: two-channel sources are announced as stereo. / İki kanallı kaynak sunucuya stereo diye bildirilir.
- `peer_transport.rs`: our answers ask for stereo Opus. / Yanıtlarımız stereo Opus ister.
