import Phaser from 'phaser';

export default class HouseScene extends Phaser.Scene {
  constructor() {
    super('HouseScene');
  }

  preload() {
    if (!this.textures.exists('mushak')) {
      this.load.spritesheet('mushak', 'assets/mushak.png', {
        frameWidth: 256,
        frameHeight: 256
      });
    }
    this.load.image('house_map', 'assets/house.png');
  }

  create() {
    this.bananasCollected = 0;
    this.totalBananas = 3;
    this.isFading = false;
    this.isPromptOpen = false;

    // Fade camera in from black
    this.cameras.main.fadeIn(700, 0, 0, 0);

    // 1. Static physics group for solid interior obstacles
    this.obstacles = this.physics.add.staticGroup();

    // 2. Generic physics group for bananas
    this.collectibles = this.physics.add.group();

    // 3. Set physics world bounds to current viewport
    const width = this.scale.width;
    const height = this.scale.height;
    this.physics.world.setBounds(0, 0, width, height);

    // 4. Create background map image, collision obstacles & exit trigger
    this.createBackground();
    this.createObstacles();
    this.createExitTrigger();

    // 5. Create Mushak (the player) at bottom-center entrance
    this.createPlayer();

    // 6. Setup UI (Mission 3 objective & banana counter)
    this.createUI();

    // 7. Spawn 3 Banana collectibles
    this.createBananas();

    // 8. Enable physical collisions with solid obstacles
    this.physics.add.collider(this.player, this.obstacles);

    // 9. Enable overlap handler for collecting bananas
    this.physics.add.overlap(this.player, this.collectibles, this.collectBanana, null, this);

    // 10. Enable overlap handler for exit doorway
    this.physics.add.overlap(this.player, this.exitTrigger, this.handleExitDoor, null, this);

    // 11. Set up keyboard movement controls
    this.setupControls();

    // 12. Listen for real-time window resize events
    this.scale.on('resize', this.handleResize, this);
  }

