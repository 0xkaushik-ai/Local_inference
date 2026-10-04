#!/usr/bin/env python3
"""Compose DeviceBench's original, sample-free 48-second launch score.

Requires Python 3.11+, NumPy 2.3.5, and FFmpeg (validated with 8.1.1).
Run: python3 scripts/make-launch-score.py
The default output is reports/launch-video/score.wav, a stereo 48 kHz,
24-bit PCM master. The composition uses 100 BPM, D major, and a seeded
generator. No external samples, reference audio, or downloaded music is used.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import re
import subprocess
import tempfile
import wave

import numpy as np


SAMPLE_RATE = 48_000
DURATION = 48.0
BPM = 100
BEAT = 60 / BPM
BAR = 4 * BEAT
RNG = np.random.default_rng(12082026)
SCENES = (0, 4.8, 9.6, 16.8, 24, 31.2, 36, 40.8, 44.4, 48)


def frequency(note: float) -> float:
    return 440 * 2 ** ((note - 69) / 12)


def timeline(duration: float) -> np.ndarray:
    return np.arange(round(duration * SAMPLE_RATE), dtype=np.float64) / SAMPLE_RATE


def smooth_envelope(t: np.ndarray, attack: float, release: float) -> np.ndarray:
    duration = len(t) / SAMPLE_RATE
    onset = np.minimum(t / attack, 1)
    offset = np.minimum((duration - t) / release, 1)
    return np.sin(onset * np.pi / 2) ** 2 * np.sin(offset * np.pi / 2) ** 2


def place(
    destination: np.ndarray,
    signal: np.ndarray,
    onset: float,
    gain: float = 1,
    pan: float = 0,
) -> None:
    """Place a mono sound into the stereo bus using equal-power panning."""
    start = round(onset * SAMPLE_RATE)
    skip = max(0, -start)
    start = max(0, start)
    length = min(len(signal) - skip, len(destination) - start)
    if length <= 0:
        return
    signal = signal[skip : skip + length] * gain
    angle = (pan + 1) * math.pi / 4
    destination[start : start + length, 0] += signal * math.cos(angle)
    destination[start : start + length, 1] += signal * math.sin(angle)


def electric_piano(note: int, duration: float, velocity: float) -> np.ndarray:
    """A rounded tine-style voice, with a soft hammer and decaying overtones."""
    t = timeline(duration)
    f = frequency(note)
    amplitude = np.exp(-t / 1.6) * smooth_envelope(t, 0.009, 0.42)
    modulation = 0.8 * np.exp(-t / 0.24) * np.sin(2 * np.pi * f * 2 * t)
    fundamental = np.sin(2 * np.pi * f * t + modulation)
    body = 0.2 * np.sin(2 * np.pi * f * 2.002 * t) * np.exp(-t / 0.6)
    tine = 0.055 * np.sin(2 * np.pi * f * 4.001 * t) * np.exp(-t / 0.18)
    tremolo = 0.97 + 0.03 * np.sin(2 * np.pi * 3.1 * t)
    return ((fundamental + body + tine) * amplitude * tremolo * velocity).astype(np.float32)


def soft_pluck(note: int, duration: float) -> np.ndarray:
    t = timeline(duration)
    f = frequency(note)
    sound = (
        np.sin(2 * np.pi * f * t)
        + 0.19 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 7)
        + 0.04 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t * 11)
    )
    return (sound * np.exp(-t * 3.2) * smooth_envelope(t, 0.009, 0.25)).astype(np.float32)


def pad(note: int, duration: float, phase: float) -> np.ndarray:
    t = timeline(duration)
    f = frequency(note)
    sound = np.zeros(len(t))
    for detune, weight in ((-0.0025, 0.28), (0, 0.44), (0.0025, 0.28)):
        sound += weight * (
            np.sin(2 * np.pi * f * (1 + detune) * t + phase)
            + 0.13 * np.sin(2 * np.pi * 2 * f * (1 + detune) * t + phase)
            + 0.025 * np.sin(2 * np.pi * 3 * f * (1 + detune) * t + phase)
        )
    breath = 0.9 + 0.1 * np.sin(2 * np.pi * 0.19 * t + phase)
    return (sound * breath * smooth_envelope(t, 0.85, 1.2)).astype(np.float32)


def bass(note: int, duration: float) -> np.ndarray:
    t = timeline(duration)
    f = frequency(note)
    sound = (
        np.sin(2 * np.pi * f * t)
        + 0.21 * np.sin(2 * np.pi * 2 * f * t)
        + 0.065 * np.sin(2 * np.pi * 3 * f * t)
    )
    return (sound * smooth_envelope(t, 0.018, 0.15)).astype(np.float32)


def filtered_noise(duration: float, low: float, high: float) -> np.ndarray:
    noise = RNG.standard_normal(round(duration * SAMPLE_RATE))
    spectrum = np.fft.rfft(noise)
    bins = np.fft.rfftfreq(len(noise), 1 / SAMPLE_RATE)
    shape = (1 - np.exp(-((bins / low) ** 4))) * np.exp(-((bins / high) ** 4))
    noise = np.fft.irfft(spectrum * shape, n=len(noise))
    return (noise / max(float(np.std(noise)), 1e-9)).astype(np.float32)


def kick() -> np.ndarray:
    t = timeline(0.43)
    f = 47 + 98 * np.exp(-t * 34)
    phase = 2 * np.pi * np.cumsum(f) / SAMPLE_RATE
    body = np.sin(phase) * np.exp(-t * 11)
    touch = filtered_noise(0.43, 1300, 3700) * np.exp(-t * 240) * 0.045
    return ((body + touch) * smooth_envelope(t, 0.0015, 0.06)).astype(np.float32)


def snare() -> np.ndarray:
    t = timeline(0.23)
    noise = filtered_noise(0.23, 700, 6200)
    body = np.sin(2 * np.pi * 182 * t) * np.exp(-t * 40)
    clap = noise * (np.exp(-t * 23) + 0.15 * np.exp(-(((t - 0.021) / 0.007) ** 2)))
    return ((0.15 * body + 0.14 * clap) * smooth_envelope(t, 0.001, 0.07)).astype(np.float32)


def hat(open_hat: bool = False) -> np.ndarray:
    duration = 0.27 if open_hat else 0.075
    t = timeline(duration)
    decay = 19 if open_hat else 68
    noise = filtered_noise(duration, 5400, 10500)
    return (noise * np.exp(-t * decay) * smooth_envelope(t, 0.0015, 0.018)).astype(np.float32)


def transition(duration: float = 0.55) -> np.ndarray:
    t = timeline(duration)
    noise = filtered_noise(duration, 850, 5800)
    shape = np.sin(np.pi * t / duration) ** 2
    # An airy, short rise followed by a soft landing; no trailer-style impact.
    return (noise * shape * (0.65 + t / duration * 0.35)).astype(np.float32)


def compose() -> np.ndarray:
    count = round(DURATION * SAMPLE_RATE)
    harmony = np.zeros((count, 2), dtype=np.float32)
    rhythm = np.zeros_like(harmony)
    atmosphere = np.zeros_like(harmony)
    # Onset/duration in bars, bass MIDI note, upper voicing. All notes are original.
    chords = (
        (0, 2, 38, (54, 61, 64, 69)),  # Dmaj9
        (2, 2, 37, (56, 59, 64, 69)),  # Amaj9/C#
        (4, 3, 35, (54, 57, 61, 66)),  # Bm9
        (7, 3, 31, (54, 57, 59, 62)),  # Gmaj9
        (10, 3, 30, (54, 57, 61, 64)),  # Dmaj9/F#
        (13, 2, 28, (55, 59, 62, 66)),  # Em9
        (15, 2, 33, (54, 59, 61, 64)),  # A6/9
        (17, 1.5, 38, (54, 57, 61, 64)),  # Dmaj9
        (18.5, 1.5, 38, (54, 59, 64, 69)),  # D6/9, open resolution
    )
    for index, (bar, bars, root, notes) in enumerate(chords):
        onset = bar * BAR
        duration = bars * BAR
        for voice, note in enumerate(notes):
            pan = (-0.55, 0.32, -0.23, 0.6)[voice]
            place(
                atmosphere,
                pad(note, duration + 1.1, voice + index * 0.25),
                onset - 0.05,
                0.023,
                pan,
            )
            place(
                harmony,
                electric_piano(note, min(duration + 0.8, 4.1), 0.94 - voice * 0.06),
                onset + voice * 0.024,
                0.064 if bar < 18.5 else 0.078,
                pan * 0.65,
            )
        # Syncopated chord answers introduce motion without a continuous arpeggio.
        if 2 <= bar < 18.5:
            for offset in (1.75, 3.5, 5.75, 7.5, 9.75):
                hit_time = onset + offset * BEAT
                if hit_time >= onset + duration - 0.2:
                    continue
                for voice, note in enumerate(notes[1:]):
                    place(
                        harmony,
                        electric_piano(note, 1.6, 0.7),
                        hit_time + voice * 0.013,
                        0.033,
                        (voice - 1) * 0.32,
                    )
        # Bass begins after the opening title and gently follows the harmony.
        if bar >= 2:
            for beat_index in np.arange(0, bars * 4, 2):
                onset_bass = onset + float(beat_index) * BEAT + 0.009
                if onset_bass >= 44.4:
                    break
                duration_bass = 0.85 if beat_index % 4 == 0 else 0.68
                place(rhythm, bass(root, duration_bass), onset_bass, 0.11)
            if bar == 18.5:
                place(rhythm, bass(root, 2.3), onset + 0.01, 0.095)

    # A conversational motif is used only between feature beats, with variations.
    phrases = (
        (4.5, ((0, 73), (0.75, 76), (1.75, 69), (3.0, 73))),
        (7.5, ((0, 74), (1.0, 71), (2.5, 69), (3.5, 66))),
        (10.5, ((0, 73), (1.5, 76), (2.75, 78), (4.0, 76))),
        (13.5, ((0, 71), (1.0, 74), (2.5, 78), (3.75, 76))),
        (15.5, ((0, 73), (1.5, 71), (2.75, 69))),
        (17.25, ((0, 69), (0.75, 73), (1.5, 76), (3.0, 78))),
    )
    for phrase, events in phrases:
        for event, (offset, note) in enumerate(events):
            onset = phrase * BAR + offset * BEAT
            place(harmony, soft_pluck(note, 1.35), onset, 0.026, (-1) ** event * 0.28)
    # Final ascending brand gesture belongs to the final title, then decays.
    for index, note in enumerate((66, 69, 76)):
        place(harmony, electric_piano(note, 2.7, 0.8), 44.43 + index * 0.15, 0.07, 0.1)

    for bar in range(2, 19):
        start = bar * BAR
        if start >= 44.4:
            break
        level = 0.78 if bar < 4 else 1.0
        if bar in (15, 16):
            level = 0.65
        kicks = (0, 2.0) if bar < 4 or bar in (15, 16) else (0, 1.5, 2.75)
        if bar % 4 == 3:
            kicks = (*kicks, 3.5)
        for beat in kicks:
            onset = start + beat * BEAT
            if onset < 44.2:
                place(rhythm, kick(), onset, 0.17 * level)
        for beat in (1, 3):
            onset = start + beat * BEAT + 0.008
            if onset < 44.1:
                place(rhythm, snare(), onset, 0.26 * level, -0.08)
        if bar >= 4:
            for eighth in range(8):
                onset = start + eighth * BEAT / 2 + (0.014 if eighth % 2 else 0)
                if onset >= 44.2:
                    break
                accent = 0.028 if eighth % 2 else 0.018
                place(rhythm, hat(eighth == 7 and bar % 2 == 1), onset, accent * level, 0.32)
            if bar in (6, 9, 12, 16):
                for offset in (3.25, 3.75):
                    place(rhythm, hat(), start + offset * BEAT, 0.014, -0.4)

    for scene in SCENES[1:-1]:
        place(atmosphere, transition(), scene - 0.42, 0.009, -0.15)
        # Low-volume contact sound, used as an edit accent rather than a beep.
        t = timeline(0.04)
        click = filtered_noise(0.04, 1800, 4600) * np.exp(-t * 140)
        click *= smooth_envelope(t, 0.001, 0.01)
        place(atmosphere, click, scene + 0.005, 0.009, 0.05)

    # A short stereo room plus long quiet tails gives the harmony depth.
    wet = np.zeros_like(harmony)
    for delay, gain, cross in (
        (0.037, 0.13, False),
        (0.061, 0.10, True),
        (0.111, 0.07, False),
        (0.173, 0.06, True),
        (0.3, 0.075, True),
        (0.45, 0.060, False),
        (0.6, 0.040, True),
        (0.9, 0.020, False),
        (1.2, 0.009, True),
    ):
        shift = round(delay * SAMPLE_RATE)
        source = harmony[:-shift, ::-1] if cross else harmony[:-shift]
        wet[shift:] += source * gain
    mix = harmony + wet + rhythm + atmosphere
    t = np.arange(count) / SAMPLE_RATE
    intro = np.minimum(t / 1.2, 1)
    end = np.minimum((DURATION - t) / 2.1, 1)
    mix *= (np.sin(intro * np.pi / 2) ** 2 * np.sin(end * np.pi / 2) ** 2)[:, None]
    mix -= np.mean(mix, axis=0)
    mix *= 0.77 / max(float(np.max(np.abs(mix))), 1e-9)
    return mix


def loudness_json(output: str) -> dict[str, str]:
    match = re.search(r'\{\s*"input_i".*?\}', output, re.DOTALL)
    if not match:
        raise RuntimeError(f"FFmpeg did not emit loudness analysis:\n{output[-4000:]}")
    return json.loads(match.group())


def ffmpeg(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostdin", *args],
        capture_output=True,
        text=True,
        check=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("reports/launch-video/score.wav"))
    args = parser.parse_args()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    mix = compose()
    with tempfile.TemporaryDirectory(prefix="devicebench-score-") as directory:
        raw = Path(directory) / "composition.wav"
        with wave.open(str(raw), "wb") as wav:
            wav.setnchannels(2)
            wav.setsampwidth(2)
            wav.setframerate(SAMPLE_RATE)
            wav.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
        tone = "highpass=f=28,lowpass=f=12500"
        analysis = ffmpeg(
            "-i",
            str(raw),
            "-af",
            f"{tone},loudnorm=I=-16:TP=-1:LRA=8:print_format=json",
            "-f",
            "null",
            "-",
        )
        stats = loudness_json(analysis.stderr)
        normalize = (
            "loudnorm=I=-16:TP=-1:LRA=8:linear=true:"
            f"measured_I={stats['input_i']}:measured_TP={stats['input_tp']}:"
            f"measured_LRA={stats['input_lra']}:measured_thresh={stats['input_thresh']}:"
            f"offset={stats['target_offset']}"
        )
        ffmpeg(
            "-y",
            "-i",
            str(raw),
            "-af",
            f"{tone},{normalize}",
            "-ar",
            str(SAMPLE_RATE),
            "-ac",
            "2",
            "-c:a",
            "pcm_s24le",
            "-metadata",
            "title=DeviceBench — Ready for local AI",
            "-metadata",
            "comment=Original procedural composition. No external samples.",
            str(args.out),
        )
    result = ffmpeg(
        "-i",
        str(args.out),
        "-af",
        "loudnorm=I=-16:TP=-1:LRA=8:print_format=json",
        "-f",
        "null",
        "-",
    )
    measured = loudness_json(result.stderr)
    print(
        json.dumps(
            {
                "output": str(args.out),
                "numpy": np.__version__,
                "duration_seconds": DURATION,
                "sample_rate": SAMPLE_RATE,
                "channels": 2,
                "bpm": BPM,
                "scene_seconds": SCENES,
                "integrated_lufs": float(measured["input_i"]),
                "true_peak_dbtp": float(measured["input_tp"]),
                "loudness_range_lu": float(measured["input_lra"]),
                "provenance": "Original synthesized composition; no external audio samples.",
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
