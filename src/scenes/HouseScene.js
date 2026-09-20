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
    this.load.text('collision_tmx', 'assets/collision.tmx');
    this.load.image('dialogueBox', 'assets/dialogue_box.png');
    this.load.image('dialogueBoy', 'assets/dialogue_boy.png');
    if (!this.textures.exists('collectible_flower')) this.load.image('collectible_flower', 'assets/flower.png');
    if (!this.textures.exists('collectible_durva')) this.load.image('collectible_durva', 'assets/dhruv.png');
    if (!this.textures.exists('collectible_banana')) this.load.image('collectible_banana', 'assets/banana.png');
    if (!this.textures.exists('heart')) this.load.image('heart', 'assets/heart.png');
    if (!this.textures.exists('heart_empty')) this.load.image('heart_empty', 'assets/heart_empty.png');

    if (!this.textures.exists('cat-sheet')) {
      this.load.spritesheet('cat-sheet', 'assets/cat-sheet.png', {
        frameWidth: 315,
        frameHeight: 311
      });
    }
  }

  createHouseCat() {

    const catPos = this.getMapScreenPos(1150, 500);

    // Create cat animations
    if (!this.anims.exists('house-cat-down')) {
      this.anims.create({
        key: 'house-cat-down',
        frames: this.anims.generateFrameNumbers('cat-sheet', {
          start: 0,
          end: 3
        }),
        frameRate: 8,
        repeat: -1
      });
    }

    if (!this.anims.exists('house-cat-up')) {
      this.anims.create({
        key: 'house-cat-up',
        frames: this.anims.generateFrameNumbers('cat-sheet', {
          start: 4,
          end: 7
        }),
        frameRate: 8,
        repeat: -1
      });
    }

    if (!this.anims.exists('house-cat-left')) {
      this.anims.create({
        key: 'house-cat-left',
        frames: this.anims.generateFrameNumbers('cat-sheet', {
          start: 8,
          end: 11
        }),
        frameRate: 8,
        repeat: -1
      });
    }

    if (!this.anims.exists('house-cat-right')) {
      this.anims.create({
        key: 'house-cat-right',
        frames: this.anims.generateFrameNumbers('cat-sheet', {
          start: 12,
          end: 15
        }),
        frameRate: 8,
        repeat: -1
      });
    }

    // Create actual cat from cat-sheet
    this.cat = this.physics.add.sprite(
      catPos.x,
      catPos.y,
      'cat-sheet',
      0
    );

    this.cat.setOrigin(0.5, 0.5);

    // Same size as garden cat
    this.cat.setScale(0.24);

    this.cat.texture.setFilter(
      Phaser.Textures.FilterMode.NEAREST
    );

    this.cat.setCollideWorldBounds(true);

    // Cat collision body
    this.cat.body.setSize(
      this.cat.width * 0.45,
      this.cat.height * 0.45,
      true
    );

    // Start facing down
    this.cat.anims.play('house-cat-down');
  }

  parseTiledCollisionMap() {
    let offsetX = 32;
    let offsetY = 20;

    let content = '';
    if (this.cache.text && this.cache.text.exists('collision_tmx')) {
      content = this.cache.text.get('collision_tmx');
    }

    const objects = [];

    if (content) {
      try {
        const parser = new window.DOMParser();
        const xmlDoc = parser.parseFromString(content, 'text/xml');

        // Read imagelayer offset
        const imgLayer = xmlDoc.querySelector('imagelayer[name="House Background"]') || xmlDoc.querySelector('imagelayer');
        if (imgLayer) {
          if (imgLayer.hasAttribute('offsetx')) {
            offsetX = parseFloat(imgLayer.getAttribute('offsetx'));
          }
          if (imgLayer.hasAttribute('offsety')) {
            offsetY = parseFloat(imgLayer.getAttribute('offsety'));
          }
        }

        // Read Collision objectgroup
        const collisionGroup = xmlDoc.querySelector('objectgroup[name="Collision"]') ||
          Array.from(xmlDoc.getElementsByTagName('objectgroup')).find(g => g.getAttribute('name') === 'Collision');

        if (collisionGroup) {
          const objElements = Array.from(collisionGroup.getElementsByTagName('object'));

          objElements.forEach(objEl => {
            const id = parseInt(objEl.getAttribute('id') || '0');
            let rawX = parseFloat(objEl.getAttribute('x') || '0');
            let rawY = parseFloat(objEl.getAttribute('y') || '0');
            let rawW = parseFloat(objEl.getAttribute('width') || '0');
            let rawH = parseFloat(objEl.getAttribute('height') || '0');

            const polyEl = objEl.querySelector('polygon');
            if (polyEl) {
              const ptsAttr = polyEl.getAttribute('points') || '';
              const pts = ptsAttr.trim().split(/\s+/).map(p => p.split(',').map(Number));
              let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
              pts.forEach(([px, py]) => {
                if (px < minX) minX = px;
                if (px > maxX) maxX = px;
                if (py < minY) minY = py;
                if (py > maxY) maxY = py;
              });
              rawX += minX;
              rawY += minY;
              rawW = maxX - minX;
              rawH = maxY - minY;
            }

            if (rawW > 0 && rawH > 0) {
              // Account for imagelayer offset (32, 20)
              const imgX = rawX - offsetX;
              const imgY = rawY - offsetY;

              // Center of rectangle in house.png (1672x941) coordinate space
              const origX = imgX + rawW / 2;
              const origY = imgY + rawH / 2;

              objects.push({
                id,
                name: `TMX Object #${id}`,
                origX,
                origY,
                origW: rawW,
                origH: rawH
              });
            }
          });
        }
      } catch (err) {
        console.warn('DOMParser failed to parse TMX XML:', err);
      }
    }

    return objects;
  }

  createObstacles() {
    this.debugColliders = false;
    this.obstacleObjects = [];

    // Parse TMX XML objects directly from collision.tmx using DOMParser
    const tmxObjects = this.parseTiledCollisionMap();

    tmxObjects.forEach(def => {
      const pos = this.getMapScreenPos(def.origX, def.origY);
      const gameObject = this.add.rectangle(
        pos.x, pos.y,
        def.origW * pos.scale, def.origH * pos.scale,
        0xFF0000, this.debugColliders ? 0.4 : 0
      );
      if (this.debugColliders) {
        gameObject.setStrokeStyle(2, 0xFF0000, 0.9);
      }
      this.physics.add.existing(gameObject, true);

      gameObject.obstacleDef = def;
      this.obstacles.add(gameObject);
      this.obstacleObjects.push(gameObject);
    });

    // F2 Key listener to toggle visual debug mode live
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-F2', () => {
        this.debugColliders = !this.debugColliders;
        this.obstacleObjects.forEach(obj => {
          obj.setFillStyle(0xFF0000, this.debugColliders ? 0.4 : 0);
          obj.setStrokeStyle(this.debugColliders ? 2 : 0, 0xFF0000, 0.9);
        });
      });
    }
  }

  create() {
    this.bananasCollected = 0;
    this.totalBananas = 3;
    this.isFading = false;
    this.isPromptOpen = false;
    this.isDialogueOpen = false;

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
    this.createHouseCat();

    // 6. Setup UI (Mission 3 objective & banana counter), top-right Health UI & pixel dialogue UI
    this.createUI();
    this.createHealthUI();
    this.createDialogueUI();

    // 7. Spawn 3 Banana collectibles
    this.createBananas();

    // 8. Enable physical collisions with solid obstacles
    this.physics.add.collider(this.player, this.obstacles);
    this.physics.add.collider(this.cat, this.obstacles);

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
    // Align player body circle with Mushak's feet/base (radius 45, offset X 83, offset Y 140)
    this.player.body.setCircle(45, 83, 140);

    this.lastDirection = 'up';
  }

  createUI() {
    const width = this.scale.width;
    const height = this.scale.height;

    // Compact Top-Left Pixel Art HUD Container
    this.hudContainer = this.add.container(16, 16);
    this.hudContainer.setScrollFactor(0);
    this.hudContainer.setDepth(1000);

    // 1. Pixel Art Outer Frame & Shadow
    const hudBg = this.add.graphics();
    hudBg.fillStyle(0x000000, 0.45);
    hudBg.fillRect(3, 3, 336, 40);
    hudBg.fillStyle(0x180D08, 0.95);
    hudBg.fillRect(0, 0, 336, 40);
    hudBg.fillStyle(0x2C1A10, 0.92);
    hudBg.fillRect(2, 2, 332, 36);
    hudBg.lineStyle(2, 0xC89632, 0.9);
    hudBg.strokeRect(3, 3, 330, 34);
    hudBg.fillStyle(0xFFE89C, 1);
    hudBg.fillRect(4, 4, 2, 2);
    hudBg.fillRect(329, 4, 2, 2);
    hudBg.fillRect(4, 33, 2, 2);
    hudBg.fillRect(329, 33, 2, 2);
    hudBg.lineStyle(1, 0x8B5E34, 0.6);
    hudBg.lineBetween(102, 6, 102, 33);
    this.hudContainer.add(hudBg);

    // 2. Mission Badge (Left Box)
    const badgeBg = this.add.graphics();
    badgeBg.fillStyle(0x5B3419, 1);
    badgeBg.fillRect(6, 6, 90, 28);
    badgeBg.lineStyle(1, 0xE5C158, 1);
    badgeBg.strokeRect(6, 6, 90, 28);
    this.hudContainer.add(badgeBg);

    this.missionBadgeText = this.add.text(51, 20, 'MISSION 3', {
      fontSize: '11px',
      fontFamily: 'Consolas, "Courier New", monospace, sans-serif',
      fontStyle: 'bold',
      fill: '#FFF3CD',
      stroke: '#180D08',
      strokeThickness: 3
    }).setOrigin(0.5);
    this.hudContainer.add(this.missionBadgeText);

    // 3. Flower Icon & Counter
    this.flowerHudIcon = this.add.image(114, 20, 'collectible_flower');
    this.flowerHudIcon.setDisplaySize(22, 22);
    if (this.flowerHudIcon.texture) {
      this.flowerHudIcon.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.hudContainer.add(this.flowerHudIcon);

    this.flowerHudText = this.add.text(129, 20, '3/3', {
      fontSize: '13px',
      fontFamily: 'Consolas, "Courier New", monospace, sans-serif',
      fontStyle: 'bold',
      fill: '#FFD700',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0, 0.5);
    this.hudContainer.add(this.flowerHudText);

    // 4. Durva Icon & Counter
    this.durvaHudIcon = this.add.image(184, 20, 'collectible_durva');
    this.durvaHudIcon.setDisplaySize(20, 22);
    if (this.durvaHudIcon.texture) {
      this.durvaHudIcon.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.hudContainer.add(this.durvaHudIcon);

    this.durvaHudText = this.add.text(198, 20, '3/3', {
      fontSize: '13px',
      fontFamily: 'Consolas, "Courier New", monospace, sans-serif',
      fontStyle: 'bold',
      fill: '#FFD700',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0, 0.5);
    this.hudContainer.add(this.durvaHudText);

    // 5. Banana Icon & Counter
    this.bananaHudIcon = this.add.image(252, 20, 'collectible_banana');
    this.bananaHudIcon.setDisplaySize(22, 20);
    if (this.bananaHudIcon.texture) {
      this.bananaHudIcon.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.hudContainer.add(this.bananaHudIcon);

    this.bananaHudText = this.add.text(268, 20, '0/3', {
      fontSize: '13px',
      fontFamily: 'Consolas, "Courier New", monospace, sans-serif',
      fontStyle: 'bold',
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0, 0.5);
    this.hudContainer.add(this.bananaHudText);

    // Legacy bridges
    this.objectiveText = { setText: () => { } };
    this.bananaCounterText = { setText: () => { } };

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

    this.updateHUD();
    this.createHealthUI();
  }

  createHealthUI() {
    const width = this.scale.width;
    if (this.registry.get('playerHealth') === undefined) {
      this.registry.set('playerHealth', 3);
    }

    // Compact Top-Right Pixel Art Health HUD Container
    this.healthHudContainer = this.add.container(width - 150, 16);
    this.healthHudContainer.setScrollFactor(0);
    this.healthHudContainer.setDepth(1000);

    // Pixel Art Outer Frame & Shadow
    const hudBg = this.add.graphics();
    hudBg.fillStyle(0x000000, 0.45);
    hudBg.fillRect(3, 3, 134, 40);
    hudBg.fillStyle(0x180D08, 0.95);
    hudBg.fillRect(0, 0, 134, 40);
    hudBg.fillStyle(0x2C1A10, 0.92);
    hudBg.fillRect(2, 2, 130, 36);
    hudBg.lineStyle(2, 0xC89632, 0.9);
    hudBg.strokeRect(3, 3, 128, 34);
    hudBg.fillStyle(0xFFE89C, 1);
    hudBg.fillRect(4, 4, 2, 2);
    hudBg.fillRect(127, 4, 2, 2);
    hudBg.fillRect(4, 33, 2, 2);
    hudBg.fillRect(127, 33, 2, 2);
    this.healthHudContainer.add(hudBg);

    this.heartSprites = [];
    const heartXPositions = [24, 67, 110];
    for (let i = 0; i < 3; i++) {
      const heart = this.add.image(heartXPositions[i], 20, 'heart');
      heart.setDisplaySize(22, 22);
      if (heart.texture) {
        heart.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
      this.healthHudContainer.add(heart);
      this.heartSprites.push(heart);
    }

    this.updateHealthHUD();
  }

  updateHealthHUD() {
    if (!this.healthHudContainer || !this.heartSprites) return;
    const currentHealth = this.registry.get('playerHealth') !== undefined ? this.registry.get('playerHealth') : 3;

    for (let i = 0; i < 3; i++) {
      const heart = this.heartSprites[i];
      if (i < currentHealth) {
        heart.setTexture('heart');
      } else {
        heart.setTexture('heart_empty');
      }
      heart.setDisplaySize(22, 22);
    }
  }

  resetCurrentMission() {
    this.registry.set('playerHealth', 3);
    this.bananasCollected = 0;
    this.collectibles.getChildren().forEach(item => {
      item.enableBody(true, item.x, item.y, true, true);
    });
    const spawnPos = this.getMapScreenPos(836, 800);
    this.player.setPosition(spawnPos.x, spawnPos.y);
    this.player.setVelocity(0, 0);
    this.updateHUD();
    this.updateHealthHUD();
  }

  updateHUD() {
    if (!this.hudContainer) return;

    const flowers = this.registry.get('flowersCollected') !== undefined ? this.registry.get('flowersCollected') : 3;
    const durva = this.registry.get('durvaCollected') !== undefined ? this.registry.get('durvaCollected') : 3;
    const bananas = this.bananasCollected || 0;

    this.registry.set('bananasCollected', bananas);

    this.flowerHudText.setText(`${flowers}/3`);
    this.flowerHudText.setFill(flowers >= 3 ? '#FFD700' : '#FFFFFF');

    this.durvaHudText.setText(`${durva}/3`);
    this.durvaHudText.setFill(durva >= 3 ? '#FFD700' : '#FFFFFF');

    this.bananaHudText.setText(`${bananas}/3`);
    if (bananas >= 3) {
      this.bananaHudText.setFill('#FFD700');
    } else {
      this.bananaHudText.setFill('#FFFFFF');
    }
  }

  createBananas() {
    if (this.textures.exists('collectible_banana')) {
      this.textures.get('collectible_banana').setFilter(Phaser.Textures.FilterMode.NEAREST);
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
      banana.setScale(0.12);
      banana.refreshBody();

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

    this.sound.play('collect_sound', {
      volume: 3
    });


    this.bananasCollected += 1;
    this.updateHUD();

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
        if (this.bannerText) this.bannerText.setVisible(false);
        this.showMissionDialogue("Thank you for playing!\nMore missions and exciting levels are coming in a future update!");
      });
    }
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
      fontSize: '38px',
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

    // 6. Update Central Completion Banner & Dialogue Container & Health HUD
    if (this.healthHudContainer) {
      this.healthHudContainer.setPosition(width - 150, 16);
    }
    if (this.bannerText) {
      this.bannerText.setPosition(width / 2, height / 2);
    }
    if (this.dialogueContainer) {
      this.updateDialogueScale();
    }
  }

  updateHouseCat() {
    if (!this.cat || !this.cat.body || !this.player) return;

    const catSpeed = 265;
    const stopDistance = 55;

    const dx = this.player.x - this.cat.x;
    const dy = this.player.y - this.cat.y;

    const distance = Math.sqrt(dx * dx + dy * dy);

    // Stop the cat when it gets close to Mushak
    if (distance <= stopDistance) {
      this.cat.setVelocity(0, 0);
      this.cat.anims.stop();

      return;
    }

    // Chase Mushak
    const direction = new Phaser.Math.Vector2(dx, dy).normalize();

    this.cat.setVelocity(
      direction.x * catSpeed,
      direction.y * catSpeed
    );

    // Play the correct walking animation
    const vx = this.cat.body.velocity.x;
    const vy = this.cat.body.velocity.y;

    if (Math.abs(vx) > Math.abs(vy)) {
      if (vx < 0) {
        this.cat.anims.play('house-cat-left', true);
      } else {
        this.cat.anims.play('house-cat-right', true);
      }
    } else {
      if (vy < 0) {
        this.cat.anims.play('house-cat-up', true);
      } else {
        this.cat.anims.play('house-cat-down', true);
      }
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

    const enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    const spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    enterKey.on('down', () => {
      if (this.isDialogueOpen) this.handleDialogueAdvance();
    });

    spaceKey.on('down', () => {
      if (this.isDialogueOpen) this.handleDialogueAdvance();
    });
  }

  update() {
    if (this.isFading || this.isDialogueOpen) {
      this.player.setVelocity(0, 0);

      if (this.cat) {
        this.cat.setVelocity(0, 0);
        this.cat.anims.stop();
      }

      return;
    }

    // Make the cat continuously chase Mushak
    this.updateHouseCat();

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
