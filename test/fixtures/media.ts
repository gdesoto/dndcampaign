// Silent PCM avoids a codec/tool dependency in tests; the tiny WebM fixture is
// synthetic 320x180 video with silent audio (12 seconds), generated with FFmpeg.
export const silentWav = (seconds = 60) => {
  const wav = Buffer.alloc(44 + 8000 * 2 * seconds)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(wav.length - 8, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(8000, 24)
  wav.writeUInt32LE(16000, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(wav.length - 44, 40)
  return wav
}
