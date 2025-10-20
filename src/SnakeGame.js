import React, { useRef, useEffect, useState } from 'react';

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 600;
const SEGMENT_SPACING = 8; // distance between body segments
const INITIAL_LENGTH = 15; // number of segments

// Shooting mechanics
const PROJECTILE_SPEED = 8;
const PROJECTILE_LIFETIME = 1500; // milliseconds
const SHOOT_COOLDOWN = 1000; // milliseconds between shots
const SLOW_DURATION = 1000; // milliseconds of slow effect
const SLOW_FACTOR = 0; // speed multiplier when slowed (40% speed)

// Difficulty settings - easily configurable
const DIFFICULTY_SETTINGS = {
  easy: {
    speed: 2.5,
    rotationSpeed: 0.07,
    speedIncrementPerFood: 0,  // No speed increase in easy mode
    label: 'Easy'
  },
  hard: {
    speed: 5.0,  // Doubled
    rotationSpeed: 0.14,  // Doubled
    speedIncrementPerFood: 0.15,  // Speed increases by 0.15 per food eaten
    maxSpeed: 12.0,  // Cap the maximum speed so it doesn't get impossible
    label: 'Hard'
  }
};

const SnakeGame = () => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [score2, setScore2] = useState(0); // Player 2 score
  const [snakeLengthDisplay, setSnakeLengthDisplay] = useState(INITIAL_LENGTH);
  const [snake2LengthDisplay, setSnake2LengthDisplay] = useState(INITIAL_LENGTH); // Player 2 length
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
  const [gameOverReason, setGameOverReason] = useState('');
  const [difficulty, setDifficulty] = useState('easy');
  const [gameMode, setGameMode] = useState('single'); // 'single' or 'multiplayer'
  const [winner, setWinner] = useState(''); // Track who won in multiplayer
  const [currentSpeedDisplay, setCurrentSpeedDisplay] = useState(DIFFICULTY_SETTINGS.easy.speed);
  const currentSpeedRef = useRef(DIFFICULTY_SETTINGS.easy.speed);
  
  // Game state stored in refs for smooth animation
  const snakeRef = useRef({
    head: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 },
    angle: 0, // current facing direction in radians (0 = right, Math.PI/2 = down)
    targetAngle: 0, // where we want to turn towards
    body: [], // array of {x, y} positions for body segments
    length: INITIAL_LENGTH, // actual length
    alive: true,
    slowedUntil: 0, // timestamp when slow effect ends
    shootCooldown: 0, // timestamp when can shoot again
    canShoot: true
  });
  
  // Player 2 snake (blue snake)
  const snake2Ref = useRef({
    head: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 },
    angle: Math.PI, // facing left
    targetAngle: Math.PI,
    body: [],
    length: INITIAL_LENGTH,
    alive: true,
    slowedUntil: 0,
    shootCooldown: 0,
    canShoot: true
  });
  
  const foodRef = useRef({ x: 0, y: 0 });
  
  // Projectiles array
  const projectilesRef = useRef([]);
  
  const keysPressed = useRef({
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,   // Player 1 shoot
    KeyA: false,
    KeyD: false,
    KeyW: false       // Player 2 shoot
  });

  // Shooting function
  const shoot = (snake, playerNumber) => {
    const now = Date.now();
    
    // Check cooldown
    if (now < snake.shootCooldown) {
      return;
    }
    
    // Create projectile
    const projectile = {
      x: snake.head.x,
      y: snake.head.y,
      angle: snake.angle,
      vx: Math.cos(snake.angle) * PROJECTILE_SPEED,
      vy: Math.sin(snake.angle) * PROJECTILE_SPEED,
      owner: playerNumber, // 1 or 2
      createdAt: now,
      color: playerNumber === 1 ? '#22c55e' : '#3b82f6'
    };
    
    projectilesRef.current.push(projectile);
    
    // Set cooldown
    snake.shootCooldown = now + SHOOT_COOLDOWN;
  };

  // Update projectiles
  const updateProjectiles = () => {
    const now = Date.now();
    const worldWidth = canvasSize.width;
    const worldHeight = canvasSize.height;
    
    // Update positions and remove expired projectiles
    projectilesRef.current = projectilesRef.current.filter(proj => {
      // Remove if expired
      if (now - proj.createdAt > PROJECTILE_LIFETIME) {
        return false;
      }
      
      // Move projectile
      proj.x += proj.vx;
      proj.y += proj.vy;
      
      // Wrap around screen
      if (proj.x < 0) proj.x = worldWidth;
      if (proj.x > worldWidth) proj.x = 0;
      if (proj.y < 0) proj.y = worldHeight;
      if (proj.y > worldHeight) proj.y = 0;
      
      return true;
    });
  };

  // Check projectile collisions
  const checkProjectileCollisions = () => {
    const now = Date.now();
    
    projectilesRef.current = projectilesRef.current.filter(proj => {
      // Check collision with Player 1
      if (proj.owner === 2 && snakeRef.current.alive) {
        const distanceToP1 = Math.sqrt(
          Math.pow(proj.x - snakeRef.current.head.x, 2) + 
          Math.pow(proj.y - snakeRef.current.head.y, 2)
        );
        
        if (distanceToP1 < 10) {
          // Hit! Apply slow effect
          snakeRef.current.slowedUntil = now + SLOW_DURATION;
          return false; // Remove projectile
        }
      }
      
      // Check collision with Player 2
      if (proj.owner === 1 && snake2Ref.current.alive && gameMode === 'multiplayer') {
        const distanceToP2 = Math.sqrt(
          Math.pow(proj.x - snake2Ref.current.head.x, 2) + 
          Math.pow(proj.y - snake2Ref.current.head.y, 2)
        );
        
        if (distanceToP2 < 10) {
          // Hit! Apply slow effect
          snake2Ref.current.slowedUntil = now + SLOW_DURATION;
          return false; // Remove projectile
        }
      }
      
      return true; // Keep projectile
    });
  };

  // Generate food at random position (avoiding both snakes)
  const generateFood = () => {
    let newFood;
    let validPosition = false;
    
    const worldWidth = canvasSize.width;
    const worldHeight = canvasSize.height;
    
    while (!validPosition) {
      newFood = {
        x: Math.random() * (worldWidth - 40) + 20,
        y: Math.random() * (worldHeight - 40) + 20
      };
      
      validPosition = true;
      
      // Check distance to both snakes
      const snakes = gameMode === 'multiplayer' ? [snakeRef.current, snake2Ref.current] : [snakeRef.current];
      
      for (let snake of snakes) {
        const distanceToHead = Math.sqrt(
          Math.pow(newFood.x - snake.head.x, 2) + 
          Math.pow(newFood.y - snake.head.y, 2)
        );
        
        if (distanceToHead < 50) {
          validPosition = false;
          break;
        }
        
        // Also check body segments
        for (let segment of snake.body) {
          const distanceToSegment = Math.sqrt(
            Math.pow(newFood.x - segment.x, 2) + 
            Math.pow(newFood.y - segment.y, 2)
          );
          if (distanceToSegment < 30) {
            validPosition = false;
            break;
          }
        }
        
        if (!validPosition) break;
      }
    }
    
    foodRef.current = newFood;
  };

  // Initialize snake body segments
  const initializeSnake = () => {
    const worldWidth = canvasSize.width;
    const worldHeight = canvasSize.height;
    
    // Player 1 (green) - starts on the left side facing right
    const body1 = [];
    const startX1 = worldWidth * 0.25;
    const startY1 = worldHeight / 2;
    const startAngle1 = 0; // facing right
    
    for (let i = 1; i <= INITIAL_LENGTH; i++) {
      body1.push({
        x: startX1 - (i * SEGMENT_SPACING) * Math.cos(startAngle1),
        y: startY1 - (i * SEGMENT_SPACING) * Math.sin(startAngle1)
      });
    }
    
    snakeRef.current = {
      head: { x: startX1, y: startY1 },
      angle: startAngle1,
      targetAngle: startAngle1,
      body: body1,
      length: INITIAL_LENGTH,
      alive: true,
      slowedUntil: 0,
      shootCooldown: 0,
      canShoot: true
    };
    
    // Player 2 (blue) - starts on the right side facing left
    if (gameMode === 'multiplayer') {
      const body2 = [];
      const startX2 = worldWidth * 0.75;
      const startY2 = worldHeight / 2;
      const startAngle2 = Math.PI; // facing left
      
      for (let i = 1; i <= INITIAL_LENGTH; i++) {
        body2.push({
          x: startX2 - (i * SEGMENT_SPACING) * Math.cos(startAngle2),
          y: startY2 - (i * SEGMENT_SPACING) * Math.sin(startAngle2)
        });
      }
      
      snake2Ref.current = {
        head: { x: startX2, y: startY2 },
        angle: startAngle2,
        targetAngle: startAngle2,
        body: body2,
        length: INITIAL_LENGTH,
        alive: true,
        slowedUntil: 0,
        shootCooldown: 0,
        canShoot: true
      };
    }
    
    // Clear projectiles
    projectilesRef.current = [];
    
    setGameOver(false);
    setScore(0);
    setScore2(0);
    setSnakeLengthDisplay(INITIAL_LENGTH);
    setSnake2LengthDisplay(INITIAL_LENGTH);
    setGameOverReason('');
    setWinner('');
    currentSpeedRef.current = DIFFICULTY_SETTINGS[difficulty].speed;
    setCurrentSpeedDisplay(DIFFICULTY_SETTINGS[difficulty].speed);
    generateFood();
  };

  // Update snake movement
  const updateSnake = (snake, isPlayer1) => {
    const keys = keysPressed.current;
    const rotationSpeed = DIFFICULTY_SETTINGS[difficulty].rotationSpeed;
    
    if (isPlayer1) {
      // Arrow keys for Player 1
      if (keys.ArrowLeft) {
        snake.targetAngle -= rotationSpeed;
      }
      if (keys.ArrowRight) {
        snake.targetAngle += rotationSpeed;
      }
    } else {
      // WASD for Player 2
      if (keys.KeyA) {
        snake.targetAngle -= rotationSpeed;
      }
      if (keys.KeyD) {
        snake.targetAngle += rotationSpeed;
      }
    }
    
    // Normalize target angle
    while (snake.targetAngle > Math.PI) {
      snake.targetAngle -= 2 * Math.PI;
    }
    while (snake.targetAngle < -Math.PI) {
      snake.targetAngle += 2 * Math.PI;
    }
    
    snake.angle = snake.targetAngle;
  };

  // Move snake and update body
  const moveSnake = (snake) => {
    if (!snake.alive) return;
    
    const worldWidth = canvasSize.width;
    const worldHeight = canvasSize.height;
    const now = Date.now();
    
    // Calculate speed (apply slow effect if active)
    let speed = currentSpeedRef.current;
    if (now < snake.slowedUntil) {
      speed *= SLOW_FACTOR;
    }
    
    // Move head
    snake.head.x += Math.cos(snake.angle) * speed;
    snake.head.y += Math.sin(snake.angle) * speed;
    
    // Wrap around screen edges
    if (snake.head.x < 0) snake.head.x = worldWidth;
    if (snake.head.x > worldWidth) snake.head.x = 0;
    if (snake.head.y < 0) snake.head.y = worldHeight;
    if (snake.head.y > worldHeight) snake.head.y = 0;
    
    // Update body
    const newBody = [];
    
    for (let i = 0; i < snake.length; i++) {
      const target = i === 0 ? snake.head : newBody[i - 1];
      let current;
      
      if (i < snake.body.length) {
        current = snake.body[i];
      } else {
        current = snake.body[snake.body.length - 1] || snake.head;
      }
      
      let dx = target.x - current.x;
      let dy = target.y - current.y;
      
      // Check if wrapping around would be shorter
      if (Math.abs(dx) > worldWidth / 2) {
        dx = dx > 0 ? dx - worldWidth : dx + worldWidth;
      }
      if (Math.abs(dy) > worldHeight / 2) {
        dy = dy > 0 ? dy - worldHeight : dy + worldHeight;
      }
      
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > SEGMENT_SPACING) {
        const ratio = SEGMENT_SPACING / distance;
        let newX = target.x - dx * ratio;
        let newY = target.y - dy * ratio;
        
        if (newX < 0) newX += worldWidth;
        if (newX > worldWidth) newX -= worldWidth;
        if (newY < 0) newY += worldHeight;
        if (newY > worldHeight) newY -= worldHeight;
        
        newBody.push({ x: newX, y: newY });
      } else {
        newBody.push({ x: current.x, y: current.y });
      }
    }
    
    snake.body = newBody;
  };

  // Check collisions
  const checkCollisions = () => {
    const snake1 = snakeRef.current;
    const snake2 = snake2Ref.current;
    const food = foodRef.current;
    
    // Check Player 1 food collision
    if (snake1.alive) {
      const distanceToFood = Math.sqrt(
        Math.pow(snake1.head.x - food.x, 2) + 
        Math.pow(snake1.head.y - food.y, 2)
      );
      
      if (distanceToFood < 15) {
        setScore(prev => prev + 10);
        snake1.length += 5;
        setSnakeLengthDisplay(snake1.length);
        
        if (difficulty === 'hard') {
          const settings = DIFFICULTY_SETTINGS.hard;
          const newSpeed = currentSpeedRef.current + settings.speedIncrementPerFood;
          const cappedSpeed = Math.min(newSpeed, settings.maxSpeed);
          currentSpeedRef.current = cappedSpeed;
          setCurrentSpeedDisplay(cappedSpeed);
        }
        
        generateFood();
      }
      
      // Check Player 1 self-collision
      for (let i = 5; i < snake1.body.length; i++) {
        const segment = snake1.body[i];
        const distance = Math.sqrt(
          Math.pow(snake1.head.x - segment.x, 2) + 
          Math.pow(snake1.head.y - segment.y, 2)
        );
        
        if (distance < 6) {
          snake1.alive = false;
          if (gameMode === 'single') {
            setGameOver(true);
            setGameOverReason('You hit yourself!');
          } else {
            setWinner('Player 2 (Blue)');
            setGameOver(true);
            setGameOverReason('Player 1 (Green) hit themselves!');
          }
          break;
        }
      }
      
      // Check Player 1 collision with Player 2 in multiplayer
      if (gameMode === 'multiplayer' && snake2.alive) {
        // Check collision with Player 2's head
        const distanceToP2Head = Math.sqrt(
          Math.pow(snake1.head.x - snake2.head.x, 2) + 
          Math.pow(snake1.head.y - snake2.head.y, 2)
        );
        
        if (distanceToP2Head < 10) {
          // Head-on collision - both die
          snake1.alive = false;
          snake2.alive = false;
          setGameOver(true);
          setWinner('Tie');
          setGameOverReason('Head-on collision!');
        } else {
          // Check collision with Player 2's body
          for (let i = 0; i < snake2.body.length; i++) {
            const segment = snake2.body[i];
            const distance = Math.sqrt(
              Math.pow(snake1.head.x - segment.x, 2) + 
              Math.pow(snake1.head.y - segment.y, 2)
            );
            
            if (distance < 6) {
              snake1.alive = false;
              setWinner('Player 2 (Blue)');
              setGameOver(true);
              setGameOverReason('Player 1 (Green) hit Player 2!');
              break;
            }
          }
        }
      }
    }
    
    // Check Player 2 food collision (multiplayer only)
    if (gameMode === 'multiplayer' && snake2.alive) {
      const distanceToFood = Math.sqrt(
        Math.pow(snake2.head.x - food.x, 2) + 
        Math.pow(snake2.head.y - food.y, 2)
      );
      
      if (distanceToFood < 15) {
        setScore2(prev => prev + 10);
        snake2.length += 5;
        setSnake2LengthDisplay(snake2.length);
        
        if (difficulty === 'hard') {
          const settings = DIFFICULTY_SETTINGS.hard;
          const newSpeed = currentSpeedRef.current + settings.speedIncrementPerFood;
          const cappedSpeed = Math.min(newSpeed, settings.maxSpeed);
          currentSpeedRef.current = cappedSpeed;
          setCurrentSpeedDisplay(cappedSpeed);
        }
        
        generateFood();
      }
      
      // Check Player 2 self-collision
      for (let i = 5; i < snake2.body.length; i++) {
        const segment = snake2.body[i];
        const distance = Math.sqrt(
          Math.pow(snake2.head.x - segment.x, 2) + 
          Math.pow(snake2.head.y - segment.y, 2)
        );
        
        if (distance < 6) {
          snake2.alive = false;
          setWinner('Player 1 (Green)');
          setGameOver(true);
          setGameOverReason('Player 2 (Blue) hit themselves!');
          break;
        }
      }
      
      // Check Player 2 collision with Player 1's body
      if (snake1.alive) {
        for (let i = 0; i < snake1.body.length; i++) {
          const segment = snake1.body[i];
          const distance = Math.sqrt(
            Math.pow(snake2.head.x - segment.x, 2) + 
            Math.pow(snake2.head.y - segment.y, 2)
          );
          
          if (distance < 6) {
            snake2.alive = false;
            setWinner('Player 1 (Green)');
            setGameOver(true);
            setGameOverReason('Player 2 (Blue) hit Player 1!');
            break;
          }
        }
      }
    }
  };

  // Main game loop
  const gameLoop = () => {
    if (gameOver || !gameStarted) return;
    
    const keys = keysPressed.current;
    
    // Handle shooting in multiplayer mode
    if (gameMode === 'multiplayer') {
      // Player 1 shoot (Arrow Up)
      if (keys.ArrowUp && snakeRef.current.alive) {
        shoot(snakeRef.current, 1);
      }
      
      // Player 2 shoot (W)
      if (keys.KeyW && snake2Ref.current.alive) {
        shoot(snake2Ref.current, 2);
      }
    }
    
    // Update projectiles
    updateProjectiles();
    checkProjectileCollisions();
    
    // Update Player 1
    updateSnake(snakeRef.current, true);
    moveSnake(snakeRef.current);
    
    // Update Player 2 (multiplayer only)
    if (gameMode === 'multiplayer') {
      updateSnake(snake2Ref.current, false);
      moveSnake(snake2Ref.current);
    }
    
    // Check all collisions
    checkCollisions();
    
    // Draw
    draw();
  };

  // Drawing function
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const snake = snakeRef.current;
    const snake2 = snake2Ref.current;
    const now = Date.now();
    
    const worldWidth = canvasSize.width;
    const worldHeight = canvasSize.height;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, worldWidth, worldHeight);
    
    // Draw grid
    ctx.strokeStyle = '#0f0f1e';
    ctx.lineWidth = 1;
    for (let i = 0; i < worldWidth; i += 30) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, worldHeight);
      ctx.stroke();
    }
    for (let i = 0; i < worldHeight; i += 30) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(worldWidth, i);
      ctx.stroke();
    }
    
    // Draw Player 1 (green) body segments
    for (let i = snake.body.length - 1; i >= 0; i--) {
      const segment = snake.body[i];
      const alpha = snake.alive ? 0.3 + (i / snake.body.length) * 0.7 : 0.2;
      
      ctx.fillStyle = `rgba(74, 222, 128, ${alpha})`;
      ctx.beginPath();
      ctx.arc(segment.x, segment.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw Player 1 head
    ctx.fillStyle = snake.alive ? '#22c55e' : '#666';
    ctx.beginPath();
    ctx.arc(snake.head.x, snake.head.y, 7, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw Player 1 slow effect indicator
    if (snake.alive && now < snake.slowedUntil) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(snake.head.x, snake.head.y, 12, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Draw Player 1 direction indicator
    if (snake.alive) {
      ctx.strokeStyle = '#86efac';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(snake.head.x, snake.head.y);
      ctx.lineTo(
        snake.head.x + Math.cos(snake.angle) * 15,
        snake.head.y + Math.sin(snake.angle) * 15
      );
      ctx.stroke();
    }
    
    // Draw Player 2 (blue) in multiplayer mode
    if (gameMode === 'multiplayer') {
      // Draw body segments
      for (let i = snake2.body.length - 1; i >= 0; i--) {
        const segment = snake2.body[i];
        const alpha = snake2.alive ? 0.3 + (i / snake2.body.length) * 0.7 : 0.2;
        
        ctx.fillStyle = `rgba(59, 130, 246, ${alpha})`;
        ctx.beginPath();
        ctx.arc(segment.x, segment.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Draw head
      ctx.fillStyle = snake2.alive ? '#3b82f6' : '#666';
      ctx.beginPath();
      ctx.arc(snake2.head.x, snake2.head.y, 7, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw Player 2 slow effect indicator
      if (snake2.alive && now < snake2.slowedUntil) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(snake2.head.x, snake2.head.y, 12, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // Draw direction indicator
      if (snake2.alive) {
        ctx.strokeStyle = '#93c5fd';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(snake2.head.x, snake2.head.y);
        ctx.lineTo(
          snake2.head.x + Math.cos(snake2.angle) * 15,
          snake2.head.y + Math.sin(snake2.angle) * 15
        );
        ctx.stroke();
      }
    }
    
    // Draw projectiles
    for (let proj of projectilesRef.current) {
      ctx.fillStyle = proj.color;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw glow
      ctx.fillStyle = `${proj.color}40`;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw food
    const food = foodRef.current;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(food.x, food.y, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Food glow effect
    ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
    ctx.beginPath();
    ctx.arc(food.x, food.y, 12, 0, Math.PI * 2);
    ctx.fill();
  };

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'KeyA', 'KeyD', 'KeyW'].includes(e.code)) {
        e.preventDefault();
        keysPressed.current[e.code] = true;
      }
    };
    
    const handleKeyUp = (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'KeyA', 'KeyD', 'KeyW'].includes(e.code)) {
        e.preventDefault();
        keysPressed.current[e.code] = false;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Game loop effect
  useEffect(() => {
    if (!gameStarted || gameOver) return;
    
    const interval = setInterval(gameLoop, 1000 / 60); // 60 FPS
    
    return () => clearInterval(interval);
  }, [gameStarted, gameOver, gameMode]);

  // Initial draw when game is not started
  useEffect(() => {
    if (!gameStarted) {
      draw();
    }
  }, [gameStarted, gameMode]);

  // Redraw when canvas size changes
  useEffect(() => {
    draw();
  }, [canvasSize]);

  const startGame = () => {
    initializeSnake();
    setGameStarted(true);
  };

  const restartGame = () => {
    initializeSnake();
    setGameStarted(true);
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // Calculate optimal canvas size for fullscreen
  const updateCanvasSize = () => {
    if (document.fullscreenElement) {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      const availableHeight = height - 60;
      const availableWidth = width - 20;
      
      setCanvasSize({ width: availableWidth, height: availableHeight });
      
      if (snakeRef.current) {
        const scaleX = availableWidth / CANVAS_WIDTH;
        const scaleY = availableHeight / CANVAS_HEIGHT;
        
        snakeRef.current.head.x = snakeRef.current.head.x * scaleX;
        snakeRef.current.head.y = snakeRef.current.head.y * scaleY;
        
        snakeRef.current.body = snakeRef.current.body.map(segment => ({
          x: segment.x * scaleX,
          y: segment.y * scaleY
        }));
        
        if (gameMode === 'multiplayer') {
          snake2Ref.current.head.x = snake2Ref.current.head.x * scaleX;
          snake2Ref.current.head.y = snake2Ref.current.head.y * scaleY;
          
          snake2Ref.current.body = snake2Ref.current.body.map(segment => ({
            x: segment.x * scaleX,
            y: segment.y * scaleY
          }));
        }
        
        foodRef.current.x = foodRef.current.x * scaleX;
        foodRef.current.y = foodRef.current.y * scaleY;
      }
    } else {
      if (snakeRef.current) {
        const scaleX = CANVAS_WIDTH / canvasSize.width;
        const scaleY = CANVAS_HEIGHT / canvasSize.height;
        
        snakeRef.current.head.x = snakeRef.current.head.x * scaleX;
        snakeRef.current.head.y = snakeRef.current.head.y * scaleY;
        
        snakeRef.current.body = snakeRef.current.body.map(segment => ({
          x: segment.x * scaleX,
          y: segment.y * scaleY
        }));
        
        if (gameMode === 'multiplayer') {
          snake2Ref.current.head.x = snake2Ref.current.head.x * scaleX;
          snake2Ref.current.head.y = snake2Ref.current.head.y * scaleY;
          
          snake2Ref.current.body = snake2Ref.current.body.map(segment => ({
            x: segment.x * scaleX,
            y: segment.y * scaleY
          }));
        }
        
        foodRef.current.x = foodRef.current.x * scaleX;
        foodRef.current.y = foodRef.current.y * scaleY;
      }
      
      setCanvasSize({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
    }
  };

  // Listen for fullscreen changes and window resize
  useEffect(() => {
    const handleFullscreenChange = () => {
      const wasFullscreen = isFullscreen;
      const nowFullscreen = !!document.fullscreenElement;
      
      setIsFullscreen(nowFullscreen);
      
      if (wasFullscreen && !nowFullscreen && gameStarted) {
        setGameOver(true);
        setGameOverReason('Exited fullscreen - Screen size changed!');
        setGameStarted(false);
        
        setTimeout(() => {
          updateCanvasSize();
        }, 100);
      } else {
        updateCanvasSize();
      }
    };

    const handleResize = () => {
      if (document.fullscreenElement) {
        updateCanvasSize();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('resize', handleResize);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('resize', handleResize);
    };
  }, [isFullscreen, gameStarted]);

  return (
    <div ref={containerRef} className={`flex flex-col items-center justify-center bg-gray-900 text-white ${isFullscreen ? 'p-0 w-full h-full' : 'min-h-screen p-2'}`}>
      <div className={`flex items-center gap-6 ${isFullscreen ? 'mb-1 mt-2' : 'mb-2'}`}>
        <h1 className={`font-bold text-green-400 ${isFullscreen ? 'text-2xl' : 'text-3xl'}`}>Smooth Snake</h1>
        
        {/* Single player score display */}
        {gameMode === 'single' && (
          <div className={`flex gap-4 ${isFullscreen ? 'text-base' : 'text-lg'}`}>
            <span>Score: <span className="text-yellow-400 font-bold">{score}</span></span>
            <span>Length: <span className="text-blue-400 font-bold">{snakeLengthDisplay}</span></span>
            {gameStarted && difficulty === 'hard' && (
              <span>Speed: <span className="text-orange-400 font-bold">{currentSpeedDisplay.toFixed(1)}x</span></span>
            )}
          </div>
        )}
        
        {/* Multiplayer score display */}
        {gameMode === 'multiplayer' && (
          <div className={`flex gap-6 ${isFullscreen ? 'text-base' : 'text-lg'}`}>
            <div className="flex flex-col items-center">
              <span className="text-green-400 font-bold text-sm">Player 1 (Green)</span>
              <span>Score: <span className="text-yellow-400 font-bold">{score}</span></span>
              <span>Length: <span className="text-blue-400 font-bold">{snakeLengthDisplay}</span></span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-blue-400 font-bold text-sm">Player 2 (Blue)</span>
              <span>Score: <span className="text-yellow-400 font-bold">{score2}</span></span>
              <span>Length: <span className="text-blue-400 font-bold">{snake2LengthDisplay}</span></span>
            </div>
            {gameStarted && difficulty === 'hard' && (
              <span>Speed: <span className="text-orange-400 font-bold">{currentSpeedDisplay.toFixed(1)}x</span></span>
            )}
          </div>
        )}
        
        {/* Game mode selector - only show when game is not started */}
        {!gameStarted && (
          <div className="flex gap-2 items-center">
            <span className="text-gray-400 text-sm">Mode:</span>
            <button
              onClick={() => setGameMode('single')}
              className={`px-3 py-1 rounded transition-colors text-sm ${
                gameMode === 'single' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Single Player
            </button>
            <button
              onClick={() => setGameMode('multiplayer')}
              className={`px-3 py-1 rounded transition-colors text-sm ${
                gameMode === 'multiplayer' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Multiplayer
            </button>
          </div>
        )}
        
        {/* Difficulty selector - only show when game is not started */}
        {!gameStarted && (
          <div className="flex gap-2 items-center">
            <span className="text-gray-400 text-sm">Difficulty:</span>
            <button
              onClick={() => setDifficulty('easy')}
              className={`px-3 py-1 rounded transition-colors text-sm ${
                difficulty === 'easy' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Easy
            </button>
            <button
              onClick={() => setDifficulty('hard')}
              className={`px-3 py-1 rounded transition-colors text-sm ${
                difficulty === 'hard' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Hard
            </button>
          </div>
        )}
        
        {/* Show current difficulty and mode during game */}
        {gameStarted && (
          <span className={`${isFullscreen ? 'text-sm' : 'text-base'} ${difficulty === 'hard' ? 'text-red-400' : 'text-blue-400'}`}>
            [{DIFFICULTY_SETTINGS[difficulty].label}] {gameMode === 'multiplayer' ? '[Multiplayer]' : ''}
          </span>
        )}
        
        <button
          onClick={toggleFullscreen}
          className="ml-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
          title={isFullscreen ? "Exit Fullscreen (Esc)" : "Enter Fullscreen"}
        >
          {isFullscreen ? '⊗ Exit' : '⛶ Fullscreen'}
        </button>
      </div>
      
      <div className="relative flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="border-4 border-green-500 rounded-lg shadow-2xl"
          style={{ display: 'block', maxWidth: '100%', maxHeight: '100%' }}
        />

        {/* Overlay: Start screen */}
        {!gameStarted && !gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-60 rounded-lg">
            <button 
              onClick={startGame}
              className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors text-xl shadow-lg"
            >
              Start Game
            </button>
            {gameMode === 'single' ? (
              <>
                <p className="mt-4 text-gray-300 text-base">
                  ← Turn Left | Turn Right →
                </p>
                <p className="mt-2 text-gray-400 text-sm">
                  Don't hit yourself!
                </p>
              </>
            ) : (
              <>
                <div className="mt-4 text-center">
                  <p className="text-green-400 text-base font-bold">
                    Player 1 (Green)
                  </p>
                  <p className="text-gray-300 text-sm">
                    ← → Arrow Keys to Turn | ↑ to Shoot
                  </p>
                </div>
                <div className="mt-3 text-center">
                  <p className="text-blue-400 text-base font-bold">
                    Player 2 (Blue)
                  </p>
                  <p className="text-gray-300 text-sm">
                    A D Keys to Turn | W to Shoot
                  </p>
                </div>
                <p className="mt-4 text-gray-400 text-sm">
                  Shoot your opponent to slow them down for 1 second!
                </p>
                <p className="mt-1 text-gray-500 text-xs">
                  Don't hit yourself or the other player!
                </p>
              </>
            )}
          </div>
        )}

        {/* Overlay: Game over screen */}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70 rounded-lg">
            <h2 className="text-3xl font-bold text-red-400 mb-2">Game Over!</h2>
            {winner && (
              <p className="text-2xl font-bold text-yellow-400 mb-2">
                {winner === 'Tie' ? "It's a Tie!" : `${winner} Wins!`}
              </p>
            )}
            <p className="text-lg text-red-300 mb-2">{gameOverReason}</p>
            
            {gameMode === 'single' ? (
              <p className="text-2xl mb-6">Final Score: <span className="text-yellow-400 font-bold">{score}</span></p>
            ) : (
              <div className="flex gap-8 mb-6">
                <div className="text-center">
                  <p className="text-green-400 font-bold">Player 1</p>
                  <p className="text-xl">Score: <span className="text-yellow-400 font-bold">{score}</span></p>
                </div>
                <div className="text-center">
                  <p className="text-blue-400 font-bold">Player 2</p>
                  <p className="text-xl">Score: <span className="text-yellow-400 font-bold">{score2}</span></p>
                </div>
              </div>
            )}
            
            <button 
              onClick={restartGame}
              className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors text-xl shadow-lg"
            >
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SnakeGame;