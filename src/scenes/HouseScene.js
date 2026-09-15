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

    // 6. Setup UI (Mission 3 objective & banana counter) & pixel dialogue UI
    this.createUI();
    this.createDialogueUI();

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
        if (this.bannerText) this.bannerText.setVisible(false);
        this.showMissionDialogue("Great! You collected the Bananas!\nNow get the Coconuts!");
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

    // 6. Update Central Completion Banner & Dialogue Container
    if (this.bannerText) {
      this.bannerText.setPosition(width / 2, height / 2);
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
