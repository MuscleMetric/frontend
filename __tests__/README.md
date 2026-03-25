# Tests

These tests protect core workout logic.

Current coverage:

- workouts/live/bootLiveDraft.test.ts  
  Ensures live workout boot order works (server, local, bootstrap, quick start)

- lib/saveWorkout.test.ts  
  Ensures workout save payload is built correctly

When adding new features:
- Add tests when modifying live workout logic
- Add tests when modifying save logic
- Add tests when modifying draft shape
- Add tests when modifying RPC payloads