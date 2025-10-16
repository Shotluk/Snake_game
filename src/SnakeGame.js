import React, { useRef, useEffect, useState } from 'react';

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 600;
const SEGMENT_SPACING = 8; // distance between body segments
const INITIAL_LENGTH = 15; // number of segments

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
  const [snakeLengthDisplay, setSnakeLengthDisplay] = useState(INITIAL_LENGTH);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
  const [gameOverReason, setGameOverReason] = useState('');
  const [difficulty, setDifficulty] = useState('easy');
  const [currentSpeedDisplay, setCurrentSpeedDisplay] = useState(DIFFICULTY_SETTINGS.easy.speed);
  const currentSpeedRef = useRef(DIFFICULTY_SETTINGS.easy.speed);
  
  // Game state stored in refs for smooth animation
  const snakeRef = useRef({
    head: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 },
    angle: 0, // current facing direction in radians (0 = right, Math.PI/2 = down)
    targetAngle: 0, // where we want to turn towards
    body: [], // array of {x, y} positions for body segments
    length: INITIAL_LENGTH // actual length
  });
  
  const foodRef = useRef({ x: 0, y: 0 });
  
  const keysPressed = useRef({
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false
  });

  // Generate food at random position (avoiding snake)
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
      
      // Check if food is too close to snake head or body
      const snake = snakeRef.current;
      const distanceToHead = Math.sqrt(
        Math.pow(newFood.x - snake.head.x, 2) + 
        Math.pow(newFood.y - snake.head.y, 2)
      );
      
      validPosition = distanceToHead > 50;
      
      // Also check body segments
      if (validPosition) {
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
      }
    }
    
    foodRef.current = newFood;
  };

  // Initialize snake body segments
  const initializeSnake = () => {
    const body = [];
    const startX = CANVAS_WIDTH / 2;
    const startY = CANVAS_HEIGHT / 2;
    const startAngle = 0; // facing right
    
    // Create body segments properly spaced behind the head
    for (let i = 1; i <= INITIAL_LENGTH; i++) {
      body.push({
        x: startX - (i * SEGMENT_SPACING) * Math.cos(startAngle),
        y: startY - (i * SEGMENT_SPACING) * Math.sin(startAngle)
      });
    }
    
    snakeRef.current = {
      head: { x: startX, y: startY },
      angle: startAngle,
      targetAngle: startAngle,
      body: body,
      length: INITIAL_LENGTH
    };
    
    setGameOver(false);
    setScore(0);
    setSnakeLengthDisplay(INITIAL_LENGTH);
    setGameOverReason('');
    currentSpeedRef.current = DIFFICULTY_SETTINGS[difficulty].speed; // Reset speed to base speed
    setCurrentSpeedDisplay(DIFFICULTY_SETTINGS[difficulty].speed);
    generateFood();
  };

  // Calculate target angle based on arrow keys (RELATIVE TURNING)
  const updateTargetAngle = () => {
    const keys = keysPressed.current;
    const rotationSpeed = DIFFICULTY_SETTINGS[difficulty].rotationSpeed;
    
    // Left arrow = turn left (counter-clockwise)
    if (keys.ArrowLeft) {
      snakeRef.current.targetAngle -= rotationSpeed;
    }
    
    // Right arrow = turn right (clockwise)
    if (keys.ArrowRight) {
      snakeRef.current.targetAngle += rotationSpeed;
    }
    
    // Normalize target angle to -PI to PI
    while (snakeRef.current.targetAngle > Math.PI) {
      snakeRef.current.targetAngle -= 2 * Math.PI;
    }
    while (snakeRef.current.targetAngle < -Math.PI) {
      snakeRef.current.targetAngle += 2 * Math.PI;
    }
  };

  // Main game loop
  const gameLoop = () => {
    if (gameOver || !gameStarted) return;
    
    const snake = snakeRef.current;
    const worldWidth = canvasSize.width;
    const worldHeight = canvasSize.height;
    
    // Update target angle based on pressed keys (relative turning)
    updateTargetAngle();
    
    // Use target angle directly (no smoothing needed for relative turning)
    snake.angle = snake.targetAngle;
    
    // Move head forward in current direction using current speed (which increases in hard mode)
    snake.head.x += Math.cos(snake.angle) * currentSpeedRef.current;
    snake.head.y += Math.sin(snake.angle) * currentSpeedRef.current;
    
    // Wrap around screen edges using dynamic world size
    if (snake.head.x < 0) snake.head.x = worldWidth;
    if (snake.head.x > worldWidth) snake.head.x = 0;
    if (snake.head.y < 0) snake.head.y = worldHeight;
    if (snake.head.y > worldHeight) snake.head.y = 0;
    
    // Update body - each segment follows the one in front
    const newBody = [];
    
    for (let i = 0; i < snake.length; i++) {
      const target = i === 0 ? snake.head : newBody[i - 1];
      let current;
      
      if (i < snake.body.length) {
        current = snake.body[i];
      } else {
        // New segment - start at the tail position
        current = snake.body[snake.body.length - 1] || snake.head;
      }
      
      // Calculate direction to target, accounting for screen wrapping
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
      
      // Move towards target maintaining spacing
      if (distance > SEGMENT_SPACING) {
        const ratio = SEGMENT_SPACING / distance;
        let newX = target.x - dx * ratio;
        let newY = target.y - dy * ratio;
        
        // Wrap the new position if needed
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
    
    // Check for food collision
    const food = foodRef.current;
    const distanceToFood = Math.sqrt(
      Math.pow(snake.head.x - food.x, 2) + 
      Math.pow(snake.head.y - food.y, 2)
    );
    
    if (distanceToFood < 15) {
      // Ate food!
      setScore(prev => prev + 10);
      snake.length += 5; // Grow by 5 segments - directly modify ref
      setSnakeLengthDisplay(snake.length); // Update display
      
      // Increase speed in hard mode only
      if (difficulty === 'hard') {
        const settings = DIFFICULTY_SETTINGS.hard;
        const newSpeed = currentSpeedRef.current + settings.speedIncrementPerFood;
        const cappedSpeed = Math.min(newSpeed, settings.maxSpeed);
        currentSpeedRef.current = cappedSpeed;
        setCurrentSpeedDisplay(cappedSpeed);
      }
      
      generateFood();
    }
    
    // Check for self collision
    const head = snake.head;
    const body = snake.body;
    
    // Check against body segments (skip first few segments to avoid immediate collision)
    for (let i = 5; i < body.length; i++) {
      const segment = body[i];
      const distance = Math.sqrt(
        Math.pow(head.x - segment.x, 2) + 
        Math.pow(head.y - segment.y, 2)
      );
      
      // Collision if head is within segment radius
      if (distance < 6) {
        setGameOver(true);
        setGameOverReason('You hit yourself!');
        break;
      }
    }
    
    // Draw
    draw();
  };

  // Drawing function
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const snake = snakeRef.current;
    
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
    
    // Draw body segments
    for (let i = snake.body.length - 1; i >= 0; i--) {
      const segment = snake.body[i];
      const alpha = 0.3 + (i / snake.body.length) * 0.7; // fade towards tail
      
      ctx.fillStyle = `rgba(74, 222, 128, ${alpha})`;
      ctx.beginPath();
      ctx.arc(segment.x, segment.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw head
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(snake.head.x, snake.head.y, 7, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw direction indicator (small line showing where head is facing)
    ctx.strokeStyle = '#86efac';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(snake.head.x, snake.head.y);
    ctx.lineTo(
      snake.head.x + Math.cos(snake.angle) * 15,
      snake.head.y + Math.sin(snake.angle) * 15
    );
    ctx.stroke();
    
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
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        keysPressed.current[e.key] = true;
      }
    };
    
    const handleKeyUp = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        keysPressed.current[e.key] = false;
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
  }, [gameStarted, gameOver]);

  // Initial draw when game is not started
  useEffect(() => {
    if (!gameStarted) {
      draw();
    }
  }, [gameStarted]);

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
      
      // Leave minimal space for UI - smaller header in fullscreen
      const availableHeight = height - 60; // Reduced from 100
      const availableWidth = width - 20; // Reduced from 40 to use more width
      
      // Use full rectangle - don't force it to be square!
      setCanvasSize({ width: availableWidth, height: availableHeight });
      
      // Update the snake's world boundaries
      if (snakeRef.current) {
        // Adjust snake position proportionally if it's outside new bounds
        const scaleX = availableWidth / CANVAS_WIDTH;
        const scaleY = availableHeight / CANVAS_HEIGHT;
        
        snakeRef.current.head.x = snakeRef.current.head.x * scaleX;
        snakeRef.current.head.y = snakeRef.current.head.y * scaleY;
        
        snakeRef.current.body = snakeRef.current.body.map(segment => ({
          x: segment.x * scaleX,
          y: segment.y * scaleY
        }));
        
        // Also scale food position
        foodRef.current.x = foodRef.current.x * scaleX;
        foodRef.current.y = foodRef.current.y * scaleY;
      }
    } else {
      // Scale back to default size
      if (snakeRef.current) {
        const scaleX = CANVAS_WIDTH / canvasSize.width;
        const scaleY = CANVAS_HEIGHT / canvasSize.height;
        
        snakeRef.current.head.x = snakeRef.current.head.x * scaleX;
        snakeRef.current.head.y = snakeRef.current.head.y * scaleY;
        
        snakeRef.current.body = snakeRef.current.body.map(segment => ({
          x: segment.x * scaleX,
          y: segment.y * scaleY
        }));
        
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
      
      // If exiting fullscreen and game was started, reset the game
      if (wasFullscreen && !nowFullscreen && gameStarted) {
        // End current game
        setGameOver(true);
        setGameOverReason('Exited fullscreen - Screen size changed!');
        setGameStarted(false);
        
        // Update canvas size after a short delay
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
        <div className={`flex gap-4 ${isFullscreen ? 'text-base' : 'text-lg'}`}>
          <span>Score: <span className="text-yellow-400 font-bold">{score}</span></span>
          <span>Length: <span className="text-blue-400 font-bold">{snakeLengthDisplay}</span></span>
          {/* Show speed indicator in hard mode during gameplay */}
          {gameStarted && difficulty === 'hard' && (
            <span>Speed: <span className="text-orange-400 font-bold">{currentSpeedDisplay.toFixed(1)}x</span></span>
          )}
        </div>
        
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
        
        {/* Show current difficulty during game */}
        {gameStarted && (
          <span className={`${isFullscreen ? 'text-sm' : 'text-base'} ${difficulty === 'hard' ? 'text-red-400' : 'text-blue-400'}`}>
            [{DIFFICULTY_SETTINGS[difficulty].label}]
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
            <p className="mt-4 text-gray-300 text-base">
              ← Turn Left | Turn Right →
            </p>
            <p className="mt-2 text-gray-400 text-sm">
              Don't hit yourself!
            </p>
          </div>
        )}

        {/* Overlay: Game over screen */}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70 rounded-lg">
            <h2 className="text-3xl font-bold text-red-400 mb-2">Game Over!</h2>
            <p className="text-lg text-red-300 mb-2">{gameOverReason}</p>
            <p className="text-2xl mb-6">Final Score: <span className="text-yellow-400 font-bold">{score}</span></p>
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