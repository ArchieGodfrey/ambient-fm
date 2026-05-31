# Ambient Music PWA

An experimental iPhone-first Progressive Web App that generates evolving ambient soundscapes from a user's day.

The long-term vision is to create a "soundtrack of your life" by combining environmental stimuli, user mood inputs, contextual information, and local AI orchestration to generate personalized ambient music.

---

# Vision

Traditional music is static.

This project explores generating music that reflects:

- Mood
- Weather
- Location
- Daily events
- Photos
- Activity patterns
- User reflections

The system records stimuli throughout the day, builds a timeline of meaningful events, and uses a local language model to transform those events into a musical composition plan.

A generative audio engine then renders that plan into an evolving ambient soundtrack.

The goal is not AI-generated songs.

The goal is AI-directed generative soundscapes.

---

# Core Principles

## Local First

All user data should remain on-device whenever possible.

- Local storage
- Local AI inference
- Offline support
- No mandatory backend

## AI as Composer

The LLM does not generate audio.

The LLM acts as:

- Composer
- Conductor
- Arranger

Its responsibility is to create musical structure and direction.

## Generative Audio

Audio generation should be deterministic from a composition plan.

This allows:

- Replaying soundtracks
- Remixing sessions
- Exporting audio
- Exporting MIDI

## Incremental Complexity

The project should be developed in layers:

1. Music generation
2. Stimulus capture
3. AI planning
4. Advanced orchestration

Each layer should function independently.

---

# Architecture

```text
Stimulus Sources
        │
        ▼
Stimulus Timeline
        │
        ▼
AI Composition Planner
        │
        ▼
Composition Plan
        │
        ▼
Music Engine
        │
        ▼
Tone.js Audio Graph
        │
        ▼
Audio Output
```

---

# Technology Stack

## Frontend

- React
- TypeScript
- Vite
- Zustand

## Audio

- Tone.js

## AI

- WebLLM
- Gemma models

## Storage

- IndexedDB
- Dexie

## Deployment

- GitHub Pages

---

# Monorepo Structure

```text
ambient-music/

├── apps/
│   └── pwa/
│
├── packages/
│   ├── ai-engine/
│   ├── music-engine/
│   ├── stimulus-engine/
│   └── shared/
│
├── docs/
│
├── scripts/
│
├── pnpm-workspace.yaml
│
└── README.md
```

---

# Packages

## apps/pwa

Main user-facing application.

Responsibilities:

- UI
- Audio controls
- Stimulus capture
- Session playback
- Local storage
- Model management

---

## packages/shared

Shared types and utilities.

Examples:

```typescript
export interface StimulusEvent {}

export interface CompositionPlan {}

export interface DayTimeline {}
```

---

## packages/stimulus-engine

Responsible for collecting and normalizing stimulus data.

Sources may include:

- User mood input
- Weather
- Photos
- Calendar
- Location
- Manual notes

Output:

```typescript
StimulusEvent[]
```

---

## packages/ai-engine

Responsible for:

- Context generation
- Prompt building
- LLM orchestration
- Composition planning
- Session summaries

Input:

```typescript
DayTimeline
```

Output:

```typescript
CompositionPlan
```

---

## packages/music-engine

Responsible for:

- Chord generation
- Melody generation
- Ambient textures
- Sound scheduling
- Tone.js integration

Input:

```typescript
CompositionPlan
```

Output:

```typescript
AudioGraph
```

---

# Data Model

## Stimulus Event

```typescript
export interface StimulusEvent {
  id: string;
  timestamp: number;

  source:
    | "manual"
    | "weather"
    | "photo"
    | "calendar"
    | "location";

  vector: number[];

  metadata: Record<string, unknown>;
}
```

---

## Day Timeline

```typescript
export interface DayTimeline {
  date: string;
  stimuli: StimulusEvent[];
}
```

---

## Composition Plan

```typescript
export interface CompositionPlan {
  key: string;

  bpm: number;

  sections: CompositionSection[];
}
```

---

# Development Phases

## Phase 1 — Feasibility

Objective:

Validate critical technical assumptions.

### Success Criteria

- PWA installs on iPhone
- Tone.js audio works
- Background playback works
- WebLLM loads successfully
- Sessions persist in IndexedDB

---

## Phase 2 — Stimulus Timeline

Objective:

Create a timeline of meaningful daily events.

### Initial Sources

- Mood buttons
- Weather
- Imported photos

### Success Criteria

- Timeline storage
- Timeline browsing
- Stimulus replay

---

## Phase 3 — AI Composition Planner

Objective:

Generate musical structure from timeline data.

### Example

Input:

```text
09:00 Sunny
12:00 Focused
18:00 Rain
```

Output:

```json
{
  "key": "D Minor",
  "bpm": 72,
  "sections": [
    {
      "mood": "calm",
      "duration": 300
    }
  ]
}
```

---

## Phase 4 — Music Engine

Objective:

Transform composition plans into evolving soundscapes.

### Layers

- Drone
- Pad
- Melody
- Texture
- Rhythm

---

# Initial MVP

The first working version should support:

### Home Screen

```text
Today's Soundtrack

[Play]
[Pause]
```

### Stimulus Feed

```text
09:00 Happy
12:00 Focused
18:00 Rain
```

### Debug Screen

```text
Model Status
Memory Usage
Current Plan
Audio Status
```

---

# Initial End-to-End Flow

```text
User creates mood events
        │
        ▼
Timeline stored
        │
        ▼
AI generates composition plan
        │
        ▼
Music engine generates soundtrack
        │
        ▼
Audio plays
        │
        ▼
Session saved
```

---

# Future Ideas

## Environmental Audio Sampling

Allow users to import recordings from:

- Voice Memos
- External recorders
- Audio files

Samples can become source material for generated soundscapes.

---

## Replayable Days

Generate a soundtrack from an entire day and replay it later.

---

## Social Sharing

Share:

- Composition plans
- Session files
- Exported audio

Without requiring cloud infrastructure.
