import React, { useState, useEffect, useCallback, useRef } from 'react';

const BOARD_SIZE = 20;
const INITIAL_SNAKE = [{ x: 10, y: 10 }];
const INITIAL_FOOD = { x: 15, y: 15 };
const INITIAL_DIRECTION = { x: 0, y: -1 };

const SnakeGame = () => {
  const [snake, setSnake] = useState(INITIAL_SNAKE);
  const [food, setFood] = useState(INITIAL_FOOD);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  
  // Use refs for immediate access to current values
  const directionRef = useRef(INITIAL_DIRECTION);
  const directionQueueRef = useRef([]);

  const generateFood = useCallback((currentSnake) => {
    // Create array of all empty positions
    const emptyPositions = [];
    
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        // Check if this position is occupied by snake
        const isOccupied = currentSnake.some(segment => 
          segment.x === x && segment.y === y
        );
        
        if (!isOccupied) {
          emptyPositions.push({ x, y });
        }
      }
    }
    
    // Pick random empty position
    if (emptyPositions.length === 0) {
      // Game won - no empty spaces left (extremely rare)
      return { x: 0, y: 0 };
    }
    
    const randomIndex = Math.floor(Math.random() * emptyPositions.length);
    return emptyPositions[randomIndex];
  }, []);

  const resetGame = () => {
    setSnake(INITIAL_SNAKE);
    setFood(INITIAL_FOOD);
    directionRef.current = INITIAL_DIRECTION;
    directionQueueRef.current = [];
    setGameOver(false);
    setScore(0);
    setGameStarted(true);
  };

  const moveSnake = useCallback(() => {
    if (gameOver || !gameStarted) return;

    // Process queued direction if available
    if (directionQueueRef.current.length > 0) {
      const nextDirection = directionQueueRef.current.shift();
      directionRef.current = nextDirection;
    }

    setSnake(prevSnake => {
      const newSnake = [...prevSnake];
      const head = { ...newSnake[0] };
      
      head.x += directionRef.current.x;
      head.y += directionRef.current.y;

      // Wrap around boundaries
      if (head.x < 0) {
        head.x = BOARD_SIZE - 1;
      } else if (head.x >= BOARD_SIZE) {
        head.x = 0;
      }
      
      if (head.y < 0) {
        head.y = BOARD_SIZE - 1;
      } else if (head.y >= BOARD_SIZE) {
        head.y = 0;
      }

      // Check self collision
      if (newSnake.some(segment => segment.x === head.x && segment.y === head.y)) {
        setGameOver(true);
        return prevSnake;
      }

      newSnake.unshift(head);

      // Check food collision
      if (head.x === food.x && head.y === food.y) {
        setScore(prev => prev + 10);
        setFood(generateFood(newSnake)); // Pass the updated snake to avoid spawning on it
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [food, gameOver, gameStarted, generateFood]);

  const handleKeyDown = useCallback((e) => {
    if (!gameStarted || gameOver) return;

    // Prevent default scrolling behavior
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
    }

    // Ignore key repeats
    if (e.repeat) return;

    let newDirection = null;

    switch (e.key) {
      case 'ArrowUp':
        newDirection = { x: 0, y: -1 };
        break;
      case 'ArrowDown':
        newDirection = { x: 0, y: 1 };
        break;
      case 'ArrowLeft':
        newDirection = { x: -1, y: 0 };
        break;
      case 'ArrowRight':
        newDirection = { x: 1, y: 0 };
        break;
      default:
        return;
    }

    const currentDirection = directionRef.current;
    
    // Check if the new direction is opposite to current (invalid move)
    if (currentDirection.x === -newDirection.x && currentDirection.y === -newDirection.y) {
      return;
    }

    // If it's the same direction, ignore
    if (currentDirection.x === newDirection.x && currentDirection.y === newDirection.y) {
      return;
    }

    // Check if this direction is already queued
    const queue = directionQueueRef.current;
    if (queue.length > 0) {
      const lastQueued = queue[queue.length - 1];
      if (lastQueued.x === newDirection.x && lastQueued.y === newDirection.y) {
        return;
      }
      
      // Don't allow opposite direction to last queued direction either
      if (lastQueued.x === -newDirection.x && lastQueued.y === -newDirection.y) {
        return;
      }
    }

    // Add to queue (max 1 move ahead to keep it responsive)
    if (queue.length < 1) {
      directionQueueRef.current.push(newDirection);
    }
  }, [gameStarted, gameOver]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const gameInterval = setInterval(moveSnake, 150);
    return () => clearInterval(gameInterval);
  }, [moveSnake]);

  const renderBoard = () => {
    const board = [];
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        let cellType = 'empty';
        
        if (snake.some(segment => segment.x === x && segment.y === y)) {
          cellType = snake[0].x === x && snake[0].y === y ? 'head' : 'body';
        } else if (food.x === x && food.y === y) {
          cellType = 'food';
        }

        board.push(
          <div
            key={`${x}-${y}`}
            className={`w-4 h-4 ${getCellClass(cellType)}`}
          />
        );
      }
    }
    return board;
  };

  const getCellClass = (cellType) => {
    switch (cellType) {
      case 'head':
        return 'bg-green-600 border border-green-700';
      case 'body':
        return 'bg-green-400 border border-green-500';
      case 'food':
        return 'bg-red-500 border border-red-600 rounded-full';
      default:
        return 'bg-gray-800 border border-gray-700';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <h1 className="text-4xl font-bold mb-4 text-green-400">Snake Game</h1>
      
      <div className="mb-4 text-xl">
        Score: <span className="text-yellow-400 font-bold">{score}</span>
      </div>

      <div 
        className="grid gap-0 border-2 border-green-400 mb-4 bg-gray-800"
        style={{
          gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
          width: '400px',
          height: '400px'
        }}
      >
        {renderBoard()}
      </div>

      {!gameStarted && !gameOver && (
        <div className="text-center">
          <button 
            onClick={resetGame}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors"
          >
            Start Game
          </button>
          <p className="mt-4 text-gray-400">Use arrow keys to control the snake</p>
        </div>
      )}

      {gameOver && (
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-400 mb-4">Game Over!</h2>
          <p className="mb-4">Final Score: {score}</p>
          <button 
            onClick={resetGame}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors"
          >
            Play Again
          </button>
        </div>
      )}

      {gameStarted && !gameOver && (
        <div className="text-center text-gray-400">
          <p>Use arrow keys to move</p>
          <p className="text-sm mt-2">Eat the red food to grow and score points!</p>
        </div>
      )}
    </div>
  );
};

export default SnakeGame;