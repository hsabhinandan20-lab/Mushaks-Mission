import Phaser from 'phaser';

export default class MainMenuScene extends Phaser.Scene {

  constructor() {
    super('MainMenuScene');
  }

  preload() {
    // Background
    this.load.image('menu_background', 'assets/home_screen.png');

    // Main menu graphics
    this.load.image('game_name', 'assets/game_name.png');
    this.load.image('play_button', 'assets/play_button.png');
    this.load.image('exit_button', 'assets/exit_button.png');

    // Mushak
    this.load.spritesheet('menu_mushak', 'assets/mushak.png', {
      frameWidth: 256,
      frameHeight: 256
    });
  }

  create() {

    this.isLeaving = false;

    // -----------------------------------
    // 1. Background
    // -----------------------------------
    this.createMenuBackground();

    // -----------------------------------
    // 2. Game Name
    // -----------------------------------
    this.gameName = this.add.image(0, 0, 'game_name');
    this.gameName.setOrigin(0.5);
    this.gameName.texture.setFilter(
      Phaser.Textures.FilterMode.NEAREST
    );

    // -----------------------------------
    // 3. Mushak
    // -----------------------------------
    this.menuMushak = this.add.sprite(
      0,
      0,
      'menu_mushak',
      0
    );

    this.menuMushak.setVisible(false);

    this.menuMushak.setOrigin(0.5);
    this.menuMushak.texture.setFilter(
      Phaser.Textures.FilterMode.NEAREST
    );

    // Small floating animation
    this.tweens.add({
      targets: this.menuMushak,
      y: '+=6',
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // -----------------------------------
    // 4. Play Button
    // -----------------------------------
    this.playButton = this.add.image(
      0,
      0,
      'play_button'
    );

    this.playButton.setOrigin(0.5);

    this.playButton.setInteractive({
      useHandCursor: true
    });

    this.setupButtonAnimation(
      this.playButton,
      () => {
        this.startGame();
      }
    );

    // -----------------------------------
    // 5. Exit Button
    // -----------------------------------
    this.exitButton = this.add.image(
      0,
      0,
      'exit_button'
    );

    this.exitButton.setOrigin(0.5);

    this.exitButton.setInteractive({
      useHandCursor: true
    });

    this.setupButtonAnimation(
      this.exitButton,
      () => {
        this.exitGame();
      }
    );

    // -----------------------------------
    // 6. Keyboard hint
    // -----------------------------------
    this.hintText = this.add.text(
      0,
      0,
      '',
      {
        fontFamily: 'Courier New, monospace',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#FFF1C7',
        stroke: '#1D170F',
        strokeThickness: 4
      }
    ).setOrigin(0.5);

    // -----------------------------------
    // 7. Keyboard controls
    // -----------------------------------


    // -----------------------------------
    // 8. Responsive layout
    // -----------------------------------
    this.scale.on(
      'resize',
      this.layoutMenu,
      this
    );

    this.layoutMenu();

    // Fade into menu
    this.cameras.main.fadeIn(
      500,
      0,
      0,
      0
    );
  }


  // =====================================================
  // BACKGROUND
  // =====================================================

  createMenuBackground() {

    this.menuBackground = this.add.image(
      0,
      0,
      'menu_background'
    );

    this.menuBackground.setOrigin(0.5);

    this.menuBackground.texture.setFilter(
      Phaser.Textures.FilterMode.NEAREST
    );

    // Slight dark overlay so the buttons/game name stand out
    this.menuDarkOverlay = this.add.rectangle(
      0,
      0,
      10,
      10,
      0x000000,
      0.12
    );

    this.menuDarkOverlay.setOrigin(0.5);
  }


  // =====================================================
  // BUTTON ANIMATION
  // =====================================================

  setupButtonAnimation(button, callback) {

    button.on('pointerover', () => {

      this.tweens.add({
        targets: button,
        scaleX: button.scaleX * 1.04,
        scaleY: button.scaleY * 1.04,
        duration: 120,
        ease: 'Quad.easeOut'
      });

    });


    button.on('pointerout', () => {

      this.tweens.add({
        targets: button,
        scaleX: button.scaleX / 1.04,
        scaleY: button.scaleY / 1.04,
        duration: 120,
        ease: 'Quad.easeOut'
      });

    });


    button.on('pointerdown', () => {

      this.tweens.add({
        targets: button,
        scaleX: button.scaleX * 0.94,
        scaleY: button.scaleY * 0.94,
        duration: 70,
        yoyo: true,
        ease: 'Quad.easeOut',
        onComplete: () => {
          callback();
        }
      });

    });
  }


  // =====================================================
  // RESPONSIVE LAYOUT
  // =====================================================

  layoutMenu() {

    const width = this.scale.width;
    const height = this.scale.height;


    // -----------------------------------
    // Background
    // -----------------------------------

    const bgScale = Math.max(
      width / 1672,
      height / 941
    );

    this.menuBackground.setPosition(
      width / 2,
      height / 2
    );

    this.menuBackground.setScale(
      bgScale
    );


    // -----------------------------------
    // Dark overlay
    // -----------------------------------

    this.menuDarkOverlay.setPosition(
      width / 2,
      height / 2
    );

    this.menuDarkOverlay.setSize(
      width,
      height
    );


    // -----------------------------------
    // GAME NAME
    // -----------------------------------

    // GAME NAME
    this.gameName.setPosition(
      width * 0.50,
      height * 0.24
    );

    const gameNameTargetWidth = Math.min(
      width * 0.46,
      760
    );

    const gameNameScale =
      gameNameTargetWidth /
      this.gameName.width;

    this.gameName.setScale(
      gameNameScale
    );


    // -----------------------------------
    // MUSHAK
    // -----------------------------------

    this.menuMushak.setPosition(
      width * 0.25,
      height * 0.73
    );

    const mushakScale = Math.min(
      width / 4000,
      height / 2200
    );

    this.menuMushak.setScale(
      Math.max(
        mushakScale,
        0.38
      )
    );


    // -----------------------------------
    // PLAY BUTTON
    // -----------------------------------

    // PLAY BUTTON
    this.playButton.setPosition(width / 2, height * 0.60);

    const playWidth = Math.min(
      width * 0.24,
      390
    );

    const playScale =
      playWidth /
      this.playButton.width;

    this.playButton.setScale(
      playScale
    );


    // -----------------------------------
    // EXIT BUTTON
    // -----------------------------------

    // EXIT BUTTON
    this.exitButton.setPosition(width / 2, height * 0.75);

    const exitWidth = Math.min(
      width * 0.24,
      390
    );

    const exitScale =
      exitWidth /
      this.exitButton.width;

    this.exitButton.setScale(
      exitScale
    );


    // -----------------------------------
    // HINT
    // -----------------------------------

    this.hintText.setPosition(
      width * 0.78,
      height * 0.91
    );

    this.hintText.setFontSize(
      Math.max(
        14,
        Math.min(
          20,
          width * 0.012
        )
      )
    );
  }


  // =====================================================
  // START GAME
  // =====================================================

  startGame() {

    if (this.isLeaving) {
      return;
    }

    this.isLeaving = true;

    this.cameras.main.fadeOut(
      550,
      0,
      0,
      0
    );

    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => {

        this.scene.start(
          'GameScene'
        );

      }
    );
  }


  // =====================================================
  // EXIT GAME
  // =====================================================

  exitGame() {

    if (this.isLeaving) {
      return;
    }

    this.isLeaving = true;

    this.cameras.main.fadeOut(
      500,
      0,
      0,
      0
    );

    this.time.delayedCall(
      550,
      () => {

        // Browsers usually prevent closing
        // tabs that were not opened by JavaScript.

        try {

          window.close();

        } catch (error) {

          console.log(
            'Browser prevented closing the window.'
          );

        }

      }
    );
  }
}