/// <reference types="vite/client" />

interface ThreeGameDiagnostics {
  frame: number;
  phase: string;
  quest: { kind: string; target: string; collected: number } | null;
  completedQuests: number;
  creatures: number;
  worldObjects: number;
  player: {
    position: { x: number; y: number; z: number };
    speed: number;
  };
  renderer: {
    calls: number;
    triangles: number;
    geometries: number;
    textures: number;
  };
  canvas: {
    clientWidth: number;
    clientHeight: number;
    width: number;
    height: number;
    dpr: number;
  };
}

interface Window {
  __THREE_GAME_DIAGNOSTICS__?: ThreeGameDiagnostics;
}
