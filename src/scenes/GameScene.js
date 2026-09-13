import Phaser from 'phaser';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.currentMission = 1;

    // 1. Static physics group for solid obstacles (house, trees, fences)
    this.obstacles = this.physics.add.staticGroup();

    // 2. Generic physics group for all pickable collectibles
    this.collectibles = this.physics.add.group();

    // 3. Set physics world bounds to current scale viewport
    const width = this.scale.width;
    const height = this.scale.height;
    this.physics.world.setBounds(0, 0, width, height);

    // 4. Create visual elements & obstacles
    this.createBackground();
    this.createFlowerPatches();
    this.createFenceBoundary();
    this.createHouse();
    this.createTrees();

    // 5. Create Mushak (the player)
    this.createPlayer();

    // 6. Setup ingredient data registry & top-left UI
    this.createUI();

    // 7. Spawn collectible ingredients (Flowers and Durva)
    this.createCollectibles();

    // 8. Enable physical collisions with solid obstacles
    this.physics.add.collider(this.player, this.obstacles);

    // 9. Enable generic overlap handler for collecting ingredients
    this.physics.add.overlap(this.player, this.collectibles, this.collectItem, null, this);

    // 10. Set up keyboard movement controls (WASD + Arrow Keys)
    this.setupControls();

    // 11. Listen for real-time window resize events
    this.scale.on('resize', this.handleResize, this);
  }

  createBackground() {
    const width = this.scale.width;
    const height = this.scale.height;

    // Lawn rectangle covering 100% of the canvas
    this.lawn = this.add.rectangle(width / 2, height / 2, width, height, 0x4E9A34);

    // Sandy gravel pathway
    this.pathGraphics = this.add.graphics();
    this.drawPathway(width, height);
  }

  drawPathway(width, height) {
    const centerX = width / 2;
    const houseY = Math.max(380, height - 120);

    this.pathGraphics.clear();
    this.pathGraphics.fillStyle(0xD9B48F, 1);

    // Main walkway from top down to house door
    this.pathGraphics.fillRect(centerX - 40, 0, 80, houseY - 50);
    // Circular courtyard in front of house
    this.pathGraphics.fillCircle(centerX, houseY - 70, 60);

    // Grass tufts scattered dynamically
    this.pathGraphics.fillStyle(0x3B7A27, 0.6);
    const tuftPositions = [
      [width * 0.15, height * 0.25],
      [width * 0.25, height * 0.4],
      [width * 0.75, height * 0.22],
      [width * 0.85, height * 0.38],
      [width * 0.14, height * 0.68],
      [width * 0.33, height * 0.18],
      [width * 0.67, height * 0.18],
      [width * 0.86, height * 0.68]
    ];
    tuftPositions.forEach(([x, y]) => {
      this.pathGraphics.fillTriangle(x, y, x - 4, y + 10, x + 4, y + 10);
      this.pathGraphics.fillTriangle(x + 5, y - 2, x + 2, y + 10, x + 8, y + 10);
    });
  }

  createHouse() {
    const width = this.scale.width;
    const height = this.scale.height;
    const houseX = width / 2;
    const houseY = Math.max(380, height - 120);
    const houseWidth = 300;
    const houseHeight = 140;

    // Walls
    this.houseWalls = this.add.rectangle(houseX, houseY, houseWidth, houseHeight, 0xE5C39E);
    this.houseWalls.setStrokeStyle(3, 0x8B5A2B);

    // Roof
    this.houseRoof = this.add.polygon(houseX, houseY - 80, [
      0, 0,
      -170, 35,
      170, 35
    ], 0xC0392B);
    this.houseRoof.setStrokeStyle(3, 0x7B241C);

    // Door
    this.houseDoor = this.add.rectangle(houseX, houseY + 35, 50, 70, 0x5D4037);
    this.houseDoor.setStrokeStyle(2, 0x3E2723);
    this.doorKnob = this.add.circle(houseX + 16, houseY + 37, 4, 0xF1C40F);

    // Windows
    this.windowLeft = this.add.rectangle(houseX - 90, houseY - 10, 42, 42, 0xF1C40F);
    this.windowLeft.setStrokeStyle(2, 0x5D4037);
    this.windowRight = this.add.rectangle(houseX + 90, houseY - 10, 42, 42, 0xF1C40F);
    this.windowRight.setStrokeStyle(2, 0x5D4037);

    // Solid obstacle body for house
    this.houseCollider = this.add.rectangle(houseX, houseY, houseWidth, houseHeight);
    this.physics.add.existing(this.houseCollider, true);
    this.obstacles.add(this.houseCollider);
  }

  createTrees() {
    const width = this.scale.width;
    const height = this.scale.height;

    const treeCoords = [
      [Math.min(120, width * 0.1), 100],
      [width * 0.3, 90],
      [width * 0.7, 90],
      [Math.max(width - 120, width * 0.9), 100],
      [Math.min(100, width * 0.08), height * 0.5],
      [Math.max(width - 100, width * 0.92), height * 0.5],
      [Math.min(120, width * 0.1), Math.max(480, height - 120)],
      [Math.max(width - 120, width * 0.9), Math.max(480, height - 120)]
    ];

    treeCoords.forEach(([x, y]) => {
      const trunk = this.add.rectangle(x, y + 15, 22, 32, 0x5D4037);
      trunk.setStrokeStyle(2, 0x3E2723);

      const foliageBase = this.add.circle(x, y - 5, 36, 0x1E8449);
      foliageBase.setStrokeStyle(2, 0x145A32);
      this.add.circle(x - 5, y - 12, 24, 0x27AE60);

      const treeCollider = this.add.circle(x, y, 30);
      this.physics.add.existing(treeCollider, true);
      this.obstacles.add(treeCollider);
    });
  }

  createFenceBoundary() {
    const width = this.scale.width;
    const height = this.scale.height;
    const fenceColor = 0x8B5A2B;
    const postColor = 0x5D4037;

    this.topFence = this.add.rectangle(width / 2, 25, width - 60, 16, fenceColor);
    this.topFence.setStrokeStyle(2, postColor);
    this.physics.add.existing(this.topFence, true);
    this.obstacles.add(this.topFence);

    this.leftFence = this.add.rectangle(25, height / 2, 16, height - 50, fenceColor);
    this.leftFence.setStrokeStyle(2, postColor);
    this.physics.add.existing(this.leftFence, true);
    this.obstacles.add(this.leftFence);

    this.rightFence = this.add.rectangle(width - 25, height / 2, 16, height - 50, fenceColor);
    this.rightFence.setStrokeStyle(2, postColor);
    this.physics.add.existing(this.rightFence, true);
    this.obstacles.add(this.rightFence);

    this.fencePostsGroup = this.add.group();
    this.drawFencePosts(width);
  }

  drawFencePosts(width) {
    this.fencePostsGroup.clear(true, true);
    const postColor = 0x5D4037;
    for (let x = 60; x <= width - 60; x += 40) {
      const post = this.add.rectangle(x, 25, 8, 22, postColor);
      this.fencePostsGroup.add(post);
    }
  }

  createFlowerPatches() {
    const width = this.scale.width;
    const height = this.scale.height;

    const flowerBedsData = [
      { x: width * 0.25, y: height * 0.36, color: 0xFF8C00 },
      { x: width * 0.75, y: height * 0.36, color: 0xE74C3C },
      { x: width * 0.25, y: height * 0.72, color: 0xF1C40F },
      { x: width * 0.75, y: height * 0.72, color: 0xFF8C00 }
    ];

    flowerBedsData.forEach(bed => {
      this.add.ellipse(bed.x, bed.y, 70, 40, 0x6E2C00, 0.4);
      const offsets = [
        [-18, -6], [0, -9], [18, -5],
        [-12, 6], [12, 7], [0, 2]
      ];
      offsets.forEach(([dx, dy]) => {
        const flower = this.add.circle(bed.x + dx, bed.y + dy, 4, bed.color);
        flower.setStrokeStyle(1, 0xFFFFFF);
      });
    });
  }

  createPlayer() {
    const width = this.scale.width;
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    
    // Body
    graphics.fillStyle(0x999999, 1);
    graphics.fillCircle(16, 16, 14);

    // Ears
    graphics.fillStyle(0xFFB6C1, 1);
    graphics.fillCircle(8, 8, 5);
    graphics.fillCircle(24, 8, 5);

    // Nose
    graphics.fillStyle(0x333333, 1);
    graphics.fillCircle(16, 24, 3);

    graphics.generateTexture('mushak', 32, 32);
    graphics.destroy();

    // Spawn Mushak on central pathway at (width / 2, 180)
    this.player = this.physics.add.sprite(width / 2, 180, 'mushak');
    this.player.setCollideWorldBounds(true);
    this.player.body.setCircle(14, 2, 2);
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
    const width = this.scale.width;
    const height = this.scale.height;

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

    // 3. Flowers (Upper-left, Upper-right, Lower-left)
    const flowerPositions = [
      { x: width * 0.22, y: height * 0.28 },
      { x: width * 0.78, y: height * 0.28 },
      { x: width * 0.25, y: height * 0.78 }
    ];
    flowerPositions.forEach(pos => {
      this.spawnCollectible('flower', pos.x, pos.y, 'collectible_flower', true);
    });

    // 4. Durva items (Lower-right, Mid-left, Mid-right)
    const durvaPositions = [
      { x: width * 0.75, y: height * 0.78 },
      { x: width * 0.35, y: height * 0.45 },
      { x: width * 0.65, y: height * 0.45 }
    ];
    durvaPositions.forEach(pos => {
      this.spawnCollectible('durva', pos.x, pos.y, 'collectible_durva', false);
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

  checkMissionProgress(type) {
    const config = this.ingredientData[type];

    if (config.collected >= config.required) {
      if (type === 'flower') {
        this.bannerText.setText('Flowers collected!\nBappa needs Durva next! 🌿');
        this.bannerText.setVisible(true);

        this.time.delayedCall(2000, () => {
          this.bannerText.setVisible(false);
          this.startMission2();
        });
      } else if (type === 'durva') {
        this.bannerText.setText('Durva collected!\nBappa needs Bananas next! 🍌');
        this.bannerText.setVisible(true);
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

    // 2. Update Lawn & Pathway
    if (this.lawn) {
      this.lawn.setPosition(width / 2, height / 2).setSize(width, height);
    }
    if (this.pathGraphics) {
      this.drawPathway(width, height);
    }

    // 3. Update House Position & Body
    const houseX = width / 2;
    const houseY = Math.max(380, height - 120);
    if (this.houseWalls) {
      this.houseWalls.setPosition(houseX, houseY);
      this.houseRoof.setPosition(houseX, houseY - 80);
      this.houseDoor.setPosition(houseX, houseY + 35);
      this.doorKnob.setPosition(houseX + 16, houseY + 37);
      this.windowLeft.setPosition(houseX - 90, houseY - 10);
      this.windowRight.setPosition(houseX + 90, houseY - 10);
      if (this.houseCollider && this.houseCollider.body) {
        this.houseCollider.setPosition(houseX, houseY);
        this.houseCollider.body.updateFromGameObject();
      }
    }

    // 4. Update Fences
    if (this.topFence) {
      this.topFence.setPosition(width / 2, 25).setSize(width - 60, 16);
      if (this.topFence.body) this.topFence.body.updateFromGameObject();

      this.leftFence.setPosition(25, height / 2).setSize(16, height - 50);
      if (this.leftFence.body) this.leftFence.body.updateFromGameObject();

      this.rightFence.setPosition(width - 25, height / 2).setSize(16, height - 50);
      if (this.rightFence.body) this.rightFence.body.updateFromGameObject();

      this.drawFencePosts(width);
    }

    // 5. Update Central Victory Banner
    if (this.bannerText) {
      this.bannerText.setPosition(width / 2, height / 2);
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
  }

  update() {
    const speed = 250;

    this.player.setVelocity(0, 0);

    if (this.cursors.left.isDown || this.wasd.left.isDown) {
      this.player.setVelocityX(-speed);
    } else if (this.cursors.right.isDown || this.wasd.right.isDown) {
      this.player.setVelocityX(speed);
    }

    if (this.cursors.up.isDown || this.wasd.up.isDown) {
      this.player.setVelocityY(-speed);
    } else if (this.cursors.down.isDown || this.wasd.down.isDown) {
      this.player.setVelocityY(speed);
    }

    this.player.body.velocity.normalize().scale(speed);
  }
}