  createBackground() {
    const width = this.scale.width;
    const height = this.scale.height;

    // Scale house_map to cover viewport without black bars, letterboxing, or distortion
    const scale = Math.max(width / 1672, height / 941);

    this.bgMap = this.add.image(width / 2, height / 2, 'house_map');
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

  createObstacles() {
    this.obstacleDefinitions = [
      // 1. OUTER WALLS (Top, Left, Right, Bottom Left, Bottom Right)
      { type: 'rect', origX: 836, origY: 60, origW: 1672, origH: 120, name: 'Top Wall Border' },
      { type: 'rect', origX: 30, origY: 470, origW: 60, origH: 941, name: 'Left Wall' },
      { type: 'rect', origX: 1642, origY: 470, origW: 60, origH: 941, name: 'Right Wall' },
      { type: 'rect', origX: 300, origY: 925, origW: 540, origH: 35, name: 'Bottom Wall Left' },
      { type: 'rect', origX: 1370, origY: 925, origW: 540, origH: 35, name: 'Bottom Wall Right' },

      // 2. ENTRANCE PILLARS & PLANTS (Full width including leaves)
      { type: 'rect', origX: 630, origY: 885, origW: 130, origH: 110, name: 'Left Pillar & Potted Plant' },
      { type: 'rect', origX: 1040, origY: 885, origW: 130, origH: 110, name: 'Right Pillar & Potted Plant' },

      // 3. KITCHEN GREY STOVE / SLAB (Extended full slab area)
      { type: 'rect', origX: 280, origY: 275, origW: 330, origH: 140, name: 'Kitchen Stove & Grey Slab' },
      { type: 'rect', origX: 280, origY: 130, origW: 240, origH: 60, name: 'Kitchen Wall Shelf' },

      // 4. GANESHA SHRINE (Top-Center)
      { type: 'rect', origX: 836, origY: 200, origW: 300, origH: 140, name: 'Ganesha Shrine Altar' },

      // 5. KITCHEN SHELVES & TALL WARDROBE (Top-Right)
      { type: 'rect', origX: 1180, origY: 200, origW: 230, origH: 130, name: 'Kitchen Storage Shelves' },
      { type: 'rect', origX: 1325, origY: 240, origW: 60, origH: 80, name: 'Small Plant Table' },
      { type: 'rect', origX: 1470, origY: 200, origW: 140, origH: 170, name: 'Tall Storage Wardrobe' },
      { type: 'rect', origX: 1520, origY: 270, origW: 80, origH: 100, name: 'Top Right Potted Plant' },

      // 6. DINING TABLE & BENCHES (Extended to cover entire table set)
      { type: 'rect', origX: 285, origY: 510, origW: 360, origH: 190, name: 'Dining Table, Benches & Stool' },

      // 7. BED / COT & NIGHTSTAND ONLY (Excludes sleeping mat to the left)
      { type: 'rect', origX: 1500, origY: 560, origW: 160, origH: 220, name: 'Bed Cot & Side Table' },

      // 8. BOTTOM-LEFT FURNITURE (Plant, chest & jar, excludes bottom-left carpet)
      { type: 'rect', origX: 115, origY: 770, origW: 170, origH: 200, name: 'Bottom Left Pots & Cabinet' },

      // 9. BOTTOM-RIGHT FURNITURE (Nightstand & plant, excludes bottom-right carpet)
      { type: 'rect', origX: 1560, origY: 820, origW: 120, origH: 150, name: 'Bottom Right Nightstand & Plant' }
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

  createExitTrigger() {
    const exitPos = this.getMapScreenPos(836, 910);
    this.exitTrigger = this.add.rectangle(exitPos.x, exitPos.y, 160 * exitPos.scale, 40 * exitPos.scale, 0x000000, 0);
    this.physics.add.existing(this.exitTrigger, true);
  }

  createPlayer() {
    const spawnPos = this.getMapScreenPos(836, 810);

    // Reuse existing Mushak animations if already created, or create them
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

    // Spawn single Mushak sprite inside house facing up into the room
    this.player = this.physics.add.sprite(spawnPos.x, spawnPos.y, 'mushak', 4);
    this.player.setScale(0.24);
    if (this.player.texture) {
      this.player.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.player.setCollideWorldBounds(true);
    this.player.body.setCircle(60, 68, 68);

    this.lastDirection = 'up';
  }

  createUI() {
    const width = this.scale.width;
    const height = this.scale.height;

    // Objective Banner Text at top left
    this.objectiveText = this.add.text(20, 20, 'Mission 3: Collect 3 Bananas 🍌', {
      fontSize: '20px',
      fontFamily: 'Segoe UI, Tahoma, sans-serif',
      fontStyle: 'bold',
      fill: '#FFD700',
      backgroundColor: '#000000AA',
      padding: { x: 14, y: 8 }
    });

    // Counter Text
    this.bananaCounterText = this.add.text(20, 64, `Bananas: ${this.bananasCollected}/${this.totalBananas}`, {
      fontSize: '18px',
      fontFamily: 'Segoe UI, Tahoma, sans-serif',
      fontStyle: 'bold',
      fill: '#FFFFFF',
      backgroundColor: '#00000099',
      padding: { x: 12, y: 6 }
    });

    // Central Mission Completion Banner centered dynamically
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

  createBananas() {
    // Generate crisp 28x28 pixel banana texture
    if (!this.textures.exists('collectible_banana')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      
      // Outer peel (bright yellow curved shape)
      g.fillStyle(0xFFD700, 1);
      g.fillCircle(14, 14, 10);
      g.fillStyle(0x332200, 1); // inner cut-out for crescent curve
      g.fillCircle(10, 10, 8);
      
      // Restore yellow body
      g.fillStyle(0xFFEB3B, 1);
      g.fillCircle(15, 15, 7);
      
      // Stem / tips (green/brown)
      g.fillStyle(0x4AF0300, 1);
      g.fillRect(20, 6, 4, 4);
      g.fillRect(6, 20, 4, 4);

      g.generateTexture('collectible_banana', 28, 28);
      g.destroy();
    }

    // Banana spawn coordinates on floor (walkable positions)
    this.bananaDefs = [
      { origX: 535, origY: 360 },
      { origX: 1150, origY: 360 },
      { origX: 1140, origY: 730 }
    ];

    this.bananaDefs.forEach(def => {
      const pos = this.getMapScreenPos(def.origX, def.origY);
      const banana = this.collectibles.create(pos.x, pos.y, 'collectible_banana');
      banana.origDef = def;

      // Floating idle animation
      this.tweens.add({
        targets: banana,
        y: pos.y - 6,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    });
  }

  updateBananasPositions() {
    this.collectibles.getChildren().forEach(item => {
      if (item.origDef) {
        const pos = this.getMapScreenPos(item.origDef.origX, item.origDef.origY);
        item.setPosition(pos.x, pos.y);
      }
    });
  }

  collectBanana(player, banana) {
    if (!banana.active) return;

    banana.disableBody(true, true);
    this.bananasCollected += 1;

    this.bananaCounterText.setText(`Bananas: ${this.bananasCollected}/${this.totalBananas}`);

    // Polished floating pickup text animation "+1 Banana 🍌"
    const popText = this.add.text(banana.x, banana.y - 10, '+1 Banana 🍌', {
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

    if (this.bananasCollected >= this.totalBananas) {
      this.time.delayedCall(300, () => {
        this.bannerText.setText('Bananas collected! 🍌\nBappa needs Coconuts next! 🥥');
        this.bannerText.setVisible(true);
      });
    }
  }

  handleExitDoor() {
    if (this.isFading) return;
    this.isFading = true;

    this.player.setVelocity(0, 0);
    this.player.anims.stop();

    this.cameras.main.fadeOut(700, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('HouseScene');
      this.scene.wake('GameScene');
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

    // 4. Update Banana Positions
    this.updateBananasPositions();

    // 5. Update Exit Trigger Position & Size
    if (this.exitTrigger) {
      const exitPos = this.getMapScreenPos(836, 910);
      this.exitTrigger.setPosition(exitPos.x, exitPos.y);
      this.exitTrigger.setSize(160 * exitPos.scale, 40 * exitPos.scale);
      if (this.exitTrigger.body) this.exitTrigger.body.updateFromGameObject();
    }

    // 6. Update Central Completion Banner
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
    if (this.isFading) {
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
