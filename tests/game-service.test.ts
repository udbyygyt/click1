import { describe, expect, it } from 'vitest';
import { GameService } from '../src/server/game-service.js';

describe('GameService', () => {
  it('keeps one current game per wallet and archives it when explicitly replaced', async () => {
    const service = new GameService();
    const first = await service.startCurrentGame('wallet-1');
    const resumed = await service.startCurrentGame('wallet-1');
    const replacement = await service.startCurrentGame('wallet-1', true);

    expect(resumed.id).toBe(first.id);
    expect(replacement.id).not.toBe(first.id);
  });

  it('applies a move and permits one free undo per UTC day', async () => {
    const service = new GameService();
    const game = await service.startCurrentGame('wallet-1', true);
    const tile = game.state.board
      .map((row, rowIndex) => row.map((value, colIndex) => ({ value, rowIndex, colIndex })))
      .flat()
      .find((cell) => cell.value > 0)!;
    const moved = await service.applyCurrentMove('wallet-1', tile.rowIndex, tile.colIndex);
    expect(moved.state.canUndo).toBe(true);

    const beforeUndo = await service.getDailyUndoStatus('wallet-1', new Date('2026-08-26T12:00:00Z'));
    expect(beforeUndo.available).toBe(true);
    const undone = await service.undoCurrent('wallet-1', new Date('2026-08-26T12:00:00Z'));
    expect(undone.canUndo).toBe(false);
    const afterUndo = await service.getDailyUndoStatus('wallet-1', new Date('2026-08-26T12:00:00Z'));
    expect(afterUndo.available).toBe(false);
  });

  it('binds a paid undo order to the latest move and confirms it once', async () => {
    const service = new GameService();
    const game = await service.startCurrentGame('wallet-1', true);
    const tile = game.state.board
      .map((row, rowIndex) => row.map((value, colIndex) => ({ value, rowIndex, colIndex })))
      .flat()
      .find((cell) => cell.value > 0)!;
    const moved = await service.applyCurrentMove('wallet-1', tile.rowIndex, tile.colIndex);
    const order = await service.createPaidUndoOrder('wallet-1', 'treasury-address', 'mainnet-beta');
    const duplicateQuote = await service.createPaidUndoOrder('wallet-1', 'treasury-address', 'mainnet-beta');

    expect(order.moveId).toBe(moved.moveId);
    expect(duplicateQuote.id).toBe(order.id);
    const confirmed = await service.confirmPaidUndo('wallet-1', order.id, 'tx-signature');
    expect(confirmed.canUndo).toBe(false);
    const nextTile = confirmed.board
      .map((row, rowIndex) => row.map((value, colIndex) => ({ value, rowIndex, colIndex })))
      .flat()
      .find((cell) => cell.value > 0)!;
    await service.applyCurrentMove('wallet-1', nextTile.rowIndex, nextTile.colIndex);
    const duplicate = await service.confirmPaidUndo('wallet-1', order.id, 'tx-signature');
    expect(duplicate).toEqual(confirmed);
    await expect(service.confirmPaidUndo('wallet-1', order.id, 'other-signature')).rejects.toThrow('transaction signature does not match order');
  });
});
