import type { MotionOptions, MotionController } from "./motion-runtime";
export type AlbumCoverTunnelOptions = MotionOptions & { images?: (string | { src: string; alt?: string })[]; paused?: boolean; autoTravel?: boolean; theme?: "dark" | "light"; active?: number; onSelect?: (index: number) => void; onProgress?: (percent: number) => void; onReady?: () => void; onError?: (message: string) => void };
export function mountAlbumCoverTunnel(target: HTMLElement, options?: AlbumCoverTunnelOptions): Omit<MotionController, "update"> & { update(options: AlbumCoverTunnelOptions): void };
