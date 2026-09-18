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
    this.load.image('cat', 'assets/cat.png');
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

    // 7b. Spawn stationary Cat NPC in the garden
    this.createCat();

    // 8. Enable physical collisions with solid obstacles
    this.physics.add.collider(this.player, this.obstacles);
    this.physics.add.collider(this.cat, this.obstacles);

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

    // 1. Dialogue Box Image (centered inside container)
    const box = this.add.image(0, 0, 'dialogueBox');
    box.setOrigin(0.5, 0.5);
    if (box.texture) {
      box.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    // 2. Dialogue Boy Image (positioned inside LEFT brown section)
    const boy = this.add.image(-430, -5, 'dialogueBoy');
    boy.setOrigin(0.5, 0.5);
    if (boy.texture) {
      boy.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    // 3. Title & Subtitle centered in the RIGHT cream writing section
    const title = this.add.text(190, -40, 'Press ENTER or SPACE \nto enter the house', {
      fontSize: '42px',
      fontFamily: "'Courier New', Consolas, Monaco, monospace",
      fontStyle: 'bold',
      fill: '#1a1a1a',
      stroke: '#1a1a1a',
      strokeThickness: 1,
      align: 'center'
    }).setOrigin(0.5);

    const subtext = this.add.text(190, 40, '', {
      fontSize: '24px',
      fontFamily: "'Courier New', Consolas, Monaco, monospace",
      fontStyle: 'bold',
      fill: '#4a3525',
      stroke: '#4a3525',
      strokeThickness: 1,
      align: 'center'
    }).setOrigin(0.5);

    this.promptContainer.add([box, boy, title, subtext]);
    this.promptContainer.setDepth(1900);
    this.promptContainer.setVisible(false);

    this.updatePromptScale();

    // Clicking dialogue box confirms entering house
    box.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.confirmEnterHouse());
  }

  updatePromptScale() {
    if (!this.promptContainer) return;
    const width = this.scale.width;
    const height = this.scale.height;

    this.promptContainer.setPosition(width / 2, height / 2);

    const targetScale = Math.min(width * 0.85 / 1401, height * 0.55 / 793, 0.65);
    this.promptContainer.setScale(targetScale);
  }

  onDoorOverlap() {
    if (this.doorActive && !this.isPromptOpen && !this.isFading) {
      this.isPromptOpen = true;
      this.player.setVelocity(0, 0);
      this.player.anims.stop();

      const idleFrames = { down: 0, up: 4, left: 8, right: 12 };
      this.player.setFrame(idleFrames[this.lastDirection || 'down']);

      if (this.promptContainer) {
        this.updatePromptScale();
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
        const imgLayer = xmlDoc.querySelector('imagelayer[name="gardenMap"]') || xmlDoc.querySelector('imagelayer');
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
          xmlDoc.querySelector('objectgroup[name="Collision"]') ||
          Array.from(xmlDoc.getElementsByTagName('objectgroup')).find(g => g.getAttribute('name') === 'gardenMapCollision' || g.getAttribute('name') === 'Collision');

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
        required: 3,
        collected: 0,
        active: true
      },
      durva: {
        name: 'Durva',
        singularName: 'Durva',
        required: 3,
        collected: 0,
        active: false
      }
    };

    // Compact Top-Left Pixel Art HUD Container
    this.hudContainer = this.add.container(16, 16);
    this.hudContainer.setScrollFactor(0);
    this.hudContainer.setDepth(1000);

    // 1. Pixel Art Outer Frame & Shadow
    const hudBg = this.add.graphics();
    // Drop shadow behind HUD
    hudBg.fillStyle(0x000000, 0.45);
    hudBg.fillRect(3, 3, 336, 40);
    // Outer dark chocolate border
    hudBg.fillStyle(0x180D08, 0.95);
    hudBg.fillRect(0, 0, 336, 40);
    // Inner dark oak wood fill
    hudBg.fillStyle(0x2C1A10, 0.92);
    hudBg.fillRect(2, 2, 332, 36);
    // Inner golden border line
    hudBg.lineStyle(2, 0xC89632, 0.9);
    hudBg.strokeRect(3, 3, 330, 34);
    // Corner pixel highlights
    hudBg.fillStyle(0xFFE89C, 1);
    hudBg.fillRect(4, 4, 2, 2);
    hudBg.fillRect(329, 4, 2, 2);
    hudBg.fillRect(4, 33, 2, 2);
    hudBg.fillRect(329, 33, 2, 2);
    // Vertical divider line
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

    this.missionBadgeText = this.add.text(51, 20, 'MISSION 1', {
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

    this.flowerHudText = this.add.text(129, 20, '0/3', {
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
    this.durvaHudIcon.setAlpha(0.5);
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
    this.bananaHudIcon.setAlpha(0.5);
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

    // Legacy objectiveText bridge
    this.objectiveText = {
      setText: (txt) => {
        if (!this.missionBadgeText) return;
        if (txt.includes('Mission 1')) this.missionBadgeText.setText('MISSION 1');
        else if (txt.includes('Mission 2')) this.missionBadgeText.setText('MISSION 2');
        else if (txt.includes('door') || txt.includes('house')) this.missionBadgeText.setText('GO TO HOUSE');
        else if (txt.includes('Mission 3')) this.missionBadgeText.setText('MISSION 3');
      }
    };

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
    if (!this.hudContainer) return;

    const flowers = this.ingredientData ? this.ingredientData.flower.collected : 0;
    const durva = this.ingredientData ? this.ingredientData.durva.collected : 0;
    const durvaActive = this.ingredientData ? this.ingredientData.durva.active : false;
    const bananas = this.registry.get('bananasCollected') || 0;

    // Sync registry
    this.registry.set('flowersCollected', flowers);
    this.registry.set('durvaCollected', durva);

    // Update Badge
    if (this.currentMission === 1) {
      this.missionBadgeText.setText('MISSION 1');
    } else if (this.currentMission === 2) {
      this.missionBadgeText.setText('MISSION 2');
    } else {
      this.missionBadgeText.setText('MISSION 3');
    }

    // Flower HUD
    this.flowerHudText.setText(`${flowers}/3`);
    if (flowers >= 3) {
      this.flowerHudText.setFill('#FFD700');
    } else {
      this.flowerHudText.setFill('#FFFFFF');
    }

    // Durva HUD
    this.durvaHudText.setText(`${durva}/3`);
    if (durvaActive || durva > 0) {
      this.durvaHudIcon.setAlpha(1.0);
      if (durva >= 3) {
        this.durvaHudText.setFill('#FFD700');
      } else {
        this.durvaHudText.setFill('#FFFFFF');
      }
    } else {
      this.durvaHudIcon.setAlpha(0.5);
      this.durvaHudText.setFill('#888888');
    }

    // Banana HUD
    this.bananaHudText.setText(`${bananas}/3`);
    if (bananas > 0) {
      this.bananaHudIcon.setAlpha(1.0);
      if (bananas >= 3) {
        this.bananaHudText.setFill('#FFD700');
      } else {
        this.bananaHudText.setFill('#FFFFFF');
      }
    } else {
      this.bananaHudIcon.setAlpha(0.5);
      this.bananaHudText.setFill('#888888');
    }
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

    this.cat = this.physics.add.sprite(pos.x, pos.y, 'cat');
    this.cat.setScale(0.42);
    if (this.cat.texture) {
      this.cat.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    this.catState = 'IDLE';
    this.catStartX = pos.x;
    this.catStartY = pos.y;

    this.cat.setCollideWorldBounds(true);

    if (this.cat.body) {
      this.cat.body.setSize(this.cat.width * 0.6, this.cat.height * 0.6, true);
    }
  }

  updateCat() {
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
        if (distToPlayer < detectionRange) {
          this.catState = 'CHASING';
        }
        break;

      case 'CHASING':
        if (distToPlayer > stopChaseRange) {
          this.catState = 'RETURNING';
        } else {
          this.physics.moveToObject(this.cat, this.player, catSpeed);

          if (this.player.x < this.cat.x) {
            this.cat.setFlipX(true);
          } else if (this.player.x > this.cat.x) {
            this.cat.setFlipX(false);
          }
        }
        break;

      case 'RETURNING':
        if (distToHome < 8 * homePos.scale) {
          this.cat.setVelocity(0, 0);
          this.cat.setPosition(homePos.x, homePos.y);
          this.catState = 'IDLE';
        } else {
          this.physics.moveTo(this.cat, homePos.x, homePos.y, catSpeed);

          if (homePos.x < this.cat.x) {
            this.cat.setFlipX(true);
          } else if (homePos.x > this.cat.x) {
            this.cat.setFlipX(false);
          }

          if (distToPlayer < detectionRange) {
            this.catState = 'CHASING';
          }
        }
        break;
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
