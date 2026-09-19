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
    this.load.text('garden_collision_tmx', 'assets/GardenCollision.tmx');
    this.load.image('dialogueBox', 'assets/dialogue_box.png');
    this.load.image('dialogueBoy', 'assets/dialogue_boy.png');
    this.load.image('collectible_flower', 'assets/flower.png');
    this.load.image('collectible_durva', 'assets/dhruv.png');
    this.load.image('collectible_banana', 'assets/banana.png');
    this.load.spritesheet('cat-sheet', 'assets/cat-sheet.png', {
      frameWidth: 315,
      frameHeight: 311
    });
    this.load.image('heart', 'assets/heart.png');
    this.load.image('heart_empty', 'assets/heart_empty.png');
    this.load.image('game-over-panel', 'assets/game-over-panel.png');
  }

  create() {
    this.currentMission = 1;
    this.doorActive = false;
    this.isPromptOpen = false;
    this.isFading = false;
    this.isDialogueOpen = false;
    this.isGameOver = false;

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

    // 6. Setup ingredient data registry, top-left UI, top-right Health UI, prompt overlay & pixel dialogue UI
    this.createUI();
    this.createHealthUI();
    this.createPromptUI();
    this.createDialogueUI();
    this.createGameOverUI();

    // 7. Spawn collectible ingredients (Flowers and Durva)
    this.createCollectibles();

    // 7b. Spawn stationary Cat NPC in the garden
    this.createCat();

    // 8. Enable physical collisions with solid obstacles
    this.physics.add.collider(this.player, this.obstacles);
    this.physics.add.collider(this.cat, this.obstacles);

    // 8b. Enable cat-vs-player damage overlap listener
    this.setupCatCollision();

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
      this.updateHUD();
      this.updateHealthHUD();
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
    this.promptContainer.setDepth(2000);
    this.promptContainer.setVisible(false);

    // 1. Dialogue Box Image (centered)
    this.promptBox = this.add.image(0, 0, 'dialogueBox');
    this.promptBox.setOrigin(0.5, 0.5);
    if (this.promptBox.texture) {
      this.promptBox.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.promptBox.setInteractive({ useHandCursor: true });
    this.promptBox.on('pointerdown', () => {
      if (this.isPromptOpen && !this.isFading && !this.isGameOver) {
        this.confirmEnterHouse();
      }
    });

    // 2. Dialogue Boy Image (left section)
    this.promptBoy = this.add.image(-430, -5, 'dialogueBoy');
    this.promptBoy.setOrigin(0.5, 0.5);
    if (this.promptBoy.texture) {
      this.promptBoy.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    // 3. Dialogue Text (centered inside cream right section)
    this.promptText = this.add.text(140, -10, '', {
      fontSize: '40px',
      fontFamily: "'Courier New', Consolas, Monaco, monospace",
      fontStyle: 'bold',
      fill: '#1a1a1a',
      stroke: '#1a1a1a',
      strokeThickness: 1,
      align: 'center',
      wordWrap: { width: 520, useAdvancedWrap: true },
      lineSpacing: 8
    });
    this.promptText.setOrigin(0.5, 0.5);

    this.promptContainer.add([
      this.promptBox,
      this.promptBoy,
      this.promptText
    ]);

    this.updatePromptScale();
  }

  updatePromptScale() {
    if (!this.promptContainer) return;
    const width = this.scale.width;
    const height = this.scale.height;

    this.promptContainer.setPosition(width / 2, height / 2);

    const targetScale = Math.min(width * 0.85 / 1401, height * 0.55 / 793, 0.65);
    this.basePromptScale = targetScale;

    if (this.promptContainer.visible && !this.isPromptAnimating) {
      this.promptContainer.setScale(targetScale);
    }
  }

  onDoorOverlap() {
    if (this.isGameOver || !this.doorActive || this.isPromptOpen || this.isFading) return;
    this.isPromptOpen = true;
    this.player.setVelocity(0, 0);
    this.player.anims.stop();

    const idleFrames = { down: 0, up: 4, left: 8, right: 12 };
    this.player.setFrame(idleFrames[this.lastDirection || 'down']);

    this.showEnterHousePrompt();
  }

  showEnterHousePrompt() {
    if (!this.promptContainer || this.isGameOver) return;

    if (this.promptTypewriterTimer) {
      this.promptTypewriterTimer.remove();
      this.promptTypewriterTimer = null;
    }
    this.tweens.killTweensOf(this.promptContainer);
    this.tweens.killTweensOf(this.promptBoy);

    this.isPromptOpen = true;
    this.isPromptAnimating = true;

    const width = this.scale.width;
    const height = this.scale.height;
    const targetScale = Math.min(width * 0.85 / 1401, height * 0.55 / 793, 0.65);
    this.basePromptScale = targetScale;

    // 1. Container starts invisible and slightly smaller (around 0.75 scale)
    this.promptContainer.setPosition(width / 2, height / 2);
    this.promptContainer.setScale(targetScale * 0.75);
    this.promptContainer.setAlpha(0);
    this.promptContainer.setVisible(true);

    // 2. Dialogue boy starts small & invisible inside left section
    this.promptBoy.setScale(0.2);
    this.promptBoy.setAlpha(0);

    // 3. Clear text initially
    this.promptText.setText('');

    // Phase 1: Animate dialogue box zooming into normal scale (short ease-out tween)
    this.tweens.add({
      targets: this.promptContainer,
      scaleX: targetScale,
      scaleY: targetScale,
      alpha: 1,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Phase 2: Animate dialogue boy popping into left section
        this.tweens.add({
          targets: this.promptBoy,
          scaleX: 1,
          scaleY: 1,
          alpha: 1,
          duration: 250,
          ease: 'Back.easeOut',
          onComplete: () => {
            this.isPromptAnimating = false;
            // Phase 3: Show message using typewriter effect
            this.startPromptTypewriter("Tap the screen or press ENTER to get in");
          }
        });
      }
    });
  }

  startPromptTypewriter(message) {
    let charIndex = 0;
    const totalChars = message.length;

    this.promptTypewriterTimer = this.time.addEvent({
      delay: 35,
      repeat: totalChars - 1,
      callback: () => {
        charIndex++;
        this.promptText.setText(message.substring(0, charIndex));
      }
    });
  }

  confirmEnterHouse() {
    if (!this.isPromptOpen || this.isFading || this.isGameOver) return;
    this.isFading = true;

    if (this.promptTypewriterTimer) {
      this.promptTypewriterTimer.remove();
      this.promptTypewriterTimer = null;
    }

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

  parseTiledCollisionMap() {
    let offsetX = 433;
    let offsetY = 131;

    let content = '';
    if (this.cache.text && this.cache.text.exists('garden_collision_tmx')) {
      content = this.cache.text.get('garden_collision_tmx');
    }

    const objects = [];

    if (content) {
      try {
        const parser = new window.DOMParser();
        const xmlDoc = parser.parseFromString(content, 'text/xml');

        // Read imagelayer offset if present
        const imgLayer = xmlDoc.querySelector('imagelayer[name="Garden Map Background"]') || xmlDoc.querySelector('imagelayer');
        if (imgLayer) {
          if (imgLayer.hasAttribute('offsetx')) {
            offsetX = parseFloat(imgLayer.getAttribute('offsetx'));
          }
          if (imgLayer.hasAttribute('offsety')) {
            offsetY = parseFloat(imgLayer.getAttribute('offsety'));
          }
        }

        // Read gardenMapCollision objectgroup
        const collisionGroup = xmlDoc.querySelector('objectgroup[name="gardenMapCollision"]') ||
          Array.from(xmlDoc.getElementsByTagName('objectgroup')).find(g => g.getAttribute('name') === 'gardenMapCollision');

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
              // Account for imagelayer offset (433, 131)
              const imgX = rawX - offsetX;
              const imgY = rawY - offsetY;

              // Center of rectangle in garden_map.png (1672x941) coordinate space
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

    // Parse TMX XML objects directly from GardenCollision.tmx using DOMParser
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
    this.player.body.setCircle(45, 83, 140);

    this.lastDirection = 'down';
  }

  createUI() {
    const width = this.scale.width;
    const height = this.scale.height;

    this.ingredientData = {
      flower: { required: 3, collected: 0, icon: '🌸', singularName: 'Flower', active: true },
      durva: { required: 3, collected: 0, icon: '🌿', singularName: 'Durva', active: false },
      banana: { required: 3, collected: 0, icon: '🍌', singularName: 'Banana', active: false }
    };

    // Compact Top-Left Pixel Art HUD Container
    this.hudContainer = this.add.container(16, 16);
    this.hudContainer.setScrollFactor(0);
    this.hudContainer.setDepth(1000);

    // 1. Pixel Art Outer Frame & Shadow
    const hudBg = this.add.graphics();
    // Drop shadow behind HUD
    hudBg.fillStyle(0x000000, 0.45);
    hudBg.fillRect(3, 3, 310, 40);
    // Outer dark chocolate border
    hudBg.fillStyle(0x180D08, 0.95);
    hudBg.fillRect(0, 0, 310, 40);
    // Inner dark oak wood fill
    hudBg.fillStyle(0x2C1A10, 0.92);
    hudBg.fillRect(2, 2, 306, 36);
    // Inner golden border line
    hudBg.lineStyle(2, 0xC89632, 0.9);
    hudBg.strokeRect(3, 3, 304, 34);
    // Corner pixel highlights
    hudBg.fillStyle(0xFFE89C, 1);
    hudBg.fillRect(4, 4, 2, 2);
    hudBg.fillRect(303, 4, 2, 2);
    hudBg.fillRect(4, 33, 2, 2);
    hudBg.fillRect(303, 33, 2, 2);
    this.hudContainer.add(hudBg);

    const titleText = this.add.text(12, 20, 'ITEMS:', {
      fontSize: '13px',
      fontFamily: 'Consolas, "Courier New", monospace, sans-serif',
      fontStyle: 'bold',
      fill: '#FFD700',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0, 0.5);
    this.hudContainer.add(titleText);

    // 3. Flower Icon & Counter
    this.flowerHudIcon = this.add.image(116, 20, 'collectible_flower');
    this.flowerHudIcon.setDisplaySize(20, 20);
    if (this.flowerHudIcon.texture) {
      this.flowerHudIcon.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.hudContainer.add(this.flowerHudIcon);

    this.flowerHudText = this.add.text(130, 20, '0/3', {
      fontSize: '13px',
      fontFamily: 'Consolas, "Courier New", monospace, sans-serif',
      fontStyle: 'bold',
      fill: '#FFFFFF',
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

    this.durvaHudText = this.add.text(198, 20, '0/3', {
      fontSize: '13px',
      fontFamily: 'Consolas, "Courier New", monospace, sans-serif',
      fontStyle: 'bold',
      fill: '#888888',
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
      fill: '#888888',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0, 0.5);
    this.hudContainer.add(this.bananaHudText);

    this.objectiveText = { setText: () => { } };
    this.bananaCounterText = { setText: () => { } };

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

    this.updateHUD();
  }

  updateHUD() {
    if (!this.ingredientData) return;

    const f = this.ingredientData.flower;
    if (this.flowerHudText) {
      this.flowerHudText.setText(`${f.collected}/${f.required}`);
      this.flowerHudText.setFill(f.collected >= f.required ? '#FFD700' : '#FFFFFF');
    }

    const d = this.ingredientData.durva;
    if (this.durvaHudText) {
      this.durvaHudText.setText(`${d.collected}/${d.required}`);
      if (!d.active) this.durvaHudText.setFill('#888888');
      else this.durvaHudText.setFill(d.collected >= d.required ? '#FFD700' : '#FFFFFF');
    }

    const b = this.ingredientData.banana;
    if (this.bananaHudText) {
      this.bananaHudText.setText(`${b.collected}/${b.required}`);
      if (!b.active) this.bananaHudText.setFill('#888888');
      else this.bananaHudText.setFill(b.collected >= b.required ? '#FFD700' : '#FFFFFF');
    }
  }

  createHealthUI() {
    const width = this.scale.width;
    if (this.registry.get('playerHealth') === undefined) {
      this.registry.set('playerHealth', 3);
    }
    this.isInvulnerable = false;

    // Compact Top-Right Pixel Art Health HUD Container
    this.healthHudContainer = this.add.container(width - 150, 16);
    this.healthHudContainer.setScrollFactor(0);
    this.healthHudContainer.setDepth(1000);

    // Pixel Art Outer Frame & Shadow
    const hudBg = this.add.graphics();
    // Drop shadow
    hudBg.fillStyle(0x000000, 0.45);
    hudBg.fillRect(3, 3, 134, 40);
    // Outer dark chocolate border
    hudBg.fillStyle(0x180D08, 0.95);
    hudBg.fillRect(0, 0, 134, 40);
    // Inner dark oak wood fill
    hudBg.fillStyle(0x2C1A10, 0.92);
    hudBg.fillRect(2, 2, 130, 36);
    // Inner golden border line
    hudBg.lineStyle(2, 0xC89632, 0.9);
    hudBg.strokeRect(3, 3, 128, 34);
    // Corner pixel highlights
    hudBg.fillStyle(0xFFE89C, 1);
    hudBg.fillRect(4, 4, 2, 2);
    hudBg.fillRect(127, 4, 2, 2);
    hudBg.fillRect(4, 33, 2, 2);
    hudBg.fillRect(127, 33, 2, 2);
    this.healthHudContainer.add(hudBg);

    // 3 Heart Sprites
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

  createGameOverUI() {
    const width = this.scale.width;
    const height = this.scale.height;

    this.gameOverContainer = this.add.container(
      width / 2,
      height / 2
    );

    this.gameOverContainer.setScrollFactor(0);
    this.gameOverContainer.setDepth(2000);
    this.gameOverContainer.setVisible(false);

    this.gameOverPanel = this.add.image(
      0,
      0,
      'game-over-panel'
    );

    // Keep pixel art crisp
    if (this.gameOverPanel.texture) {
      this.gameOverPanel.texture.setFilter(
        Phaser.Textures.FilterMode.NEAREST
      );
    }

    this.gameOverPanel.setOrigin(0.5);

    this.gameOverContainer.add(this.gameOverPanel);

    this.gameOverPanel.setInteractive(
      new Phaser.Geom.Rectangle(
        0,
        0,
        this.gameOverPanel.width,
        this.gameOverPanel.height
      ),
      Phaser.Geom.Rectangle.Contains
    );

    this.retryButton = this.add.zone(0, 0, 1, 1);
    this.retryButton.setOrigin(0.5);
    this.retryButton.setInteractive({ useHandCursor: true });

    this.gameOverContainer.add(this.retryButton);

    this.retryButton.on('pointerdown', () => {
      this.retryGame();
    });
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

  setupCatCollision() {
    if (this.player && this.cat) {
      this.physics.add.overlap(this.player, this.cat, this.onCatOverlap, null, this);
    }
  }

  onCatOverlap() {
    if (this.isInvulnerable || this.isPromptOpen || this.isFading || this.isDialogueOpen || this.isGameOver) {
      return;
    }
    this.takeDamage();
  }

  takeDamage() {
    if (this.isInvulnerable || this.isGameOver) return;

    let currentHealth = this.registry.get('playerHealth');
    if (currentHealth === undefined) currentHealth = 3;

    currentHealth = Math.max(0, currentHealth - 1);
    this.registry.set('playerHealth', currentHealth);

    this.updateHealthHUD();

    if (currentHealth <= 0) {
      this.showGameOver();
    } else {
      this.startInvulnerability();
    }
  }

  triggerGameOver() {
    if (this.isGameOver) return;
    this.isGameOver = true;

    // 1. Freeze player and cat velocity immediately
    if (this.player) {
      this.player.setVelocity(0, 0);
      if (this.player.anims) this.player.anims.stop();
    }
    if (this.cat && this.cat.body) {
      this.cat.setVelocity(0, 0);
      if (this.cat.anims) this.cat.anims.stop();
    }

    // 2. Play Mushak defeat reaction animation (hop, flash, tilt)
    if (this.player) {
      const startY = this.player.y;
      this.tweens.add({
        targets: this.player,
        y: startY - 20,
        angle: 15,
        alpha: 0.6,
        duration: 250,
        yoyo: true,
        ease: 'Quad.easeOut',
        onComplete: () => {
          if (this.player) {
            this.player.setAngle(15);
            this.player.setAlpha(0.7);
          }
        }
      });
    }

    // 3. Dark Overlay
    const width = this.scale.width;
    const height = this.scale.height;

    if (this.gameOverOverlay) this.gameOverOverlay.destroy();
    this.gameOverOverlay = this.add.graphics();
    this.gameOverOverlay.setScrollFactor(0);
    this.gameOverOverlay.setDepth(3000);
    this.gameOverOverlay.fillStyle(0x120804, 0.75);
    this.gameOverOverlay.fillRect(0, 0, width, height);
    this.gameOverOverlay.setAlpha(0);

    this.tweens.add({
      targets: this.gameOverOverlay,
      alpha: 1,
      duration: 400,
      ease: 'Power2'
    });

    // 4. Centered Pixel-Art Game Over Panel Container
    if (this.gameOverContainer) this.gameOverContainer.destroy();
    this.gameOverContainer = this.add.container(width / 2, height / 2);
    this.gameOverContainer.setScrollFactor(0);
    this.gameOverContainer.setDepth(3001);
    this.gameOverContainer.setScale(0.2);
    this.gameOverContainer.setAlpha(0);

    const panelW = 340;
    const panelH = 260;
    const halfW = panelW / 2;
    const halfH = panelH / 2;

    const panelBg = this.add.graphics();
    // Drop shadow
    panelBg.fillStyle(0x000000, 0.6);
    panelBg.fillRect(-halfW + 6, -halfH + 6, panelW, panelH);
    // Outer dark brown border
    panelBg.fillStyle(0x180D08, 0.98);
    panelBg.fillRect(-halfW, -halfH, panelW, panelH);
    // Inner dark oak fill
    panelBg.fillStyle(0x2C1A10, 0.95);
    panelBg.fillRect(-halfW + 4, -halfH + 4, panelW - 8, panelH - 8);
    // Golden border stroke
    panelBg.lineStyle(3, 0xC89632, 0.95);
    panelBg.strokeRect(-halfW + 6, -halfH + 6, panelW - 12, panelH - 12);
    // Inner accent line
    panelBg.lineStyle(1, 0x785020, 0.8);
    panelBg.strokeRect(-halfW + 10, -halfH + 10, panelW - 20, panelH - 20);
    // Corner pixel highlights
    panelBg.fillStyle(0xFFE89C, 1);
    panelBg.fillRect(-halfW + 8, -halfH + 8, 4, 4);
    panelBg.fillRect(halfW - 12, -halfH + 8, 4, 4);
    panelBg.fillRect(-halfW + 8, halfH - 12, 4, 4);
    panelBg.fillRect(halfW - 12, halfH - 12, 4, 4);

    this.gameOverContainer.add(panelBg);

    // Header Text: GAME OVER
    const titleText = this.add.text(0, -85, 'GAME OVER', {
      fontSize: '28px',
      fontFamily: "'Courier New', Consolas, Monaco, monospace",
      fontStyle: 'bold',
      fill: '#FF4444',
      stroke: '#000000',
      strokeThickness: 5
    }).setOrigin(0.5);
    this.gameOverContainer.add(titleText);

    // Defeated Mushak Sprite Icon inside Panel
    const mushakIcon = this.add.image(0, -25, 'mushak', 0);
    mushakIcon.setDisplaySize(48, 48);
    mushakIcon.setAngle(-15);
    mushakIcon.setAlpha(0.85);
    if (mushakIcon.texture) {
      mushakIcon.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.gameOverContainer.add(mushakIcon);

    // Subtitle Text: Mushak Defeated
    const subText = this.add.text(0, 15, 'Mushak Defeated!', {
      fontSize: '16px',
      fontFamily: "'Courier New', Consolas, Monaco, monospace",
      fontStyle: 'bold',
      fill: '#D8A050',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);
    this.gameOverContainer.add(subText);

    // Action Prompt: TRY AGAIN!
    const tryAgainText = this.add.text(0, 65, 'TRY AGAIN!', {
      fontSize: '22px',
      fontFamily: "'Courier New', Consolas, Monaco, monospace",
      fontStyle: 'bold',
      fill: '#FFD700',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);
    this.gameOverContainer.add(tryAgainText);

    // Bounce tween for TRY AGAIN text
    this.tweens.add({
      targets: tryAgainText,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Pop/Zoom Animation for Panel
    this.tweens.add({
      targets: this.gameOverContainer,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 400,
      ease: 'Back.easeOut'
    });

    // 5. Hold Game Over screen visible for ~2.2s, then fade out and reset mission
    this.time.delayedCall(2200, () => {
      this.tweens.add({
        targets: [this.gameOverContainer, this.gameOverOverlay],
        alpha: 0,
        duration: 400,
        ease: 'Power2',
        onComplete: () => {
          if (this.gameOverContainer) {
            this.gameOverContainer.destroy();
            this.gameOverContainer = null;
          }
          if (this.gameOverOverlay) {
            this.gameOverOverlay.destroy();
            this.gameOverOverlay = null;
          }
          this.resetCurrentMission();
        }
      });
    });
  }

  showGameOver() {
    if (this.gameOverActive) return;

    this.gameOverActive = true;
    this.isInvulnerable = true;
    this.isFading = true;

    // Stop Mushak
    if (this.player) {
      this.player.setVelocity(0, 0);
      this.player.body.moves = false;
    }

    // Stop cat
    if (this.cat) {
      this.cat.setVelocity(0, 0);
      this.cat.body.moves = false;
      this.cat.anims.stop();
    }

    if (!this.gameOverContainer || !this.gameOverPanel) return;

    const width = this.scale.width;
    const height = this.scale.height;

    // Show the panel
    this.gameOverContainer.setVisible(true);

    // Start tiny
    this.gameOverContainer.setScale(0.05);
    this.gameOverContainer.setAlpha(0);

    // Scale panel to fit the game screen
    const maxWidth = width * 0.62;
    const maxHeight = height * 0.68;

    const textureWidth = this.gameOverPanel.width;
    const textureHeight = this.gameOverPanel.height;

    const scaleX = maxWidth / textureWidth;
    const scaleY = maxHeight / textureHeight;

    const panelScale = Math.min(scaleX, scaleY);

    this.gameOverPanel.setScale(panelScale);

    // Position RETRY hitbox relative to the actual scaled panel
    this.retryButton.setPosition(
      -260 * panelScale,
      285 * panelScale
    );

    this.retryButton.setSize(
      350 * panelScale,
      100 * panelScale
    );

    // POP IN
    this.tweens.add({
      targets: this.gameOverContainer,
      alpha: 1,
      scale: 1.08,
      duration: 180,
      ease: 'Back.easeOut',

      onComplete: () => {

        // Small bounce back into place
        this.tweens.add({
          targets: this.gameOverContainer,
          scale: 0.96,
          duration: 80,
          ease: 'Quad.easeOut',

          onComplete: () => {

            this.tweens.add({
              targets: this.gameOverContainer,
              scale: 1,
              duration: 120,
              ease: 'Quad.easeOut'
            });

          }
        });

      }
    });
  }

  retryGame() {
    if (!this.gameOverActive) return;

    this.gameOverActive = false;
    this.isInvulnerable = false;
    this.isFading = false;

    // Hide Game Over screen
    if (this.gameOverContainer) {
      this.tweens.killTweensOf(this.gameOverContainer);
      this.gameOverContainer.setVisible(false);
      this.gameOverContainer.setScale(1);
      this.gameOverContainer.setAlpha(1);
    }

    // Reset player physics
    if (this.player) {
      this.player.body.moves = true;
      this.player.setVelocity(0, 0);
      this.player.setAlpha(1);
    }

    // Reset cat physics
    if (this.cat) {
      this.cat.body.moves = true;
    }

    // Reset the current mission
    this.resetCurrentMission();
  }

  startInvulnerability() {
    this.isInvulnerable = true;

    this.tweens.add({
      targets: this.player,
      alpha: 0.3,
      duration: 125,
      yoyo: true,
      repeat: 7, // ~1000ms total invulnerability duration
      onComplete: () => {
        if (this.player && !this.isGameOver) this.player.setAlpha(1);
        this.isInvulnerable = false;
      }
    });
  }

  resetCurrentMission() {
    this.isGameOver = false;
    this.isInvulnerable = false;
    if (this.player) {
      this.tweens.killTweensOf(this.player);
      this.player.setAlpha(1);
      this.player.setAngle(0);
      this.player.setScale(0.24);
    }

    // Reset Mushak health to 3
    this.registry.set('playerHealth', 3);

    // Reset Cat to starting spawn position and IDLE state
    if (this.cat && this.catDef) {
      const catPos = this.getMapScreenPos(this.catDef.origX, this.catDef.origY);
      this.cat.setPosition(catPos.x, catPos.y);
      this.cat.setVelocity(0, 0);
      this.cat.anims.stop();
      this.catState = 'IDLE';
    }

    // Place Mushak at safe starting spawn position
    const spawnPos = this.getMapScreenPos(836, 250);
    this.player.setPosition(spawnPos.x, spawnPos.y);
    this.player.setVelocity(0, 0);

    // Reset ONLY current mission collectible progress
    if (this.currentMission === 1) {
      if (this.ingredientData && this.ingredientData.flower) {
        this.ingredientData.flower.collected = 0;
      }
      this.collectibles.getChildren().forEach(item => {
        if (item.ingredientType === 'flower') {
          item.enableBody(true, item.x, item.y, true, true);
        }
      });
    } else if (this.currentMission === 2) {
      if (this.ingredientData && this.ingredientData.durva) {
        this.ingredientData.durva.collected = 0;
      }
      this.collectibles.getChildren().forEach(item => {
        if (item.ingredientType === 'durva') {
          item.enableBody(true, item.x, item.y, true, true);
        }
      });
    }

    this.updateHUD();
    this.updateHealthHUD();
  }

  createCollectibles() {
    if (this.textures.exists('collectible_flower')) {
      this.textures.get('collectible_flower').setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    if (this.textures.exists('collectible_durva')) {
      this.textures.get('collectible_durva').setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    // 1. Flower positions on map (Upper-left rocks, Upper-right shrine top, Lower-mid-left house top)
    this.flowerDefs = [
      { origX: 200, origY: 330 },
      { origX: 1310, origY: 150 },
      { origX: 630, origY: 515 }
    ];
    this.flowerDefs.forEach(def => {
      const pos = this.getMapScreenPos(def.origX, def.origY);
      const item = this.spawnCollectible('flower', pos.x, pos.y, 'collectible_flower', true);
      item.origDef = def;
    });

    // 2. Durva positions on map (Upper-mid-left above bench, Right-mid left of shrine steps, Lower-left of house)
    this.durvaDefs = [
      { origX: 550, origY: 430 },
      { origX: 1200, origY: 530 },
      { origX: 520, origY: 700 }
    ];
    this.durvaDefs.forEach(def => {
      const pos = this.getMapScreenPos(def.origX, def.origY);
      const item = this.spawnCollectible('durva', pos.x, pos.y, 'collectible_durva', false);
      item.origDef = def;
    });
  }

  createCat() {
    this.catDef = { origX: 680, origY: 440 };
    const pos = this.getMapScreenPos(this.catDef.origX, this.catDef.origY);

    // Create 4-directional walking animations for the cat
    if (!this.anims.exists('cat-down')) {
      this.anims.create({
        key: 'cat-down',
        frames: this.anims.generateFrameNumbers('cat-sheet', { start: 0, end: 3 }),
        frameRate: 8,
        repeat: -1
      });
    }

    if (!this.anims.exists('cat-up')) {
      this.anims.create({
        key: 'cat-up',
        frames: this.anims.generateFrameNumbers('cat-sheet', { start: 4, end: 7 }),
        frameRate: 8,
        repeat: -1
      });
    }

    if (!this.anims.exists('cat-left')) {
      this.anims.create({
        key: 'cat-left',
        frames: this.anims.generateFrameNumbers('cat-sheet', { start: 8, end: 11 }),
        frameRate: 8,
        repeat: -1
      });
    }

    if (!this.anims.exists('cat-right')) {
      this.anims.create({
        key: 'cat-right',
        frames: this.anims.generateFrameNumbers('cat-sheet', { start: 12, end: 15 }),
        frameRate: 8,
        repeat: -1
      });
    }

    this.cat = this.physics.add.sprite(pos.x, pos.y, 'cat-sheet', 0);
    this.cat.setOrigin(0.5, 0.5);
    this.cat.setScale(0.24);
    if (this.cat.texture) {
      this.cat.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    this.catState = 'IDLE';
    this.catStartX = pos.x;
    this.catStartY = pos.y;

    this.cat.setCollideWorldBounds(true);

    if (this.cat.body) {
      this.cat.body.setSize(this.cat.width * 0.45, this.cat.height * 0.45, true);
    }
  }

  updateCat() {
    if (this.isGameOver) {
      if (this.cat && this.cat.body) {
        this.cat.setVelocity(0, 0);
        this.cat.anims.stop();
      }
      return;
    }

    if (!this.cat || !this.player || !this.catDef || !this.cat.body) return;

    const homePos = this.getMapScreenPos(this.catDef.origX, this.catDef.origY);

    const distToPlayer = Phaser.Math.Distance.Between(
      this.cat.x,
      this.cat.y,
      this.player.x,
      this.player.y
    );

    const distToHome = Phaser.Math.Distance.Between(
      this.cat.x,
      this.cat.y,
      homePos.x,
      homePos.y
    );

    const catSpeed = 160 * homePos.scale;
    const detectionRange = 180 * homePos.scale;
    const stopChaseRange = 280 * homePos.scale;

    switch (this.catState) {
      case 'IDLE':
        this.cat.setVelocity(0, 0);
        this.cat.anims.stop();
        if (distToPlayer < detectionRange) {
          this.catState = 'CHASING';
        }
        break;

      case 'CHASING':
        if (distToPlayer > stopChaseRange) {
          this.catState = 'RETURNING';
        } else {
          this.physics.moveToObject(this.cat, this.player, catSpeed);
          this.updateCatAnimation();
        }
        break;

      case 'RETURNING':
        if (distToHome < 8 * homePos.scale) {
          this.cat.setVelocity(0, 0);
          this.cat.setPosition(homePos.x, homePos.y);
          this.cat.anims.stop();
          this.catState = 'IDLE';
        } else {
          this.physics.moveTo(this.cat, homePos.x, homePos.y, catSpeed);
          this.updateCatAnimation();

          if (distToPlayer < detectionRange) {
            this.catState = 'CHASING';
          }
        }
        break;
    }
  }

  updateCatAnimation() {
    if (!this.cat || !this.cat.body) return;

    const vx = this.cat.body.velocity.x;
    const vy = this.cat.body.velocity.y;

    if (Math.abs(vx) > 5 || Math.abs(vy) > 5) {
      let animKey = 'cat-down';
      if (Math.abs(vx) > Math.abs(vy)) {
        animKey = vx < 0 ? 'cat-left' : 'cat-right';
      } else {
        animKey = vy < 0 ? 'cat-up' : 'cat-down';
      }
      this.cat.anims.play(animKey, true);
    } else {
      this.cat.anims.stop();
    }
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

    const scale = type === 'flower' ? 0.13 : 0.14;
    item.setScale(scale);
    item.refreshBody();

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
    if (this.isGameOver) return;

    const type = item.ingredientType;
    const config = this.ingredientData[type];

    if (!config || !config.active) return;

    item.disableBody(true, true);
    config.collected += 1;
    this.updateHUD();

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

    // Enable pointer/click interaction to advance or skip dialogue / confirm enter house prompt
    this.input.on('pointerdown', () => {
      if (this.isGameOver) return;
      if (this.isPromptOpen) {
        this.confirmEnterHouse();
        return;
      }
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
    if (!this.dialogueContainer || this.isGameOver) return;

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
        this.showMissionDialogue("Great! You collected the flowers!\nNow collect some Durva!", () => {
          this.startMission2();
        });
      } else if (type === 'durva') {
        this.showMissionDialogue("Great! You collected the Durva!\nNow get inside the house to collect some Bananas!", () => {
          this.objectiveText.setText('Go to the door to enter the house 🏠');
          this.doorActive = true;
          if (this.doorMarker) this.doorMarker.setVisible(true);
        });
      } else if (type === 'banana' || type === 'bananas') {
        this.showMissionDialogue("Great! You collected the Bananas!\nNow get the Coconuts!", () => {
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

    this.objectiveText.setText('Mission 2: Collect 3 Durva 🌿');
    this.updateHUD();

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
      this.updatePromptScale();
    }
    if (this.dialogueContainer) {
      this.updateDialogueScale();
    }
    if (this.cat && this.catDef) {
      const pos = this.getMapScreenPos(this.catDef.origX, this.catDef.origY);
      if (this.catState === 'IDLE') {
        this.cat.setPosition(pos.x, pos.y);
      }
    }
    if (this.healthHudContainer) {
      this.healthHudContainer.setPosition(width - 150, 16);
    }
    if (this.gameOverOverlay) {
      this.gameOverOverlay.clear();
      this.gameOverOverlay.fillStyle(0x120804, 0.75);
      this.gameOverOverlay.fillRect(0, 0, width, height);
    }
    if (this.gameOverContainer) {
      this.gameOverContainer.setPosition(width / 2, height / 2);
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
      if (this.isGameOver) return;
      if (this.isPromptOpen) this.confirmEnterHouse();
      else if (this.isDialogueOpen) this.handleDialogueAdvance();
    });

    this.spaceKey.on('down', () => {
      if (this.isGameOver) return;
      if (this.isPromptOpen) this.confirmEnterHouse();
      else if (this.isDialogueOpen) this.handleDialogueAdvance();
    });
  }

  update() {
    if (this.isPromptOpen || this.isFading || this.isDialogueOpen || this.isGameOver) {
      this.player.setVelocity(0, 0);
      if (this.cat && this.cat.body) this.cat.setVelocity(0, 0);
      return;
    }

    this.updateCat();

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
