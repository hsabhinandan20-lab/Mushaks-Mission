import Phaser from 'phaser';

export default class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
  }

  preload() {
    this.load.image('menu_background', 'assets/garden_map.png');
    this.load.spritesheet('menu_mushak', 'assets/mushak.png', {
      frameWidth: 256,
      frameHeight: 256
    });
  }

  create() {
    this.createMenuBackground();
    this.createTitleBanner();
    this.createMushak();
    this.createButtons();
    this.createHint();

    this.scale.on('resize', this.layoutMenu, this);
    this.layoutMenu();

    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  createMenuBackground() {
    this.menuBackground = this.add.image(0, 0, 'menu_background');
    this.menuBackground.setOrigin(0.5);
    this.menuBackground.setAlpha(0.7);
    this.menuBackground.setTint(0xDDE6B8);
    this.menuBackground.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);

    this.menuDarkOverlay = this.add.rectangle(0, 0, 10, 10, 0x11120d, 0.34);
    this.menuDarkOverlay.setOrigin(0.5);

    // A subtle dark strip makes the menu feel like a proper title screen.
    this.menuVignetteTop = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.18);
    this.menuVignetteTop.setOrigin(0.5);

    this.menuVignetteBottom = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.25);
    this.menuVignetteBottom.setOrigin(0.5);
  }

  createTitleBanner() {
    this.titleShadow = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.55);
    this.titleShadow.setOrigin(0.5);

    this.titleBanner = this.add.rectangle(0, 0, 10, 10, 0x7B542D, 1);
    this.titleBanner.setOrigin(0.5);
    this.titleBanner.setStrokeStyle(8, 0x3A2617, 1);

    this.titleBannerInner = this.add.rectangle(0, 0, 10, 10, 0xA9793F, 1);
    this.titleBannerInner.setOrigin(0.5);
    this.titleBannerInner.setStrokeStyle(3, 0xD6A85E, 1);

    this.titleText = this.add.text(0, 0, "MUSHAK'S MISSION", {
      fontFamily: 'Georgia, Times New Roman, serif',
      fontSize: '64px',
      fontStyle: 'bold',
      color: '#FFF1C7',
      stroke: '#3A2617',
      strokeThickness: 10,
      align: 'center'
    }).setOrigin(0.5);

    this.subtitleText = this.add.text(0, 0, 'A SMALL MOUSE. A BIG MISSION.', {
      fontFamily: 'Courier New, monospace',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#F6D98B',
      stroke: '#3A2617',
      strokeThickness: 5,
      align: 'center'
    }).setOrigin(0.5);
  }

  createMushak() {
    this.menuMushak = this.add.sprite(0, 0, 'menu_mushak', 0);
    this.menuMushak.setOrigin(0.5, 0.5);
    this.menuMushak.setScale(0.42);
    this.menuMushak.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);

    this.tweens.add({
      targets: this.menuMushak,
      y: '+=8',
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  createButtons() {
    this.playButton = this.createMenuButton('PLAY', () => {
      this.startGame();
    });

    this.exitButton = this.createMenuButton('EXIT', () => {
      this.exitGame();
    });
  }

  createMenuButton(label, callback) {
    const container = this.add.container(0, 0);

    const shadow = this.add.rectangle(0, 7, 360, 76, 0x000000, 0.5);
    shadow.setOrigin(0.5);

    const button = this.add.rectangle(0, 0, 360, 76, 0x6F4A2A, 1);
    button.setOrigin(0.5);
    button.setStrokeStyle(6, 0x352315, 1);
    button.setInteractive({ useHandCursor: true });

    const highlight = this.add.rectangle(0, -4, 330, 55, 0x9A6B38, 1);
    highlight.setOrigin(0.5);
    highlight.setStrokeStyle(2, 0xD7A75D, 1);
    highlight.setAlpha(0.9);

    const text = this.add.text(0, -3, label, {
      fontFamily: 'Courier New, monospace',
      fontSize: '40px',
      fontStyle: 'bold',
      color: '#FFF0C4',
      stroke: '#3A2617',
      strokeThickness: 7,
      align: 'center'
    }).setOrigin(0.5);

    container.add([shadow, button, highlight, text]);

    button.on('pointerover', () => {
      highlight.setFillStyle(0xC08A48, 1);
      container.setScale(1.04);
    });

    button.on('pointerout', () => {
      highlight.setFillStyle(0x9A6B38, 1);
      container.setScale(1);
    });

    button.on('pointerdown', () => {
      callback();
    });

    return container;
  }

  createHint() {
    this.hintText = this.add.text(0, 0, 'PRESS ENTER TO PLAY', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#FFF1C7',
      stroke: '#1D170F',
      strokeThickness: 4
    }).setOrigin(0.5);

    this.input.keyboard.on('keydown-ENTER', () => {
      if (!this.isLeaving) this.startGame();
    });

    this.input.keyboard.on('keydown-ESC', () => {
      if (!this.isLeaving) this.exitGame();
    });
  }

  layoutMenu() {
    const width = this.scale.width;
    const height = this.scale.height;
    const bgScale = Math.max(width / 1672, height / 941);

    this.menuBackground.setPosition(width / 2, height / 2);
    this.menuBackground.setScale(bgScale);

    this.menuDarkOverlay.setPosition(width / 2, height / 2);
    this.menuDarkOverlay.setSize(width, height);

    this.menuVignetteTop.setPosition(width / 2, height * 0.08);
    this.menuVignetteTop.setSize(width, height * 0.16);

    this.menuVignetteBottom.setPosition(width / 2, height * 0.93);
    this.menuVignetteBottom.setSize(width, height * 0.14);

    const bannerWidth = Math.min(width * 0.72, 900);
    const bannerHeight = Math.min(height * 0.24, 190);
    const bannerY = height * 0.19;

    this.titleShadow.setPosition(width / 2 + 8, bannerY + 10);
    this.titleShadow.setSize(bannerWidth, bannerHeight);

    this.titleBanner.setPosition(width / 2, bannerY);
    this.titleBanner.setSize(bannerWidth, bannerHeight);

    this.titleBannerInner.setPosition(width / 2, bannerY);
    this.titleBannerInner.setSize(bannerWidth - 18, bannerHeight - 18);

    const titleSize = Math.max(32, Math.min(64, width * 0.052));
    this.titleText.setFontSize(titleSize);
    this.titleText.setPosition(width / 2, bannerY - 18);

    const subtitleSize = Math.max(13, Math.min(22, width * 0.018));
    this.subtitleText.setFontSize(subtitleSize);
    this.subtitleText.setPosition(width / 2, bannerY + bannerHeight * 0.27);

    this.menuMushak.setPosition(width * 0.22, height * 0.64);
    this.menuMushak.setScale(Math.min(0.42, height / 1500));

    const buttonScale = Math.min(1, width / 1100, height / 800);
    this.playButton.setPosition(width / 2, height * 0.61);
    this.playButton.setScale(buttonScale);

    this.exitButton.setPosition(width / 2, height * 0.75);
    this.exitButton.setScale(buttonScale);

    this.hintText.setPosition(width / 2, height * 0.90);
  }

  startGame() {
    if (this.isLeaving) return;
    this.isLeaving = true;

    this.cameras.main.fadeOut(550, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('GameScene');
    });
  }

  exitGame() {
    if (this.isLeaving) return;
    this.isLeaving = true;

    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(550, () => {
      // Browsers normally block window.close() unless this tab was opened by script.
      // This still works when the game is packaged as a desktop app later.
      try {
        window.close();
      } catch (error) {
        console.log('Browser prevented closing the window.');
      }
    });
  }
}
