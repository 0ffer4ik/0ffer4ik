import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const levels = { easy: 40, medium: 32, hard: 26 } as const;
type Difficulty = keyof typeof levels;
type RandomSource = () => number;

function shuffled<T>(items: T[], random: RandomSource = Math.random): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function seededRandom(seedText: string): RandomSource {
  let seed = 2166136261;
  for (const character of seedText) {
    seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  }
  if (seed === 0) seed = 1;

  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function generatePuzzle(difficulty: Difficulty, random: RandomSource = Math.random) {
  const peers = Array.from({ length: 81 }, (_, index) => {
    const row = Math.floor(index / 9);
    const col = index % 9;
    const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
    return Array.from({ length: 81 }, (_, other) => other).filter((other) => {
      if (other === index) return false;
      const otherRow = Math.floor(other / 9);
      const otherCol = other % 9;
      const otherBox = Math.floor(otherRow / 3) * 3 + Math.floor(otherCol / 3);
      return row === otherRow || col === otherCol || box === otherBox;
    });
  });

  const candidates = (board: number[], index: number) => {
    const used = new Set(peers[index].map((peer) => board[peer]).filter(Boolean));
    return Array.from({ length: 9 }, (_, i) => i + 1).filter((digit) => !used.has(digit));
  };

  const nextCell = (board: number[]) => {
    let bestIndex = -1;
    let bestValues: number[] = [];
    for (let i = 0; i < board.length; i++) {
      if (board[i]) continue;
      const values = candidates(board, i);
      if (values.length === 0) return { index: i, values };
      if (bestIndex === -1 || values.length < bestValues.length) {
        bestIndex = i;
        bestValues = values;
        if (values.length === 1) break;
      }
    }
    return { index: bestIndex, values: bestValues };
  };

  const fill = (board: number[]): boolean => {
    const cell = nextCell(board);
    if (cell.index === -1) return true;
    if (cell.values.length === 0) return false;
    for (const digit of shuffled(cell.values, random)) {
      board[cell.index] = digit;
      if (fill(board)) return true;
    }
    board[cell.index] = 0;
    return false;
  };

  const countSolutions = (board: number[], limit: number): number => {
    const cell = nextCell(board);
    if (cell.index === -1) return 1;
    if (cell.values.length === 0) return 0;
    let total = 0;
    for (const digit of cell.values) {
      board[cell.index] = digit;
      total += countSolutions(board, limit - total);
      board[cell.index] = 0;
      if (total >= limit) break;
    }
    return total;
  };

  const solution = Array<number>(81).fill(0);
  if (!fill(solution)) throw new Error("Could not generate a Sudoku solution");
  const puzzle = solution.slice();
  let clues = 81;
  for (const index of shuffled(Array.from({ length: 81 }, (_, i) => i), random)) {
    if (clues <= levels[difficulty]) break;
    const value = puzzle[index];
    puzzle[index] = 0;
    if (countSolutions(puzzle.slice(), 2) === 1) clues--;
    else puzzle[index] = value;
  }
  return { puzzle, solution };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return Response.json({ error: "Server is missing Supabase configuration" }, { status: 500, headers: corsHeaders });
  }

  const authorization = request.headers.get("Authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return Response.json({ error: "Sign in to use ranked games" }, { status: 401, headers: corsHeaders });
  }

  try {
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: userData, error: authError } = await admin.auth.getUser(token);
    if (authError || !userData.user) {
      return Response.json({ error: "Session expired. Sign in again." }, { status: 401, headers: corsHeaders });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "Invalid request body" }, { status: 400, headers: corsHeaders });
    }

    if (body.action === "new_game") {
      if (typeof body.difficulty !== "string" || !Object.hasOwn(levels, body.difficulty)) {
        return Response.json({ error: "Invalid difficulty" }, { status: 400, headers: corsHeaders });
      }
      const difficulty = body.difficulty as Difficulty;
      const { puzzle, solution } = generatePuzzle(difficulty);
      const { data: game, error } = await admin
        .from("sudoku_games")
        .insert({ user_id: userData.user.id, difficulty, puzzle, solution })
        .select("id")
        .single();
      if (error) throw error;
      return Response.json({ gameId: game.id, puzzle }, { headers: corsHeaders });
    }

    if (body.action === "daily_new_game") {
      const challengeDate = new Date().toISOString().slice(0, 10);
      const { data: stats, error: statsError } = await admin
        .from("sudoku_daily_stats")
        .select("last_challenge_date")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (statsError) throw statsError;
      if (stats?.last_challenge_date === challengeDate) {
        return Response.json({ completed: true, challengeDate }, { headers: corsHeaders });
      }

      const { data: activeGame, error: activeError } = await admin
        .from("sudoku_games")
        .select("id, puzzle")
        .eq("user_id", userData.user.id)
        .eq("mode", "daily")
        .eq("challenge_date", challengeDate)
        .is("completed_at", null)
        .maybeSingle();
      if (activeError) throw activeError;
      if (activeGame) {
        return Response.json({
          gameId: activeGame.id,
          puzzle: activeGame.puzzle,
          challengeDate,
        }, { headers: corsHeaders });
      }

      const { puzzle, solution } = generatePuzzle("medium", seededRandom(challengeDate));
      const { data: game, error: insertError } = await admin
        .from("sudoku_games")
        .insert({
          user_id: userData.user.id,
          difficulty: "medium",
          puzzle,
          solution,
          mode: "daily",
          challenge_date: challengeDate,
        })
        .select("id")
        .single();
      if (insertError?.code === "23505") {
        const { data: completedStats, error: completedStatsError } = await admin
          .from("sudoku_daily_stats")
          .select("last_challenge_date")
          .eq("user_id", userData.user.id)
          .maybeSingle();
        if (completedStatsError) throw completedStatsError;
        if (completedStats?.last_challenge_date === challengeDate) {
          return Response.json({ completed: true, challengeDate }, { headers: corsHeaders });
        }

        const { data: concurrentGame, error: retryError } = await admin
          .from("sudoku_games")
          .select("id, puzzle")
          .eq("user_id", userData.user.id)
          .eq("mode", "daily")
          .eq("challenge_date", challengeDate)
          .is("completed_at", null)
          .maybeSingle();
        if (retryError) throw retryError;
        if (concurrentGame) {
          return Response.json({
            gameId: concurrentGame.id,
            puzzle: concurrentGame.puzzle,
            challengeDate,
          }, { headers: corsHeaders });
        }
      }
      if (insertError) throw insertError;
      return Response.json({ gameId: game.id, puzzle, challengeDate }, { headers: corsHeaders });
    }

    if (body.action === "submit") {
      if (typeof body.gameId !== "string" || !Array.isArray(body.board) ||
          body.board.length !== 81 || body.board.some((value: unknown) =>
            typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 9)) {
        return Response.json({ error: "Invalid completed board" }, { status: 400, headers: corsHeaders });
      }
      const { data: game, error: gameError } = await admin
        .from("sudoku_games")
        .select("mode")
        .eq("id", body.gameId)
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (gameError) throw gameError;
      if (game?.mode !== "ranked") {
        return Response.json({ error: "Start a new ranked game before submitting a result" }, {
          status: 400,
          headers: corsHeaders,
        });
      }
      const { data, error } = await admin.rpc("record_sudoku_score", {
        p_game_id: body.gameId,
        p_user_id: userData.user.id,
        p_board: body.board,
      });
      if (error) {
        return Response.json({ error: "The result could not be verified. Start a new ranked game." }, {
          status: 400,
          headers: corsHeaders,
        });
      }
      return Response.json(data[0], { headers: corsHeaders });
    }

    if (body.action === "daily_submit") {
      if (typeof body.gameId !== "string" || !Array.isArray(body.board) ||
          body.board.length !== 81 || body.board.some((value: unknown) =>
            typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 9)) {
        return Response.json({ error: "Invalid completed board" }, { status: 400, headers: corsHeaders });
      }
      const { data, error } = await admin.rpc("record_sudoku_daily_result", {
        p_game_id: body.gameId,
        p_user_id: userData.user.id,
        p_board: body.board,
      });
      if (error) {
        console.error("Daily Sudoku result verification failed:", error);
        return Response.json({ error: "The result could not be verified. Start today's challenge again." }, {
          status: 400,
          headers: corsHeaders,
        });
      }
      return Response.json(data[0], { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (error) {
    console.error("Sudoku edge function failed:", error);
    return Response.json({ error: "Could not process the Sudoku request" }, { status: 500, headers: corsHeaders });
  }
});
