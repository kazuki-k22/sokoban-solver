# sokoban-solver

[![bounty](https://make.fun/badge/sokoban-solver-01-run-20261121.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121)
[![rank](https://make.fun/badge/sokoban-solver-01-run-20261121/kazuki-k22/sokoban-solver/rank.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121)
[![reward](https://make.fun/badge/sokoban-solver-01-run-20261121/kazuki-k22/sokoban-solver/reward.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121)

A push-optimal Sokoban solver for make.fun's [Build the best Sokoban solver](https://make.fun/bounty/sokoban-solver-01-run-20261121) bounty.

Each level is a one-wide hallway with small rooms off it. A box never leaves its room, so `main.ts` solves every room
on its own with a breadth-first search over pushes (optimal in pushes, with dead-square and 2 x 2 freeze pruning) and
joins the rooms with the player's walk along the hallway.

Run: `MAKEFUN_INPUT_DIR=<levels> MAKEFUN_OUTPUT_DIR=<out> node main.ts` (Node 22+). MIT licensed.
