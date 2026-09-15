import Phaser from 'phaser';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  preload() {
    this.load.spritesheet('mushak', 'assets/mushak.png', {
      frameWidth: 256,
      frameHeight: 256
    });
    this.load.image('garden_map', 'assets/garden_map.png');
    this.load.image('dialogueBox', 'assets/dialogue_box.png');
    this.load.image('dialogueBoy', 'assets/dialogue_boy.png');
  }

  create() {
    this.currentMission = 1;
    this.doorActive = false;
    this.isPromptOpen = false;
    this.isFading = false;
    this.isDialogueOpen = false;

    // 1. Static physics group for solid obstacles (house, roof, shrine, trees, rocks, logs, lamps, crate, fences)
    this.obstacles = this.physics.add.staticGroup();

    // 2. Generic physics group for all pickable collectibles
    this.collectibles = this.physics.add.group();

    // 3. Set physics world bounds to current viewport
    const width = this.scale.width;
    const height = this.scale.height;
    this.physics.world.setBounds(0, 0, width, height);

    // 4. Create background map image, entrance trigger & collision obstacles
    this.createBackground();
    this.createDoorTrigger();
    this.createObstacles();

    // 5. Create Mushak (the player)
    this.createPlayer();

    // 6. Setup ingredient data registry, top-left UI, prompt overlay & pixel dialogue UI
    this.createUI();
    this.createPromptUI();
    this.createDialogueUI();

    // 7. Spawn collectible ingredients (Flowers and Durva)
    this.createCollectibles();

    // 8. Enable physical collisions with solid obstacles
    this.physics.add.collider(this.player, this.obstacles);

    // 9. Enable generic overlap handler for collecting ingredients
    this.physics.add.overlap(this.player, this.collectibles, this.collectItem, null, this);

    // 10. Enable door trigger overlap handler
    this.physics.add.overlap(this.player, this.doorTrigger, this.onDoorOverlap, null, this);

    // 11. Set up keyboard movement controls (WASD + Arrow Keys + Enter/Space)
    this.setupControls();

    // 12. Listen for real-time window resize events
    this.scale.on('resize', this.handleResize, this);

    // 13. Listen for scene wake when returning from HouseScene
    this.events.on('wake', () => {
      this.cameras.main.fadeIn(700, 0, 0, 0);
      this.isFading = false;
      this.isPromptOpen = false;
      this.isDialogueOpen = false;
      if (this.promptContainer) this.promptContainer.setVisible(false);
      if (this.dialogueContainer) this.dialogueContainer.setVisible(false);
      if (this.doorMarker) this.doorMarker.setVisible(true);
      if (this.objectiveText) this.objectiveText.setText('Go to the door to enter the house 🏠');
      const doorPos = this.getMapScreenPos(836, 860);
      this.player.setPosition(doorPos.x, doorPos.y);
    });
  }

  createBackground() {
    const width = this.scale.width;
    const height = this.scale.height;

    // Scale garden_map to cover viewport without black bars, letterboxing, or distortion
    const scale = Math.max(width / 1672, height / 941);

    this.bgMap = this.add.image(width / 2, height / 2, 'garden_map');
    this.bgMap.setScale(scale);
    this.bgMap.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  getMapScreenPos(origX, origY) {
    const width = this.scale.width;
    const height = this.scale.height;
    const scale = Math.max(width / 1672, height / 941);

    const x = width / 2 + (origX - 1672 / 2) * scale;
    const y = height / 2 + (origY - 941 / 2) * scale;

    return { x, y, scale };
  }

  createDoorTrigger() {
    const doorPos = this.getMapScreenPos(836, 830);

    // Glowing/pulsing yellow door marker
    this.doorMarker = this.add.circle(doorPos.x, doorPos.y, 22 * doorPos.scale, 0xFFD700, 0.7);
    this.doorMarker.setStrokeStyle(3, 0xFFFFFF);
    this.doorMarker.setVisible(false);

    this.tweens.add({
      targets: this.doorMarker,
      scaleX: 1.25,
      scaleY: 1.25,
      alpha: 0.4,
      duration: 750,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Physics trigger rectangle positioned over doorway
    this.doorTrigger = this.add.rectangle(doorPos.x, doorPos.y, 70 * doorPos.scale, 40 * doorPos.scale, 0x000000, 0);
    this.physics.add.existing(this.doorTrigger, true);
  }

  createPromptUI() {
    const width = this.scale.width;
    const height = this.scale.height;

    this.promptContainer = this.add.container(width / 2, height / 2);

    const box = this.add.image(0, 0, 'dialogueBox');
    box.setDisplaySize(760, 240);

    const title = this.add.text(0, -25, 'Enter the house? 🏠', {
      fontSize: '20px',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      fill: '#1a1a1a',
      align: 'center'
    }).setOrigin(0.5);

    const subtext = this.add.text(0, 25, 'Press ENTER or SPACE', {
      fontSize: '16px',
      fontFamily: 'monospace',
      fill: '#1a1a1a',
      align: 'center'
    }).setOrigin(0.5);

    const btn = this.add.rectangle(0, 45, 140, 34, 0xFFD700, 1);
    btn.setInteractive({ useHandCursor: true });

    const btnText = this.add.text(0, 45, 'Enter ➔', {
      fontSize: '16px',
      fontFamily: 'Segoe UI, sans-serif',
      fontStyle: 'bold',
      fill: '#1a1a2e'
    }).setOrigin(0.5);

    this.promptContainer.add([box, title, subtext, btn, btnText]);
    this.promptContainer.setDepth(100);
    this.promptContainer.setVisible(false);

    btn.on('pointerdown', () => this.confirmEnterHouse());
    box.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.confirmEnterHouse());
  }

  onDoorOverlap() {
    if (this.doorActive && !this.isPromptOpen && !this.isFading) {
      this.isPromptOpen = true;
      this.player.setVelocity(0, 0);
      this.player.anims.stop();

      const idleFrames = { down: 0, up: 4, left: 8, right: 12 };
      this.player.setFrame(idleFrames[this.lastDirection || 'down']);

      if (this.promptContainer) {
        this.promptContainer.setPosition(this.scale.width / 2, this.scale.height / 2);
        this.promptContainer.setVisible(true);
      }
    }
  }

  confirmEnterHouse() {
    if (!this.isPromptOpen || this.isFading) return;
    this.isFading = true;

    if (this.promptContainer) {
      this.promptContainer.setVisible(false);
    }

    this.cameras.main.fadeOut(700, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.isPromptOpen = false;
      this.scene.sleep('GameScene');
      this.scene.start('HouseScene');
    });
  }

  createObstacles() {
    this.obstacleDefinitions = [
      // 1. HOUSE (Roof, Chimney, Left Wall & Right Wall flanking central doorway)
      { type: 'rect', category: 'house', origX: 836, origY: 665, origW: 390, origH: 150, name: 'House Roof & Chimney' },
      { type: 'rect', category: 'house', origX: 715, origY: 750, origW: 145, origH: 170, name: 'House Left Wall' },
      { type: 'rect', category: 'house', origX: 957, origY: 750, origW: 145, origH: 170, name: 'House Right Wall' },

      // 2. WOODEN CRATE / BOX (Left Side of House)
      { type: 'rect', category: 'crate', origX: 605, origY: 825, origW: 50, origH: 50, name: 'Wooden Crate Left' },

      // 3. STREET LAMPS (Bottom-Left & Bottom-Right of House)
      { type: 'rect', category: 'lamp', origX: 318, origY: 800, origW: 40, origH: 90, name: 'Streetlamp Bottom Left' },
      { type: 'rect', category: 'lamp', origX: 1350, origY: 800, origW: 40, origH: 90, name: 'Streetlamp Bottom Right' },

      // 4. GANESH / BAPPA SHRINE (Top-Right)
      { type: 'rect', category: 'shrine', origX: 1350, origY: 290, origW: 240, origH: 260, name: 'Bappa Shrine Structure & Platform' },

      // 5. TREES (Physical footprint: Trunk + Canopy)
      { type: 'rect', category: 'tree', origX: 140, origY: 130, origW: 160, origH: 150, name: 'Tree TL1' },
      { type: 'rect', category: 'tree', origX: 530, origY: 130, origW: 160, origH: 150, name: 'Tree TL2' },
      { type: 'rect', category: 'tree', origX: 1130, origY: 130, origW: 160, origH: 150, name: 'Tree TR1' },
      { type: 'rect', category: 'tree', origX: 1520, origY: 130, origW: 160, origH: 150, name: 'Tree TR2' },
      { type: 'rect', category: 'tree', origX: 110, origY: 585, origW: 160, origH: 150, name: 'Tree ML' },
      { type: 'rect', category: 'tree', origX: 460, origY: 815, origW: 160, origH: 140, name: 'Tree BL' },
      { type: 'rect', category: 'tree', origX: 1240, origY: 825, origW: 160, origH: 140, name: 'Tree BR1' },
      { type: 'rect', category: 'tree', origX: 1550, origY: 810, origW: 160, origH: 140, name: 'Tree BR2' },
      { type: 'rect', category: 'tree', origX: 1550, origY: 595, origW: 160, origH: 150, name: 'Tree MR' },

      // 6. ROCKS / STONE CLUSTERS
      { type: 'rect', category: 'rock', origX: 100, origY: 335, origW: 90, origH: 60, name: 'Rock Cluster Top Left' },
      { type: 'rect', category: 'rock', origX: 1570, origY: 310, origW: 90, origH: 70, name: 'Rock Cluster Far Right' },
      { type: 'rect', category: 'rock', origX: 1465, origY: 730, origW: 80, origH: 55, name: 'Rock Cluster Bottom Right' },

      // 7. FALLEN BRANCHES / LOGS
      { type: 'rect', category: 'log', origX: 430, origY: 445, origW: 140, origH: 60, name: 'Log/Bench Mid Left' },
      { type: 'rect', category: 'log', origX: 430, origY: 365, origW: 110, origH: 65, name: 'Fallen Branch/Bush Mid Left' },

      // 8. BOUNDARY FENCES
      { type: 'rect', category: 'fence', origX: 410, origY: 35, origW: 760, origH: 40, name: 'Fence Top Left' },
      { type: 'rect', category: 'fence', origX: 1260, origY: 35, origW: 760, origH: 40, name: 'Fence Top Right' },
      { type: 'rect', category: 'fence', origX: 320, origY: 915, origW: 600, origH: 40, name: 'Fence Bottom Left' },
      { type: 'rect', category: 'fence', origX: 1340, origY: 915, origW: 600, origH: 40, name: 'Fence Bottom Right' },
      { type: 'rect', category: 'fence', origX: 35, origY: 470, origW: 40, origH: 900, name: 'Fence Left' },
      { type: 'rect', category: 'fence', origX: 1637, origY: 470, origW: 40, origH: 900, name: 'Fence Right' }
    ];

    this.obstacleObjects = [];

    this.obstacleDefinitions.forEach(def => {
      const pos = this.getMapScreenPos(def.origX, def.origY);
      const gameObject = this.add.rectangle(pos.x, pos.y, def.origW * pos.scale, def.origH * pos.scale, 0x000000, 0);
      this.physics.add.existing(gameObject, true);

      gameObject.obstacleDef = def;
      this.obstacles.add(gameObject);
      this.obstacleObjects.push(gameObject);
    });
  }

  updateObstaclesPositions() {
    this.obstacleObjects.forEach(obj => {
      const def = obj.obstacleDef;
      if (!def) return;

      const pos = this.getMapScreenPos(def.origX, def.origY);
      obj.setPosition(pos.x, pos.y);
      obj.setSize(def.origW * pos.scale, def.origH * pos.scale);
      if (obj.body) obj.body.updateFromGameObject();
    });
  }

  createPlayer() {
    const spawnPos = this.getMapScreenPos(836, 250);

    // Create 4 walking animations with a smooth 6 fps rate
    if (!this.anims.exists('mushak-down')) {
      this.anims.create({
        key: 'mushak-down',
        frames: this.anims.generateFrameNumbers('mushak', { start: 0, end: 3 }),
        frameRate: 6,
        repeat: -1
      });
    }

    if (!this.anims.exists('mushak-up')) {
      this.anims.create({
        key: 'mushak-up',
        frames: this.anims.generateFrameNumbers('mushak', { start: 4, end: 7 }),
        frameRate: 6,
        repeat: -1
      });
    }

    if (!this.anims.exists('mushak-left')) {
      this.anims.create({
        key: 'mushak-left',
        frames: this.anims.generateFrameNumbers('mushak', { start: 8, end: 11 }),
        frameRate: 6,
        repeat: -1
      });
    }

    if (!this.anims.exists('mushak-right')) {
      this.anims.create({
        key: 'mushak-right',
        frames: this.anims.generateFrameNumbers('mushak', { start: 12, end: 15 }),
        frameRate: 6,
        repeat: -1
      });
    }

    // Spawn single Mushak sprite facing down
    this.player = this.physics.add.sprite(spawnPos.x, spawnPos.y, 'mushak', 0);
    this.player.setScale(0.24);
    if (this.player.texture) {
      this.player.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.player.setCollideWorldBounds(true);
    this.player.body.setCircle(60, 68, 68);

    this.lastDirection = 'down';
  }

  createUI() {
    const width = this.scale.width;
    const height = this.scale.height;

    this.ingredientData = {
      flower: {
        name: 'Flowers',
        singularName: 'Flower',
        icon: '🌺',
        required: 3,
        collected: 0,
        active: true,
        uiText: null
      },
      durva: {
        name: 'Durva',
        singularName: 'Durva',
        icon: '🌿',
        required: 3,
        collected: 0,
        active: false,
        uiText: null
      }
    };

    // Objective Banner Text at top left
    this.objectiveText = this.add.text(20, 20, 'Mission 1: Collect 3 Flowers 🌺', {
      fontSize: '20px',
      fontFamily: 'Segoe UI, Tahoma, sans-serif',
      fontStyle: 'bold',
      fill: '#FFD700',
      backgroundColor: '#000000AA',
      padding: { x: 14, y: 8 }
    });

    // Counters
    let yOffset = 64;
    Object.keys(this.ingredientData).forEach(type => {
      const data = this.ingredientData[type];
      data.uiText = this.add.text(20, yOffset, `${data.name}: ${data.collected}/${data.required}`, {
        fontSize: '18px',
        fontFamily: 'Segoe UI, Tahoma, sans-serif',
        fontStyle: 'bold',
        fill: data.active ? '#FFFFFF' : '#888888',
        backgroundColor: '#00000099',
        padding: { x: 12, y: 6 }
      });
      yOffset += 40;
    });

    // Central Mission Banner centered dynamically
    this.bannerText = this.add.text(width / 2, height / 2, '', {
      fontSize: '28px',
      fontFamily: 'Segoe UI, Tahoma, sans-serif',
      fontStyle: 'bold',
      fill: '#FFD700',
      stroke: '#000000',
      strokeThickness: 5,
      backgroundColor: '#000000EE',
      padding: { x: 24, y: 14 },
      align: 'center'
    });
    this.bannerText.setOrigin(0.5);
    this.bannerText.setVisible(false);
  }

  createCollectibles() {
    // 1. Flower Texture
    const flowerGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    flowerGraphics.fillStyle(0xE91E63, 1);
    flowerGraphics.fillCircle(12, 6, 6);
    flowerGraphics.fillCircle(6, 12, 6);
    flowerGraphics.fillCircle(18, 12, 6);
    flowerGraphics.fillCircle(8, 18, 6);
    flowerGraphics.fillCircle(16, 18, 6);
    flowerGraphics.fillStyle(0xFFEB3B, 1);
    flowerGraphics.fillCircle(12, 12, 5);
    flowerGraphics.generateTexture('collectible_flower', 24, 24);
    flowerGraphics.destroy();

    // 2. Durva Grass Texture
    const durvaGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    durvaGraphics.fillStyle(0x2ECC71, 1);
    durvaGraphics.fillTriangle(6, 22, 4, 4, 12, 22);
    durvaGraphics.fillStyle(0x27AE60, 1);
    durvaGraphics.fillTriangle(12, 22, 12, 2, 18, 22);
    durvaGraphics.fillStyle(0x1E8449, 1);
    durvaGraphics.fillTriangle(16, 22, 20, 6, 22, 22);
    durvaGraphics.fillStyle(0xF1C40F, 1);
    durvaGraphics.fillRect(6, 16, 14, 3);
    durvaGraphics.generateTexture('collectible_durva', 24, 24);
    durvaGraphics.destroy();

    // 3. Flower positions on map (Upper-left, Upper-right, Lower-left)
    this.flowerDefs = [
      { origX: 380, origY: 280 },
      { origX: 1000, origY: 280 },
      { origX: 440, origY: 560 }
    ];
    this.flowerDefs.forEach(def => {
      const pos = this.getMapScreenPos(def.origX, def.origY);
      const item = this.spawnCollectible('flower', pos.x, pos.y, 'collectible_flower', true);
      item.origDef = def;
    });

    // 4. Durva positions on map (Shrine entrance, Mid-right, Lower-right)
    this.durvaDefs = [
      { origX: 1350, origY: 460 },
      { origX: 1100, origY: 600 },
      { origX: 1420, origY: 760 }
    ];
    this.durvaDefs.forEach(def => {
      const pos = this.getMapScreenPos(def.origX, def.origY);
      const item = this.spawnCollectible('durva', pos.x, pos.y, 'collectible_durva', false);
      item.origDef = def;
    });
  }

  updateCollectiblesPositions() {
    this.collectibles.getChildren().forEach(item => {
      if (item.origDef) {
        const pos = this.getMapScreenPos(item.origDef.origX, item.origDef.origY);
        item.setPosition(pos.x, pos.y);
      }
    });
  }

  spawnCollectible(type, x, y, textureKey, isActive = true) {
    const item = this.collectibles.create(x, y, textureKey);
    item.ingredientType = type;

    if (!isActive) {
      item.disableBody(true, true);
    }

    this.tweens.add({
      targets: item,
      y: y - 6,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    return item;
  }

  collectItem(player, item) {
    const type = item.ingredientType;
    const config = this.ingredientData[type];

    if (!config || !config.active) return;

    item.disableBody(true, true);
    config.collected += 1;

    if (config.uiText) {
      config.uiText.setText(`${config.name}: ${config.collected}/${config.required}`);
    }

    const popText = this.add.text(item.x, item.y - 10, `+1 ${config.singularName} ${config.icon}`, {
      fontSize: '16px',
      fontFamily: 'Segoe UI, sans-serif',
      fontStyle: 'bold',
      fill: '#FFEB3B',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    this.tweens.add({
      targets: popText,
      y: popText.y - 30,
      alpha: 0,
      duration: 900,
      ease: 'Power1',
      onComplete: () => popText.destroy()
    });

    this.checkMissionProgress(type);
  }

  createDialogueUI() {
    const width = this.scale.width;
    const height = this.scale.height;

    this.dialogueContainer = this.add.container(width / 2, height / 2);
    this.dialogueContainer.setDepth(2000);
    this.dialogueContainer.setVisible(false);

    // 1. Dialogue Box Image (centered inside container)
    this.dialogueBox = this.add.image(0, 0, 'dialogueBox');
    this.dialogueBox.setOrigin(0.5, 0.5);
    if (this.dialogueBox.texture) {
      this.dialogueBox.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    // 2. Dialogue Boy Image (positioned inside LEFT portion of dialogue box frame)
    this.dialogueBoy = this.add.image(-430, -5, 'dialogueBoy');
    this.dialogueBoy.setOrigin(0.5, 0.5);
    if (this.dialogueBoy.texture) {
      this.dialogueBoy.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    // 3. Dialogue Text (positioned inside RIGHT portion of dialogue box frame)
    this.dialogueText = this.add.text(-130, -100, '', {
      fontSize: '42px',
      fontFamily: "'Courier New', Consolas, Monaco, monospace",
      fontStyle: 'bold',
      fill: '#1a1a1a',
      stroke: '#1a1a1a',
      strokeThickness: 2,
      wordWrap: { width: 540, useAdvancedWrap: true },
      lineSpacing: 6
    });
    this.dialogueText.setOrigin(0, 0);

    this.dialogueContainer.add([this.dialogueBox, this.dialogueBoy, this.dialogueText]);
    this.updateDialogueScale();

    // Enable pointer/click interaction to advance or skip dialogue
    this.input.on('pointerdown', () => {
      if (this.isPromptOpen) return;
      if (this.isDialogueOpen) {
        this.handleDialogueAdvance();
      }
    });
  }

  updateDialogueScale() {
    if (!this.dialogueContainer) return;
    const width = this.scale.width;
    const height = this.scale.height;

    this.dialogueContainer.setPosition(width / 2, height / 2);

    const targetScale = Math.min(width * 0.85 / 1401, height * 0.55 / 793, 0.65);
    this.baseDialogueScale = targetScale;

    if (this.dialogueContainer.visible && !this.isDialogueAnimating) {
      this.dialogueContainer.setScale(targetScale);
    }
  }

  showMissionDialogue(message, onComplete) {
    if (!this.dialogueContainer) return;

    if (this.dialogueTimer) {
      this.dialogueTimer.remove();
      this.dialogueTimer = null;
    }
    if (this.dialogueAutoCloseTimer) {
      this.dialogueAutoCloseTimer.remove();
      this.dialogueAutoCloseTimer = null;
    }
    this.tweens.killTweensOf(this.dialogueContainer);
    this.tweens.killTweensOf(this.dialogueBoy);

    this.isDialogueOpen = true;
    this.isDialogueAnimating = true;
    this.currentDialogueFullText = message;
    this.onDialogueComplete = onComplete;
    this.isTypingComplete = false;

    if (this.player) {
      this.player.setVelocity(0, 0);
      this.player.anims.stop();
      const idleFrames = { down: 0, up: 4, left: 8, right: 12 };
      this.player.setFrame(idleFrames[this.lastDirection || 'down']);
    }

    const width = this.scale.width;
    const height = this.scale.height;
    const targetScale = Math.min(width * 0.85 / 1401, height * 0.55 / 793, 0.65);
    this.baseDialogueScale = targetScale;

    // Initial state: box container scale 0.2, alpha 0
    this.dialogueContainer.setPosition(width / 2, height / 2);
    this.dialogueContainer.setScale(targetScale * 0.2);
    this.dialogueContainer.setAlpha(0);
    this.dialogueContainer.setVisible(true);

    // Initial state: boy scale 0.2, alpha 0
    this.dialogueBoy.setScale(0.2);
    this.dialogueBoy.setAlpha(0);

    // Empty text initially
    this.dialogueText.setText('');

    // Phase 1: Dialogue box 250-350ms pop/zoom animation
    this.tweens.add({
      targets: this.dialogueContainer,
      scaleX: targetScale,
      scaleY: targetScale,
      alpha: 1,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Phase 2: Dialogue boy 200-300ms pop/fade animation starting AFTER box finishes
        this.tweens.add({
          targets: this.dialogueBoy,
          scaleX: 1,
          scaleY: 1,
          alpha: 1,
          duration: 250,
          ease: 'Back.easeOut',
          onComplete: () => {
            this.isDialogueAnimating = false;
            // Phase 3: Typewriter text character-by-character starting ONLY AFTER boy finishes
            this.startTypewriter(message);
          }
        });
      }
    });
  }

  startTypewriter(message) {
    let charIndex = 0;
    const totalChars = message.length;

    this.dialogueTimer = this.time.addEvent({
      delay: 40,
      repeat: totalChars - 1,
      callback: () => {
        charIndex++;
        this.dialogueText.setText(message.substring(0, charIndex));
        if (charIndex >= totalChars) {
          this.onTypewriterComplete();
        }
      }
    });
  }

  onTypewriterComplete() {
    this.isTypingComplete = true;

    if (this.dialogueAutoCloseTimer) {
      this.dialogueAutoCloseTimer.remove();
    }
    this.dialogueAutoCloseTimer = this.time.delayedCall(2500, () => {
      this.closeMissionDialogue();
    });
  }

  closeMissionDialogue() {
    if (!this.isDialogueOpen) return;

    if (this.dialogueTimer) {
      this.dialogueTimer.remove();
      this.dialogueTimer = null;
    }
    if (this.dialogueAutoCloseTimer) {
      this.dialogueAutoCloseTimer.remove();
      this.dialogueAutoCloseTimer = null;
    }

    this.isDialogueAnimating = true;

    this.tweens.add({
      targets: this.dialogueContainer,
      scaleX: this.baseDialogueScale * 0.8,
      scaleY: this.baseDialogueScale * 0.8,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.dialogueContainer.setVisible(false);
        this.isDialogueOpen = false;
        this.isDialogueAnimating = false;

        const cb = this.onDialogueComplete;
        this.onDialogueComplete = null;
        if (cb) cb();
      }
    });
  }

  handleDialogueAdvance() {
    if (!this.isDialogueOpen || this.isDialogueAnimating) return;

    if (!this.isTypingComplete) {
      if (this.dialogueTimer) {
        this.dialogueTimer.remove();
        this.dialogueTimer = null;
      }
      this.dialogueText.setText(this.currentDialogueFullText);
      this.onTypewriterComplete();
    } else {
      this.closeMissionDialogue();
    }
  }

  checkMissionProgress(type) {
    const config = this.ingredientData[type];

    if (config && config.collected >= config.required) {
      if (this.bannerText) this.bannerText.setVisible(false);

      if (type === 'flower') {
        this.showMissionDialogue("You collected the flowers!\nNow collect some Durva!", () => {
          this.startMission2();
        });
      } else if (type === 'durva') {
        this.showMissionDialogue("Great! You collected the Durva!\nNow get inside the house to collect some Bananas!", () => {
          this.objectiveText.setText('Go to the door to enter the house 🏠');
          this.doorActive = true;
          if (this.doorMarker) this.doorMarker.setVisible(true);
        });
      } else if (type === 'banana' || type === 'bananas') {
        this.showMissionDialogue("Awesome! You collected the bananas!\nNow go to the house!", () => {
          this.objectiveText.setText('Go to the door to enter the house 🏠');
          this.doorActive = true;
          if (this.doorMarker) this.doorMarker.setVisible(true);
        });
      }
    }
  }

  startMission2() {
    this.currentMission = 2;

    const durvaConfig = this.ingredientData.durva;
    durvaConfig.active = true;

    if (durvaConfig.uiText) {
      durvaConfig.uiText.setFill('#FFD700');
    }

    this.objectiveText.setText('Mission 2: Collect 3 Durva 🌿');

    this.collectibles.getChildren().forEach(item => {
      if (item.ingredientType === 'durva') {
        item.enableBody(true, item.x, item.y, true, true);
      }
    });
  }

  handleResize(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;

    // 1. Update Physics World Bounds
    this.physics.world.setBounds(0, 0, width, height);
    if (this.player) {
      this.player.setCollideWorldBounds(true);
    }

    // 2. Update Map Image Scale
    if (this.bgMap) {
      const scale = Math.max(width / 1672, height / 941);
      this.bgMap.setPosition(width / 2, height / 2).setScale(scale);
    }

    // 3. Update Obstacle Colliders
    this.updateObstaclesPositions();

    // 4. Update Collectible Positions
    this.updateCollectiblesPositions();

    // 5. Update Door Trigger & Marker Position & Size
    if (this.doorTrigger) {
      const doorPos = this.getMapScreenPos(836, 830);
      this.doorTrigger.setPosition(doorPos.x, doorPos.y);
      this.doorTrigger.setSize(70 * doorPos.scale, 40 * doorPos.scale);
      if (this.doorTrigger.body) this.doorTrigger.body.updateFromGameObject();

      if (this.doorMarker) {
        this.doorMarker.setPosition(doorPos.x, doorPos.y);
        this.doorMarker.setRadius(22 * doorPos.scale);
      }
    }

    // 6. Update Banners & Prompts & Dialogue Container
    if (this.bannerText) {
      this.bannerText.setPosition(width / 2, height / 2);
    }
    if (this.promptContainer) {
      this.promptContainer.setPosition(width / 2, height / 2);
    }
    if (this.dialogueContainer) {
      this.updateDialogueScale();
    }
  }

  setupControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      right: Phaser.Input.Keyboard.KeyCodes.D
    });

    this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.enterKey.on('down', () => {
      if (this.isPromptOpen) this.confirmEnterHouse();
      else if (this.isDialogueOpen) this.handleDialogueAdvance();
    });

    this.spaceKey.on('down', () => {
      if (this.isPromptOpen) this.confirmEnterHouse();
      else if (this.isDialogueOpen) this.handleDialogueAdvance();
    });
  }

  update() {
    if (this.isPromptOpen || this.isFading || this.isDialogueOpen) {
      this.player.setVelocity(0, 0);
      return;
    }

    const speed = 250;

    let vx = 0;
    let vy = 0;

    if (this.cursors.left.isDown || this.wasd.left.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.wasd.right.isDown) vx += 1;
    if (this.cursors.up.isDown || this.wasd.up.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.wasd.down.isDown) vy += 1;

    if (vx !== 0 || vy !== 0) {
      let animKey = 'mushak-down';
      let dir = 'down';

      if (vx < 0) {
        animKey = 'mushak-left';
        dir = 'left';
      } else if (vx > 0) {
        animKey = 'mushak-right';
        dir = 'right';
      } else if (vy < 0) {
        animKey = 'mushak-up';
        dir = 'up';
      } else if (vy > 0) {
        animKey = 'mushak-down';
        dir = 'down';
      }

      this.player.anims.play(animKey, true);
      this.lastDirection = dir;

      const vec = new Phaser.Math.Vector2(vx, vy).normalize().scale(speed);
      this.player.setVelocity(vec.x, vec.y);
    } else {
      this.player.setVelocity(0, 0);
      this.player.anims.stop();

      const idleFrames = {
        down: 0,
        up: 4,
        left: 8,
        right: 12
      };
      this.player.setFrame(idleFrames[this.lastDirection || 'down']);
    }
  }
}
