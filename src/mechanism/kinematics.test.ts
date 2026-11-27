import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COIL_SPRINGS,
  COMB_BARS,
  HINGE_CLUSTERS,
  KEY_ACTUATORS,
  REF_ASPECT,
  STADIUM_HANDLE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  toX,
  toZ,
} from './blueprint';
import {
  createInitialKinematicState,
  getTierElevation,
  mapKeyboardInput,
  stepKinematics,
} from './kinematics';

test('blueprint preserves exact reference counts and aspect proportions', () => {
  assert.equal(COMB_BARS.length, 17);
  assert.equal(KEY_ACTUATORS.length, 26);
  assert.equal(COIL_SPRINGS.length, 2);
  assert.equal(HINGE_CLUSTERS.length, 6);

  const rowCounts = [0, 0, 0];
  for (const act of KEY_ACTUATORS) rowCounts[act.row] += 1;
  assert.deepEqual(rowCounts, [10, 9, 7]);

  assert.ok(Math.abs(WORLD_WIDTH / WORLD_HEIGHT - REF_ASPECT) < 1e-6);
  assert.ok(Math.abs(toX(0.5)) < 1e-9);
  assert.ok(Math.abs(toZ(0.5)) < 1e-9);

  for (let i = 1; i < COMB_BARS.length; i++) {
    assert.ok(COMB_BARS[i].u > COMB_BARS[i - 1].u);
  }
  assert.ok(Math.abs(COMB_BARS[8].u - 0.496) < 0.005);

  const loopW = (STADIUM_HANDLE.uMax - STADIUM_HANDLE.uMin) * WORLD_WIDTH;
  const loopH = (STADIUM_HANDLE.vMax - STADIUM_HANDLE.vMin) * WORLD_HEIGHT;
  assert.ok(loopW > loopH * 2.2 && loopW < loopH * 2.8);
});

test('exploded view strictly separates all 6 mechanical tiers monotonically', () => {
  const tiers = [
    'baseBrackets',
    'combBars',
    'linkageRods',
    'gimbalArcs',
    'plungerDiscs',
    'keycapArray',
  ] as const;
  for (const e of [0, 0.5, 1]) {
    for (let i = 1; i < tiers.length; i++) {
      const prev = getTierElevation(tiers[i - 1], e);
      const curr = getTierElevation(tiers[i], e);
      assert.ok(curr > prev, `Tier ${tiers[i]} must sit above ${tiers[i - 1]} at explode=${e}`);
    }
  }
  assert.ok(getTierElevation('keycapArray', 1) > getTierElevation('keycapArray', 0) + 3.0);
});

test('2nd-order kinematic solver actuates keys, comb levers, springs, and torsion twist smoothly', () => {
  const state = createInitialKinematicState('idle');
  assert.equal(stepKinematics(state, 0.016).moving, false);
  assert.equal(state.springScale, 1);
  assert.equal(state.torsionTwist, 0);

  state.spaceTarget = 1;
  state.keyTarget[2] = 1;
  state.backspaceTarget = 1;
  state.modeKeyTarget = 1;
  state.emojiTarget = 1;

  for (let i = 0; i < 40; i++) {
    stepKinematics(state, 0.016);
  }

  assert.ok(state.spacePress > 0.9, 'Spacebar should converge near 1');
  assert.ok(state.backspacePress > 0.9, 'Crimson Backspace key should converge near 1');
  assert.ok(state.modeKeyPress > 0.9, '123/ABC mode key should converge near 1');
  assert.ok(state.emojiPress > 0.9, 'Circular Emoji key should converge near 1');
  assert.ok(state.springScale > 1.2, 'Helical springs should elongate under spacebar load');
  assert.ok(state.torsionTwist > 0.35, 'Torsion coils should twist with spacebar depression');
  assert.ok(state.combAngles[1] > 0.08 && state.combAngles[2] > 0.08, 'Linked comb bars must pivot');
  assert.equal(state.combAngles[8], 0, 'Unlinked central comb bar remains at rest');

  assert.deepEqual(mapKeyboardInput(' '), { type: 'space' });
  assert.deepEqual(mapKeyboardInput('Enter'), { type: 'return' });
  assert.deepEqual(mapKeyboardInput('Shift'), { type: 'shift' });
  assert.deepEqual(mapKeyboardInput('Backspace'), { type: 'backspace' });
  assert.deepEqual(mapKeyboardInput('q'), { type: 'key', index: 0 });
  assert.deepEqual(mapKeyboardInput('9'), { type: 'key', index: 8 });
  assert.deepEqual(mapKeyboardInput('@'), { type: 'key', index: 17 });
  assert.equal(mapKeyboardInput('F12'), null);
});

test('live typing and wave animation modes produce continuous real-time mechanical strikes', () => {
  const typingState = createInitialKinematicState('typing');
  let totalStrikes = 0;
  for (let i = 0; i < 90; i++) {
    const res = stepKinematics(typingState, 0.016);
    assert.equal(res.moving, true);
    totalStrikes += res.strikeCount + (res.heavyStrike ? 1 : 0);
  }
  assert.ok(totalStrikes >= 4, `Expected >= 4 typing strikes in 1.44s, got ${totalStrikes}`);

  const springState = createInitialKinematicState('springs');
  let maxScale = 1;
  for (let i = 0; i < 90; i++) {
    stepKinematics(springState, 0.016);
    maxScale = Math.max(maxScale, springState.springScale);
  }
  assert.ok(maxScale > 1.15, 'Springs mode should smoothly elongate coil springs');
});
