// Vite + Phaser 3.90 — 팀 FE develop 의 game/vite.config.ts 와 같은 구성 (테스트용이라 한 파일로 묶지는 않음)
// publicDir = assets/ : 애니메이션·섬·화면 설정 파일을 그대로 서빙 (주소 = assets/ 기준 경로, 예: animations/index.json)
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  publicDir: 'assets',
  server: { host: true, port: 5192 },
});
