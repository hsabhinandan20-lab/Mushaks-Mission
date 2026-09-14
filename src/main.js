import Phaser from 'phaser';
import GameScene from './scenes/GameScene.js';
import HouseScene from './scenes/HouseScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  render: {
    pixelArt: true
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scene: [GameScene, HouseScene]
};

const game = new Phaser.Game(config);

export default game;
