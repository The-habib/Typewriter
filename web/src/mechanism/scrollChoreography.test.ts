import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCROLL_CHAPTERS,
  computeChapterPresence,
  sampleScrollChoreography,
  smootherstep,
} from './scrollChoreography';

test('scroll chapters have strictly increasing normalized stops spanning 0 to 1', () => {
  assert.equal(SCROLL_CHAPTERS.length, 5);
  assert.equal(SCROLL_CHAPTERS[0].stop, 0);
  assert.equal(SCROLL_CHAPTERS[SCROLL_CHAPTERS.length - 1].stop, 1);

  for (let i = 1; i < SCROLL_CHAPTERS.length; i++) {
    assert.ok(
      SCROLL_CHAPTERS[i].stop > SCROLL_CHAPTERS[i - 1].stop,
      `chapter ${i} stop must strictly exceed previous stop`,
    );
  }
});

test('smootherstep preserves endpoints and monotonic ease curve', () => {
  assert.equal(smootherstep(-0.5), 0);
  assert.equal(smootherstep(0), 0);
  assert.equal(smootherstep(0.5), 0.5);
  assert.equal(smootherstep(1), 1);
  assert.equal(smootherstep(1.5), 1);

  let prev = 0;
  for (let i = 1; i <= 20; i++) {
    const cur = smootherstep(i / 20);
    assert.ok(cur >= prev);
    prev = cur;
  }
});

test('sampleScrollChoreography transitions smoothly across all 5 chapters and scrubs explode in final act', () => {
  const start = sampleScrollChoreography(0);
  assert.equal(start.chapterIndex, 0);
  assert.equal(start.explode, 0);
  assert.equal(start.animationMode, 'typing');

  const comb = sampleScrollChoreography(SCROLL_CHAPTERS[1].stop);
  assert.equal(comb.chapterIndex, 1);
  assert.equal(comb.animationMode, 'wave');
  assert.equal(comb.explode, 0);

  const springs = sampleScrollChoreography(SCROLL_CHAPTERS[3].stop);
  assert.equal(springs.chapterIndex, 3);
  assert.equal(springs.animationMode, 'springs');
  assert.equal(springs.explode, 0);

  const midExplode = sampleScrollChoreography(0.88);
  assert.ok(midExplode.explode > 0.25 && midExplode.explode < 0.75);

  const end = sampleScrollChoreography(1);
  assert.equal(end.chapterIndex, 4);
  assert.ok(end.explode > 0.85);
  assert.equal(end.animationMode, 'wave');
});

test('sampleScrollChoreography stays finite and continuous across dense samples', () => {
  let prev = sampleScrollChoreography(0);
  for (let i = 1; i <= 100; i++) {
    const cur = sampleScrollChoreography(i / 100);
    for (let axis = 0; axis < 3; axis++) {
      assert.ok(Number.isFinite(cur.position[axis]));
      assert.ok(Number.isFinite(cur.target[axis]));
      assert.ok(Math.abs(cur.position[axis] - prev.position[axis]) < 1.2);
    }
    assert.ok(Number.isFinite(cur.fov) && cur.fov >= 25 && cur.fov <= 45);
    assert.ok(cur.explode >= 0 && cur.explode <= 1);
    prev = cur;
  }
});

test('computeChapterPresence peaks cleanly at every stop and clears out during camera sweeps', () => {
  for (let i = 0; i < SCROLL_CHAPTERS.length; i++) {
    const atStop = computeChapterPresence(SCROLL_CHAPTERS[i].stop);
    assert.equal(atStop.activeIndex, i);
    assert.equal(atStop.presence, 1);
  }

  for (let i = 0; i < SCROLL_CHAPTERS.length - 1; i++) {
    const mid = (SCROLL_CHAPTERS[i].stop + SCROLL_CHAPTERS[i + 1].stop) * 0.5;
    const atMid = computeChapterPresence(mid);
    assert.equal(atMid.presence, 0);
    assert.equal(atMid.activeIndex, -1);
  }
});
