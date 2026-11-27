import * as THREE from 'three';
import {
  CLEVIS_JOINTS,
  COIL_SPRINGS,
  COMB_BARS,
  HINGE_CLUSTERS,
  KEY_ACTUATORS,
  LOWER_CARRIAGE,
  STADIUM_HANDLE,
  TIER_BASE_Y,
  toX,
  toZ,
  uSize,
  vSize,
  type KeycapLayoutMode,
  type KeycapViewMode,
  type TierKey,
} from './blueprint';
import {
  createBearingPillowBlockGeometry,
  createBellCrankLeverGeometry,
  createBeveledBlockGeometry,
  createClevisForkGeometry,
  createCombBarGeometry,
  createEarBracketGeometry,
  createHelicalSpringGeometry,
  createMicroReturnSpringGeometry,
  createPlungerDiscGeometry,
  createRoundedStripGeometry,
  createSplitCArcGeometry,
  createStadiumLoopGeometry,
  createTClampGeometry,
  createTorsionCoilGeometry,
  createTypewriterPillBezelGeometry,
  createTypewriterPillEnamelGeometry,
  createTypewriterPillLegendGeometry,
  createTypewriterRoundBezelGeometry,
  createTypewriterRoundEnamelGeometry,
  createTypewriterRoundLegendGeometry,
} from './geometryBuilders';
import { getTierElevation, type MechanismKinematicState } from './kinematics';
import { setKeycapLayout, type MechanismMaterialSet } from './materials';
import {
  createDynamicKeyShadowMaterial,
  createDynamicShadowPlaneGeometry,
  type DynamicKeyShadowUniforms,
} from './typewriterShaders';

export interface InteractiveUserData {
  partCategory:
    | 'comb'
    | 'actuator'
    | 'spring'
    | 'carriage'
    | 'stadium'
    | 'shiftLeft'
    | 'hinge'
    | 'keycap';
  actionType?: 'key' | 'space' | 'return' | 'shift' | 'backspace' | 'mode' | 'emoji';
  keyIndex?: number;
  label?: string;
}

export class MechanismAssembly {
  public readonly root = new THREE.Group();
  public readonly interactables: THREE.Object3D[] = [];

  private readonly tierGroups: Record<TierKey, THREE.Group> = {
    baseBrackets: new THREE.Group(),
    combBars: new THREE.Group(),
    linkageRods: new THREE.Group(),
    gimbalArcs: new THREE.Group(),
    plungerDiscs: new THREE.Group(),
    keycapArray: new THREE.Group(),
  };

  private readonly combPivots: THREE.Group[] = [];
  private readonly plungerGroups: THREE.Group[] = [];
  private readonly plungerBaseY: number[] = [];
  private readonly plungerCoords: Array<{ x: number; z: number; slotAngle: number }> = [];
  private instScrewHeads: THREE.InstancedMesh | null = null;
  private instScrewSlots: THREE.InstancedMesh | null = null;
  private instPushRods: THREE.InstancedMesh | null = null;
  private instMicroSprings: THREE.InstancedMesh | null = null;
  private instTappetForks: THREE.InstancedMesh | null = null;
  private instTappetPins: THREE.InstancedMesh | null = null;
  private instKeycapCollets: THREE.InstancedMesh | null = null;
  private readonly instDummy = new THREE.Object3D();
  private readonly prevPlungerPress = new Float32Array(26).fill(-1);
  private readonly prevColletPress = new Float32Array(26).fill(-1);
  private prevCutawayForCollets = false;
  private readonly springMeshes: THREE.Mesh[] = [];
  private readonly torsionMeshes: THREE.Mesh[] = [];
  private readonly bellCrankPivots: THREE.Group[] = [];
  private readonly springTails: THREE.Mesh[] = [];
  private readonly springTailBaseZ: number[] = [];
  private readonly springLengths: number[] = [];

  private readonly keycapGroups: THREE.Group[] = [];
  private readonly keycapBezelMeshes: THREE.Mesh[] = [];
  private readonly keycapEnamelMeshes: THREE.Mesh[] = [];
  private readonly keycapIsRightBank: boolean[] = [];

  private readonly shiftKeycapGroup = new THREE.Group();
  private shiftBezelMesh: THREE.Mesh | null = null;
  private shiftEnamelMesh: THREE.Mesh | null = null;

  private readonly backspaceKeycapGroup = new THREE.Group();
  private backspaceBezelMesh: THREE.Mesh | null = null;
  private backspaceEnamelMesh: THREE.Mesh | null = null;

  private readonly modeKeycapGroup = new THREE.Group();
  private modeBezelMesh: THREE.Mesh | null = null;
  private modeEnamelMesh: THREE.Mesh | null = null;

  private readonly emojiKeycapGroup = new THREE.Group();
  private emojiBezelMesh: THREE.Mesh | null = null;
  private emojiEnamelMesh: THREE.Mesh | null = null;

  private readonly spaceKeycapGroup = new THREE.Group();
  private spaceBezelMesh: THREE.Mesh | null = null;
  private spaceEnamelMesh: THREE.Mesh | null = null;

  private readonly returnKeycapGroup = new THREE.Group();
  private returnBezelMesh: THREE.Mesh | null = null;
  private returnEnamelMesh: THREE.Mesh | null = null;

  private dynamicShadowMat: THREE.ShaderMaterial | null = null;
  private dynamicShadowUniforms: DynamicKeyShadowUniforms | null = null;
  private keycapViewMode: KeycapViewMode = 'assembled';
  private keycapLayoutMode: KeycapLayoutMode = 'qwerty';

  private readonly spaceCarriageGroup = new THREE.Group();
  private readonly returnAssemblyGroup = new THREE.Group();
  private readonly returnRodGroup = new THREE.Group();
  private readonly shiftLeftGroup = new THREE.Group();
  private readonly shiftRodsGroup = new THREE.Group();
  private eccentricRollerGroup: THREE.Group | null = null;

  private readonly disposableGeometries: THREE.BufferGeometry[] = [];

  constructor(
    private readonly materials: MechanismMaterialSet,
    private readonly highDetail = true,
  ) {
    this.root.name = 'PrecisionKeybarMechanism';

    for (const key of Object.keys(this.tierGroups) as TierKey[]) {
      const g = this.tierGroups[key];
      g.name = `tier-${key}`;
      g.position.y = TIER_BASE_Y[key];
      this.root.add(g);
    }

    this.buildBaseBracketsAndTabs();
    this.buildCombKeybars();
    this.buildHingesClevisAndRods();
    this.buildSpringsAndSpaceCarriage();
    this.buildGimbalArcsAndPlungers();
    this.buildLeftShiftAssembly();
    this.buildRightStadiumReturnAssembly();
    this.buildKeycapArray();
  }

  private trackGeo<T extends THREE.BufferGeometry>(geo: T): T {
    this.disposableGeometries.push(geo);
    return geo;
  }

  private makeMesh(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    meta: InteractiveUserData,
    castShadow = true,
    interactive = true,
  ): THREE.Mesh {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = castShadow;
    m.receiveShadow = true;
    m.userData = meta;
    if (interactive) {
      this.interactables.push(m);
    }
    return m;
  }

  private addInstanced(
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    positions: Array<[number, number, number]>,
    castShadow = false,
  ): THREE.InstancedMesh {
    const inst = new THREE.InstancedMesh(geo, mat, positions.length);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < positions.length; i++) {
      dummy.position.set(positions[i][0], positions[i][1], positions[i][2]);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = castShadow;
    inst.receiveShadow = true;
    parent.add(inst);
    return inst;
  }

  /**
   * Tier 1: Left & right ear-flange mounting brackets with bronze-bushed holes,
   * bottom mounting lugs, horizontal torsion axles, and pivoting bell-crank rockers.
   */
  private buildBaseBracketsAndTabs(): void {
    const tier = this.tierGroups.baseBrackets;
    const earZ = toZ(LOWER_CARRIAGE.earHoleV);

    const leftBracketGeo = this.trackGeo(createEarBracketGeometry('left'));
    const leftBracket = this.makeMesh(leftBracketGeo, this.materials.housingMatte, {
      partCategory: 'carriage',
      actionType: 'space',
      label: 'Left Ear-Flange Mounting Bracket',
    });
    leftBracket.position.set(toX(LOWER_CARRIAGE.leftBracketStemU), 0.04, earZ);
    tier.add(leftBracket);

    const rightBracketGeo = this.trackGeo(createEarBracketGeometry('right'));
    const rightBracket = this.makeMesh(rightBracketGeo, this.materials.housingMatte, {
      partCategory: 'carriage',
      actionType: 'space',
      label: 'Right Ear-Flange Mounting Bracket',
    });
    rightBracket.position.set(toX(LOWER_CARRIAGE.rightBracketStemU), 0.04, earZ);
    tier.add(rightBracket);

    // Chamfered chrome outer ring + Oilite bronze press-fit bearing liner inside both ear holes
    const earRingGeo = this.trackGeo(new THREE.TorusGeometry(0.104, 0.019, 10, 26));
    earRingGeo.rotateX(Math.PI / 2);
    const earBronzeGeo = this.trackGeo(new THREE.CylinderGeometry(0.098, 0.098, 0.145, 24, 1, true));
    const earBoltGeo = this.trackGeo(new THREE.CylinderGeometry(0.036, 0.036, 0.04, 14));
    const earHexGeo = this.trackGeo(new THREE.CylinderGeometry(0.018, 0.018, 0.046, 6));

    for (const [idx, uHole] of [
      LOWER_CARRIAGE.leftEarHoleU,
      LOWER_CARRIAGE.rightEarHoleU,
    ].entries()) {
      const xHole = toX(uHole);
      const ring = this.makeMesh(earRingGeo, this.materials.mirrorChrome, {
        partCategory: 'carriage',
        actionType: 'space',
      });
      ring.position.set(xHole, 0.115, earZ);
      tier.add(ring);

      const liner = this.makeMesh(earBronzeGeo, this.materials.bearingBronze, {
        partCategory: 'carriage',
        actionType: 'space',
      }, false);
      liner.position.set(xHole, 0.042, earZ);
      tier.add(liner);

      // Shoulder retention cap screw near stem root
      const stemX = toX(
        idx === 0 ? LOWER_CARRIAGE.leftBracketStemU : LOWER_CARRIAGE.rightBracketStemU,
      );
      const bolt = this.makeMesh(earBoltGeo, this.materials.mirrorChrome, {
        partCategory: 'carriage',
        actionType: 'space',
      }, false);
      bolt.position.set(stemX, 0.125, earZ - 0.18);
      tier.add(bolt);
      const hex = this.makeMesh(earHexGeo, this.materials.recessedDark, {
        partCategory: 'carriage',
        actionType: 'space',
      }, false);
      hex.position.set(stemX, 0.128, earZ - 0.18);
      tier.add(hex);
    }

    // Bottom vertical mounting lug dark recessed eye slots
    const lugSlotGeo = this.trackGeo(createRoundedStripGeometry(0.055, 0.17, 0.24));
    for (const uLug of [LOWER_CARRIAGE.leftBracketStemU, LOWER_CARRIAGE.rightBracketStemU]) {
      const slot = this.makeMesh(lugSlotGeo, this.materials.recessedDark, {
        partCategory: 'carriage',
        actionType: 'space',
      });
      slot.position.set(toX(uLug), 0.02, toZ(0.854));
      tier.add(slot);
    }

    // 17 Precision Rear Comb Pass-Through Slot Recesses (deep oil-blackened oval wells
    // with chamfered machined collars where each keybar emerges from the chassis deck)
    const rearSlotWellGeo = this.trackGeo(createRoundedStripGeometry(0.185, 0.44, 0.07));
    const rearSlotCollarGeo = this.trackGeo(createRoundedStripGeometry(0.245, 0.50, 0.036));
    const slotPositions: Array<[number, number, number]> = [];
    const collarPositions: Array<[number, number, number]> = [];
    const rearSlotZ = toZ(COMB_BARS[0].vStart) - 0.03;
    for (const bar of COMB_BARS) {
      const bx = toX(bar.u);
      slotPositions.push([bx, 0.028, rearSlotZ]);
      collarPositions.push([bx, 0.012, rearSlotZ]);
    }
    this.addInstanced(tier, rearSlotCollarGeo, this.materials.housingMatte, collarPositions, false);
    this.addInstanced(tier, rearSlotWellGeo, this.materials.recessedDark, slotPositions, false);

    // Lower horizontal torsion spring sleeves, bronze bushings, circlips & pivoting bell-cranks
    const pinGeo = this.trackGeo(new THREE.CylinderGeometry(0.052, 0.052, 0.68, 20));
    pinGeo.rotateZ(Math.PI / 2);
    const collarGeo = this.trackGeo(new THREE.CylinderGeometry(0.095, 0.095, 0.088, 20));
    collarGeo.rotateZ(Math.PI / 2);
    const bronzeBushingGeo = this.trackGeo(new THREE.CylinderGeometry(0.072, 0.072, 0.032, 20));
    bronzeBushingGeo.rotateZ(Math.PI / 2);
    const circlipGeo = this.trackGeo(new THREE.TorusGeometry(0.066, 0.012, 8, 20));
    circlipGeo.rotateY(Math.PI / 2);
    const bellCrankGeo = this.trackGeo(createBellCrankLeverGeometry(0.24, 0.068, 0.096));
    const crankPinGeo = this.trackGeo(new THREE.CylinderGeometry(0.028, 0.028, 0.14, 14));
    crankPinGeo.rotateZ(Math.PI / 2);

    for (const sp of COIL_SPRINGS) {
      const xCenter = toX((sp.torsionUStart + sp.torsionUEnd) * 0.5);
      const zTorsion = toZ(sp.torsionV);
      const lenX = uSize(sp.torsionUEnd - sp.torsionUStart);

      const pin = this.makeMesh(pinGeo, this.materials.mirrorChrome, {
        partCategory: 'spring',
        actionType: 'space',
        label: sp.side === 'left' ? 'Left Torsion Axle Shaft' : 'Right Torsion Axle Shaft',
      });
      pin.position.set(xCenter, 0.11, zTorsion);
      tier.add(pin);

      const torsionGeo = this.trackGeo(createTorsionCoilGeometry(lenX * 0.88, 0.086, 0.019, 6));
      const torsionMesh = this.makeMesh(torsionGeo, this.materials.springWire, {
        partCategory: 'spring',
        actionType: 'space',
        label: sp.side === 'left' ? 'Left Torsion Return Coil' : 'Right Torsion Return Coil',
      });
      torsionMesh.position.set(xCenter, 0.11, zTorsion);
      tier.add(torsionMesh);
      this.torsionMeshes.push(torsionMesh);

      // Real articulated Bell-Crank Rocker Arm clamped to torsion shaft aligned with coil spring
      const crankPivot = new THREE.Group();
      crankPivot.position.set(toX(sp.u), 0.11, zTorsion);
      const crankArm = this.makeMesh(bellCrankGeo, this.materials.machinedPrimary, {
        partCategory: 'spring',
        actionType: 'space',
        label: sp.side === 'left' ? 'Left Torsion Bell-Crank Arm' : 'Right Torsion Bell-Crank Arm',
      });
      // Orient arm toward -Z (upward to meet the helical spring bottom ferrule)
      crankArm.rotation.y = Math.PI;
      crankPivot.add(crankArm);

      const crankPin = this.makeMesh(crankPinGeo, this.materials.mirrorChrome, {
        partCategory: 'spring',
        actionType: 'space',
      }, false);
      crankPin.position.set(0, 0.015, -0.23);
      crankPivot.add(crankPin);

      tier.add(crankPivot);
      this.bellCrankPivots.push(crankPivot);

      // Flanking steel collars, Oilite bronze thrust washers, and mirror-chrome circlips
      for (const dir of [-1, 1]) {
        const collar = this.makeMesh(collarGeo, this.materials.housingMatte, {
          partCategory: 'spring',
          actionType: 'space',
        });
        collar.position.set(xCenter + dir * (lenX * 0.56), 0.11, zTorsion);
        tier.add(collar);

        const bushing = this.makeMesh(bronzeBushingGeo, this.materials.bearingBronze, {
          partCategory: 'spring',
          actionType: 'space',
        }, false);
        bushing.position.set(xCenter + dir * (lenX * 0.45), 0.11, zTorsion);
        tier.add(bushing);

        const clip = this.makeMesh(circlipGeo, this.materials.mirrorChrome, {
          partCategory: 'spring',
          actionType: 'space',
        }, false);
        clip.position.set(xCenter + dir * (lenX * 0.72), 0.11, zTorsion);
        tier.add(clip);
      }
    }
  }

  /**
   * Tier 2: 17 Parallel Curved-Hook Comb Keybars threaded onto a continuous mirror-chrome
   * rear fulcrum axle with 16 Oilite phosphor-bronze thrust washers and bolted pillow blocks.
   */
  private buildCombKeybars(): void {
    const tier = this.tierGroups.combBars;
    const barWidth = 0.145;
    const barThickness = 0.085;
    const hookDropY = 0.34;

    const hookDarkGeo = this.trackGeo(createBeveledBlockGeometry(0.115, 0.24, 0.17, 0.03, 0.012));
    const bottomTabGeo = this.trackGeo(createBeveledBlockGeometry(0.068, 0.22, 0.24, 0.025, 0.012));
    const tangBossGeo = this.trackGeo(new THREE.CylinderGeometry(0.062, 0.062, 0.158, 16));
    tangBossGeo.rotateZ(Math.PI / 2);

    const fulcrumZ = toZ(COMB_BARS[0].vStart) + 0.075;
    const fulcrumY = -0.22;

    for (const bar of COMB_BARS) {
      // Pivot group sits directly on the continuous rear fulcrum axle centerline for exact rotational kinematics
      const pivot = new THREE.Group();
      pivot.name = bar.id;
      pivot.position.set(toX(bar.u), fulcrumY, fulcrumZ);

      const localY = bar.yOffset - fulcrumY;
      const localZ = -0.075;
      const lengthZ = vSize(bar.vEnd - bar.vStart);
      const barGeo = this.trackGeo(
        createCombBarGeometry(lengthZ, barWidth, barThickness, hookDropY, bar.hasBottomTab),
      );
      const barMesh = this.makeMesh(barGeo, this.materials.machinedPrimary, {
        partCategory: 'comb',
        actionType: bar.linkedKeyIndex !== null ? 'key' : 'space',
        keyIndex: bar.linkedKeyIndex ?? undefined,
        label: `Comb Keybar #${bar.index + 1}`,
      });
      barMesh.position.set(0, localY, localZ);
      pivot.add(barMesh);

      // Recessed dark curved-slot crown accent
      const darkTang = this.makeMesh(
        hookDarkGeo,
        this.materials.recessedDark,
        {
          partCategory: 'comb',
          actionType: bar.linkedKeyIndex !== null ? 'key' : 'space',
          keyIndex: bar.linkedKeyIndex ?? undefined,
        },
        true,
        false,
      );
      darkTang.position.set(0, localY - 0.08, localZ + 0.085);
      pivot.add(darkTang);

      // Machined pivot boss concentric with the continuous rear fulcrum axle
      const tangBoss = this.makeMesh(
        tangBossGeo,
        this.materials.housingMatte,
        {
          partCategory: 'comb',
          actionType: bar.linkedKeyIndex !== null ? 'key' : 'space',
          keyIndex: bar.linkedKeyIndex ?? undefined,
        },
        false,
        false,
      );
      tangBoss.position.set(0, 0, 0);
      pivot.add(tangBoss);

      if (bar.hasBottomTab) {
        const bottomFin = this.makeMesh(
          bottomTabGeo,
          this.materials.housingMatte,
          {
            partCategory: 'comb',
            actionType: 'space',
          },
          true,
          false,
        );
        bottomFin.position.set(0, localY - 0.14, localZ + lengthZ - 0.14);
        pivot.add(bottomFin);
      }

      tier.add(pivot);
      this.combPivots.push(pivot);
    }

    // Continuous Rear Fulcrum Steel Axle threading through all 17 comb bar pivot bosses
    const firstX = toX(COMB_BARS[0].u);
    const lastX = toX(COMB_BARS[COMB_BARS.length - 1].u);
    const axleLen = lastX - firstX + 0.62;
    const axleMidX = (firstX + lastX) * 0.5;

    const rearAxleGeo = this.trackGeo(new THREE.CylinderGeometry(0.042, 0.042, axleLen, 20));
    rearAxleGeo.rotateZ(Math.PI / 2);
    const rearAxle = this.makeMesh(rearAxleGeo, this.materials.mirrorChrome, {
      partCategory: 'comb',
      label: 'Continuous Rear Fulcrum Datum Axle',
    });
    rearAxle.position.set(axleMidX, fulcrumY, fulcrumZ);
    tier.add(rearAxle);

    // 16 Oilite Phosphor-Bronze Thrust Spacer Washers separating every adjacent pair of comb bars
    const thrustWasherGeo = this.trackGeo(new THREE.CylinderGeometry(0.068, 0.068, 0.038, 18));
    thrustWasherGeo.rotateZ(Math.PI / 2);
    const washerCount = COMB_BARS.length - 1;
    const bronzeWashers = new THREE.InstancedMesh(
      thrustWasherGeo,
      this.materials.bearingBronze,
      washerCount,
    );
    const dummy = new THREE.Object3D();
    for (let i = 0; i < washerCount; i++) {
      const midX = (toX(COMB_BARS[i].u) + toX(COMB_BARS[i + 1].u)) * 0.5;
      dummy.position.set(midX, fulcrumY, fulcrumZ);
      dummy.updateMatrix();
      bronzeWashers.setMatrixAt(i, dummy.matrix);
    }
    bronzeWashers.instanceMatrix.needsUpdate = true;
    bronzeWashers.receiveShadow = true;
    tier.add(bronzeWashers);

    // Left & Right CNC Bearing Pillow Blocks with mirror-chrome end circlips anchoring the fulcrum axle
    const pillowGeo = this.trackGeo(createBearingPillowBlockGeometry());
    const endClipGeo = this.trackGeo(new THREE.TorusGeometry(0.052, 0.011, 8, 18));
    endClipGeo.rotateY(Math.PI / 2);
    const capScrewGeo = this.trackGeo(new THREE.CylinderGeometry(0.026, 0.026, 0.04, 12));

    for (const [sideIdx, endX] of [firstX - 0.19, lastX + 0.19].entries()) {
      const pillow = this.makeMesh(pillowGeo, this.materials.housingMatte, {
        partCategory: 'comb',
        label: sideIdx === 0 ? 'Left Fulcrum Bearing Pillow' : 'Right Fulcrum Bearing Pillow',
      });
      pillow.position.set(endX, fulcrumY - 0.06, fulcrumZ);
      tier.add(pillow);

      const endClip = this.makeMesh(endClipGeo, this.materials.mirrorChrome, {
        partCategory: 'comb',
      }, false);
      endClip.position.set(endX + (sideIdx === 0 ? -0.08 : 0.08), fulcrumY, fulcrumZ);
      tier.add(endClip);

      for (const dz of [-0.11, 0.11]) {
        const screw = this.makeMesh(capScrewGeo, this.materials.mirrorChrome, {
          partCategory: 'comb',
        }, false);
        screw.position.set(endX, fulcrumY - 0.09, fulcrumZ + dz);
        tier.add(screw);
      }
    }
  }

  /**
   * Tier 3A: Mid-plane multi-knuckle transverse hinge shafts with bronze bushings & circlips,
   * 8 bushed clevis pin joints, and linked moving shift/return linkage rods.
   */
  private buildHingesClevisAndRods(): void {
    const tier = this.tierGroups.linkageRods;

    const bronzeWasherGeo = this.trackGeo(new THREE.CylinderGeometry(0.116, 0.116, 0.026, 22));
    bronzeWasherGeo.rotateZ(Math.PI / 2);
    const hingeCirclipGeo = this.trackGeo(new THREE.TorusGeometry(0.075, 0.012, 8, 18));
    hingeCirclipGeo.rotateY(Math.PI / 2);
    const grooveRingGeo = this.trackGeo(new THREE.TorusGeometry(0.105, 0.009, 6, 20));
    grooveRingGeo.rotateY(Math.PI / 2);

    const hingeCirclipPos: Array<[number, number, number]> = [];
    const hingeGroovePos: Array<[number, number, number]> = [];
    const hingeWasherPos: Array<[number, number, number]> = [];

    for (const h of HINGE_CLUSTERS) {
      const x0 = toX(h.uStart);
      const x1 = toX(h.uEnd);
      const len = x1 - x0;
      const xMid = (x0 + x1) * 0.5;
      const z = toZ(h.v);

      const shaftGeo = this.trackGeo(
        new THREE.CylinderGeometry(h.barrelRadius * 0.6, h.barrelRadius * 0.6, len + 0.14, 18),
      );
      shaftGeo.rotateZ(Math.PI / 2);
      const shaft = this.makeMesh(shaftGeo, this.materials.mirrorChrome, {
        partCategory: 'hinge',
        label: `Ground Pivot Axle (${h.id})`,
      });
      shaft.position.set(xMid, 0.02, z);
      tier.add(shaft);

      hingeCirclipPos.push([x0 - 0.035, 0.02, z], [x1 + 0.035, 0.02, z]);

      const knuckleGeo = this.trackGeo(
        new THREE.CylinderGeometry(h.barrelRadius, h.barrelRadius, 0.14, 20),
      );
      knuckleGeo.rotateZ(Math.PI / 2);

      for (const ku of h.knuckleU) {
        const kx = toX(ku);
        const knuckle = this.makeMesh(knuckleGeo, this.materials.machinedPrimary, {
          partCategory: 'hinge',
        });
        knuckle.position.set(kx, 0.02, z);
        tier.add(knuckle);

        hingeGroovePos.push([kx, 0.02, z]);
        hingeWasherPos.push([kx - 0.084, 0.02, z]);
      }
    }

    this.addInstanced(tier, hingeCirclipGeo, this.materials.mirrorChrome, hingeCirclipPos);
    this.addInstanced(tier, grooveRingGeo, this.materials.recessedDark, hingeGroovePos);
    this.addInstanced(tier, bronzeWasherGeo, this.materials.bearingBronze, hingeWasherPos);

    // 8 Intermediate clevis pin joints batched via InstancedMesh (40 hardware pieces -> 5 draw calls)
    const clevisBodyGeo = this.trackGeo(createBeveledBlockGeometry(0.175, 0.135, 0.21, 0.05, 0.018));
    const clevisPinGeo = this.trackGeo(new THREE.CylinderGeometry(0.042, 0.042, 0.25, 16));
    clevisPinGeo.rotateZ(Math.PI / 2);
    const clevisBushGeo = this.trackGeo(new THREE.CylinderGeometry(0.054, 0.054, 0.205, 14));
    clevisBushGeo.rotateZ(Math.PI / 2);
    const rivetCapGeo = this.trackGeo(new THREE.CylinderGeometry(0.036, 0.036, 0.155, 14));
    const rivetHexGeo = this.trackGeo(new THREE.CylinderGeometry(0.018, 0.018, 0.162, 6));

    const clevisPos: Array<[number, number, number]> = CLEVIS_JOINTS.map((cj) => [
      toX(cj.u),
      0.03,
      toZ(cj.v),
    ]);
    const clevisCapPos: Array<[number, number, number]> = CLEVIS_JOINTS.map((cj) => [
      toX(cj.u),
      0.035,
      toZ(cj.v),
    ]);
    const clevisHexPos: Array<[number, number, number]> = CLEVIS_JOINTS.map((cj) => [
      toX(cj.u),
      0.038,
      toZ(cj.v),
    ]);

    const clevisBodies = this.addInstanced(tier, clevisBodyGeo, this.materials.housingMatte, clevisPos, true);
    clevisBodies.userData = { partCategory: 'hinge', label: 'Articulated Bushed Clevis Joint' } as InteractiveUserData;
    this.interactables.push(clevisBodies);
    this.addInstanced(tier, clevisBushGeo, this.materials.bearingBronze, clevisPos);
    this.addInstanced(tier, clevisPinGeo, this.materials.mirrorChrome, clevisPos, true);
    this.addInstanced(tier, rivetCapGeo, this.materials.mirrorChrome, clevisCapPos);
    this.addInstanced(tier, rivetHexGeo, this.materials.recessedDark, clevisHexPos);

    // Linked Shift Guide Rods Group (moves physically with Left Shift Lock Assembly!)
    this.shiftRodsGroup.name = 'shift-linked-rods';
    tier.add(this.shiftRodsGroup);

    const farLeftLen = vSize(0.735 - 0.456);
    const farLeftGeo = this.trackGeo(createRoundedStripGeometry(0.125, 0.11, farLeftLen));
    const farLeftRod = this.makeMesh(farLeftGeo, this.materials.machinedPrimary, {
      partCategory: 'shiftLeft',
      actionType: 'shift',
      label: 'Far-Left Shift Guide Rod',
    });
    farLeftRod.position.set(toX(0.062), 0.02, toZ((0.456 + 0.735) * 0.5));
    this.shiftRodsGroup.add(farLeftRod);

    const leftCtrlLen = vSize(0.722 - 0.355);
    const leftCtrlGeo = this.trackGeo(createRoundedStripGeometry(0.108, 0.095, leftCtrlLen));
    const leftCtrlRod = this.makeMesh(leftCtrlGeo, this.materials.machinedPrimary, {
      partCategory: 'shiftLeft',
      actionType: 'shift',
      label: 'Left Actuator Control Rod',
    });
    leftCtrlRod.position.set(toX(0.171), 0.01, toZ((0.355 + 0.722) * 0.5));
    this.shiftRodsGroup.add(leftCtrlRod);

    // Machined circular bearing eyelet ring with bronze sleeve at bottom of left control rod
    const eyeletOuterGeo = this.trackGeo(new THREE.TorusGeometry(0.095, 0.038, 12, 24));
    eyeletOuterGeo.rotateX(Math.PI / 2);
    const eyeletRing = this.makeMesh(eyeletOuterGeo, this.materials.mirrorChrome, {
      partCategory: 'shiftLeft',
      actionType: 'shift',
    });
    eyeletRing.position.set(toX(0.171), 0.02, toZ(0.722));
    this.shiftRodsGroup.add(eyeletRing);

    const eyeletBronzeGeo = this.trackGeo(new THREE.CylinderGeometry(0.064, 0.064, 0.092, 18));
    const eyeletBronze = this.makeMesh(eyeletBronzeGeo, this.materials.bearingBronze, {
      partCategory: 'shiftLeft',
      actionType: 'shift',
    }, false);
    eyeletBronze.position.set(toX(0.171), 0.02, toZ(0.722));
    this.shiftRodsGroup.add(eyeletBronze);

    const eyeletCoreGeo = this.trackGeo(new THREE.CylinderGeometry(0.042, 0.042, 0.105, 16));
    const eyeletCore = this.makeMesh(eyeletCoreGeo, this.materials.recessedDark, {
      partCategory: 'shiftLeft',
      actionType: 'shift',
    }, false);
    eyeletCore.position.set(toX(0.171), 0.02, toZ(0.722));
    this.shiftRodsGroup.add(eyeletCore);

    // Linked Right Carriage Pull-Rod Group (moves physically with Stadium Return Handle!)
    this.returnRodGroup.name = 'return-linked-rod';
    tier.add(this.returnRodGroup);

    const rightCtrlLen = vSize(0.720 - 0.355);
    const rightCtrlGeo = this.trackGeo(createRoundedStripGeometry(0.11, 0.095, rightCtrlLen));
    const rightCtrlRod = this.makeMesh(rightCtrlGeo, this.materials.machinedPrimary, {
      partCategory: 'stadium',
      actionType: 'return',
      label: 'Right Return Pull-Rod',
    });
    rightCtrlRod.position.set(toX(0.828), 0.01, toZ((0.355 + 0.720) * 0.5));
    this.returnRodGroup.add(rightCtrlRod);

    // Machined clevis yoke coupling the right return pull-rod directly into the T-saddle bridge
    const rodCouplerGeo = this.trackGeo(createBeveledBlockGeometry(0.16, 0.12, 0.16, 0.03, 0.014));
    const rodCoupler = this.makeMesh(rodCouplerGeo, this.materials.housingMatte, {
      partCategory: 'stadium',
      actionType: 'return',
    });
    rodCoupler.position.set(toX(0.828), 0.02, toZ(0.695));
    this.returnRodGroup.add(rodCoupler);

    const rodCouplerPinGeo = this.trackGeo(new THREE.CylinderGeometry(0.032, 0.032, 0.21, 14));
    rodCouplerPinGeo.rotateZ(Math.PI / 2);
    const rodCouplerPin = this.makeMesh(rodCouplerPinGeo, this.materials.mirrorChrome, {
      partCategory: 'stadium',
      actionType: 'return',
    }, false);
    rodCouplerPin.position.set(toX(0.828), 0.02, toZ(0.695));
    this.returnRodGroup.add(rodCouplerPin);

    // Twin spring upper pull-rods with top clevis anchor blocks
    const pullRodLen = vSize(0.680 - 0.355);
    const pullRodGeo = this.trackGeo(createRoundedStripGeometry(0.095, 0.09, pullRodLen));
    const anchorBlockGeo = this.trackGeo(createBeveledBlockGeometry(0.155, 0.11, 0.12, 0.03, 0.014));
    for (const sp of COIL_SPRINGS) {
      const rod = this.makeMesh(pullRodGeo, this.materials.machinedPrimary, {
        partCategory: 'spring',
        actionType: 'space',
      });
      rod.position.set(toX(sp.u), 0.01, toZ((0.355 + 0.680) * 0.5));
      tier.add(rod);

      const anchorBlock = this.makeMesh(anchorBlockGeo, this.materials.housingMatte, {
        partCategory: 'spring',
        actionType: 'space',
      });
      anchorBlock.position.set(toX(sp.u), 0.02, toZ(sp.vTop) - 0.045);
      tier.add(anchorBlock);
    }
  }

  /**
   * Tier 3B: Twin 12-turn helical coil springs coupled via machined ferrules & clevis pins
   * to the rotating torsion bell-cranks + upper tie-bar + bronze-lined guide blocks + bail bar.
   */
  private buildSpringsAndSpaceCarriage(): void {
    const tier = this.tierGroups.linkageRods;

    const wireTailGeo = this.trackGeo(new THREE.CylinderGeometry(0.024, 0.024, vSize(0.068), 12));
    wireTailGeo.rotateX(Math.PI / 2);
    const springAnchorCollarGeo = this.trackGeo(new THREE.CylinderGeometry(0.062, 0.062, 0.068, 18));
    springAnchorCollarGeo.rotateX(Math.PI / 2);
    const crossPinGeo = this.trackGeo(new THREE.CylinderGeometry(0.022, 0.022, 0.16, 12));
    crossPinGeo.rotateZ(Math.PI / 2);

    for (const sp of COIL_SPRINGS) {
      const lengthZ = vSize(sp.vBottom - sp.vTop);
      const springGeo = this.trackGeo(
        createHelicalSpringGeometry(lengthZ, sp.coilRadius, sp.wireRadius, sp.turns),
      );
      const springMesh = this.makeMesh(springGeo, this.materials.springWire, {
        partCategory: 'spring',
        actionType: 'space',
        label: sp.side === 'left' ? 'Left Helical Tension Spring' : 'Right Helical Tension Spring',
      });
      springMesh.position.set(toX(sp.u), 0.02, toZ(sp.vTop));
      tier.add(springMesh);
      this.springMeshes.push(springMesh);
      this.springLengths.push(lengthZ);

      // Machined top chrome collar + cross-pin locking spring eyelet to upper anchor block
      const topCollar = this.makeMesh(springAnchorCollarGeo, this.materials.mirrorChrome, {
        partCategory: 'spring',
        actionType: 'space',
      }, false);
      topCollar.position.set(toX(sp.u), 0.02, toZ(sp.vTop));
      tier.add(topCollar);

      const topCrossPin = this.makeMesh(crossPinGeo, this.materials.mirrorChrome, {
        partCategory: 'spring',
        actionType: 'space',
      }, false);
      topCrossPin.position.set(toX(sp.u), 0.02, toZ(sp.vTop) - 0.02);
      tier.add(topCrossPin);

      // Lower extension wire tail bridging bottom hook cleanly into bell-crank clevis pin
      const tailZ = toZ((sp.vBottom + sp.torsionV) * 0.5 + 0.004);
      const tail = this.makeMesh(wireTailGeo, this.materials.mirrorChrome, {
        partCategory: 'spring',
        actionType: 'space',
      });
      tail.position.set(toX(sp.u), -0.02, tailZ);
      tier.add(tail);
      this.springTails.push(tail);
      this.springTailBaseZ.push(tailZ);
    }

    // Spacebar horizontal tie-bars & bail bar inside moving spaceCarriageGroup
    this.spaceCarriageGroup.name = 'space-carriage';
    tier.add(this.spaceCarriageGroup);

    const upperLen = uSize(LOWER_CARRIAGE.upperBarUMax - LOWER_CARRIAGE.upperBarUMin);
    const upperGeo = this.trackGeo(
      new THREE.CapsuleGeometry(0.052, Math.max(0.1, upperLen - 0.1), 10, 20),
    );
    upperGeo.rotateZ(Math.PI / 2);
    const upperBar = this.makeMesh(upperGeo, this.materials.polishedPin, {
      partCategory: 'carriage',
      actionType: 'space',
      label: 'Upper Horizontal Tie-Bar',
    });
    upperBar.position.set(
      toX((LOWER_CARRIAGE.upperBarUMin + LOWER_CARRIAGE.upperBarUMax) * 0.5),
      0.06,
      toZ(LOWER_CARRIAGE.upperBarV),
    );
    this.spaceCarriageGroup.add(upperBar);

    // Lower main horizontal bail bar with laser-straight span and flush dogleg ends into torsion shafts
    const xL = toX(LOWER_CARRIAGE.lowerBailUMin);
    const xR = toX(LOWER_CARRIAGE.lowerBailUMax);
    const zBail = toZ(LOWER_CARRIAGE.lowerBailV);
    const zJog = toZ(0.802);
    const bailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(xL - 0.14, -0.1, zJog),
      new THREE.Vector3(xL + 0.04, -0.01, zJog),
      new THREE.Vector3(xL + 0.15, 0.03, zBail),
      new THREE.Vector3(xL + 0.42, 0.03, zBail),
      new THREE.Vector3(0, 0.03, zBail),
      new THREE.Vector3(xR - 0.42, 0.03, zBail),
      new THREE.Vector3(xR - 0.15, 0.03, zBail),
      new THREE.Vector3(xR - 0.04, -0.01, zJog),
      new THREE.Vector3(xR + 0.14, -0.1, zJog),
    ]);
    const bailGeo = this.trackGeo(new THREE.TubeGeometry(bailCurve, 72, 0.052, 16, false));
    const bailBar = this.makeMesh(bailGeo, this.materials.polishedPin, {
      partCategory: 'carriage',
      actionType: 'space',
      label: 'Lower Spacebar Bail Bar',
    });
    this.spaceCarriageGroup.add(bailBar);

    // Bronze-lined retaining linear guide blocks with M2 cap screws where bail crosses comb rails
    const guideCollarGeo = this.trackGeo(createBeveledBlockGeometry(0.22, 0.14, 0.16, 0.04, 0.015));
    const guideBronzeGeo = this.trackGeo(new THREE.CylinderGeometry(0.066, 0.066, 0.24, 16));
    guideBronzeGeo.rotateZ(Math.PI / 2);
    const guideBoltGeo = this.trackGeo(new THREE.CylinderGeometry(0.024, 0.024, 0.03, 12));

    for (const uRail of [0.425, 0.604]) {
      const rx = toX(uRail);
      const sleeve = this.makeMesh(guideCollarGeo, this.materials.housingMatte, {
        partCategory: 'carriage',
        actionType: 'space',
        label: 'Bronze-Lined Bail Guide Block',
      });
      sleeve.position.set(rx, 0.03, zBail);
      this.spaceCarriageGroup.add(sleeve);

      const bronzeLiner = this.makeMesh(guideBronzeGeo, this.materials.bearingBronze, {
        partCategory: 'carriage',
        actionType: 'space',
      }, false);
      bronzeLiner.position.set(rx, 0.03, zBail);
      this.spaceCarriageGroup.add(bronzeLiner);

      const screw = this.makeMesh(guideBoltGeo, this.materials.mirrorChrome, {
        partCategory: 'carriage',
        actionType: 'space',
      }, false);
      screw.position.set(rx, 0.105, zBail);
      this.spaceCarriageGroup.add(screw);
    }
  }

  /**
   * Tier 4 & Tier 5: All 26 Split C-Arc Gimbal Guards with cantilevered support bridges &
   * Oilite bronze guide bushings + 26 CNC-Turned Plunger Discs with vertical mirror-chrome
   * push-rods, compressing 5-turn micro-return springs, clevis tappet forks, & slotted hub screws.
   */
  private buildGimbalArcsAndPlungers(): void {
    const arcTier = this.tierGroups.gimbalArcs;
    const plungerTier = this.tierGroups.plungerDiscs;

    const discGeo = this.trackGeo(
      createPlungerDiscGeometry(0.212, 0.092, this.highDetail ? 28 : 18),
    );
    const endCapGeo = this.trackGeo(new THREE.SphereGeometry(0.034, this.highDetail ? 10 : 7, 6));
    endCapGeo.scale(1, 1.45, 1);

    // Real physical under-plunger mechanical drive train geometries (shared across all 26 keys!)
    const pushRodGeo = this.trackGeo(
      new THREE.CylinderGeometry(0.038, 0.038, 0.34, this.highDetail ? 12 : 8),
    );
    const microSpringGeo = this.trackGeo(
      createMicroReturnSpringGeometry(0.185, 0.068, 0.011, 4.5, this.highDetail),
    );
    const tappetForkGeo = this.trackGeo(
      createClevisForkGeometry(0.185, 0.145, 0.115, 0.105, this.highDetail),
    );
    const tappetPinGeo = this.trackGeo(
      new THREE.CylinderGeometry(0.02, 0.02, 0.21, this.highDetail ? 10 : 7),
    );
    tappetPinGeo.rotateZ(Math.PI / 2);

    // Flanged Oilite bronze guide bushing & gimbal bridge struts anchoring every C-arc physically
    const guideBushingGeo = this.trackGeo(
      new THREE.CylinderGeometry(0.096, 0.112, 0.062, this.highDetail ? 16 : 10),
    );
    const guideFlangeGeo = this.trackGeo(
      new THREE.CylinderGeometry(0.128, 0.128, 0.024, this.highDetail ? 16 : 10),
    );
    const arcBridgeGeo = this.trackGeo(createRoundedStripGeometry(0.044, 0.038, 0.22));
    const slottedHeadGeo = this.trackGeo(
      new THREE.CylinderGeometry(0.044, 0.046, 0.086, this.highDetail ? 14 : 10),
    );
    const screwSlotGeo = this.trackGeo(new THREE.BoxGeometry(0.064, 0.016, 0.013));

    const arcGeoCache = new Map<string, THREE.BufferGeometry>();
    const getArcGeo = (radius: number, halfAngle: number, isNorth: boolean) => {
      const key = `${radius.toFixed(3)}-${halfAngle.toFixed(2)}-${isNorth ? 'N' : 'S'}`;
      let g = arcGeoCache.get(key);
      if (!g) {
        g = this.trackGeo(
          createSplitCArcGeometry(radius, halfAngle, 0.034, isNorth, this.highDetail),
        );
        arcGeoCache.set(key, g);
      }
      return g;
    };

    const strutPositions: Array<[number, number, number]> = [];
    const guideBushingPositions: Array<[number, number, number]> = [];
    const guideFlangePositions: Array<[number, number, number]> = [];
    const endCapPositions: Array<[number, number, number]> = [];

    for (const act of KEY_ACTUATORS) {
      const cx = toX(act.u);
      const cz = toZ(act.v);
      const meta: InteractiveUserData = {
        partCategory: 'actuator',
        actionType: 'key',
        keyIndex: act.index,
        label: `Key Actuator [${act.keyLabel}] (Row ${act.row + 1})`,
      };

      // --- Tier 4: Split North & South C-Arc Gimbal Guard + Anchored Bronze Guide Hub ---
      const arcGroup = new THREE.Group();
      arcGroup.position.set(cx, 0, cz);

      const northArc = this.makeMesh(
        getArcGeo(act.arcRadius, act.arcHalfAngle, true),
        this.materials.machinedPrimary,
        meta,
      );
      const southArc = this.makeMesh(
        getArcGeo(act.arcRadius, act.arcHalfAngle, false),
        this.materials.machinedPrimary,
        meta,
      );
      arcGroup.add(northArc, southArc);

      // Collect static bridge struts, bronze bushings, flanges & end-caps for single-draw InstancedMesh batching
      const bridgeOffset = act.arcRadius * 0.56;
      strutPositions.push([cx, -0.065, cz - bridgeOffset], [cx, -0.065, cz + bridgeOffset]);
      guideBushingPositions.push([cx, -0.068, cz]);
      guideFlangePositions.push([cx, -0.088, cz]);

      const capAngles = [
        -Math.PI / 2 - act.arcHalfAngle,
        -Math.PI / 2 + act.arcHalfAngle,
        Math.PI / 2 - act.arcHalfAngle,
        Math.PI / 2 + act.arcHalfAngle,
      ];
      for (const a of capAngles) {
        endCapPositions.push([cx + Math.cos(a) * act.arcRadius, 0, cz + Math.sin(a) * act.arcRadius]);
      }

      // Row 3 #3 rotating eccentric roller cam disc tucked bottom-left (u=0.388, v=0.605)
      if (act.hasEccentricRoller) {
        const rollerGroup = new THREE.Group();
        rollerGroup.position.set(-0.2, -0.1, 0.08);

        const rollerGeo = this.trackGeo(createPlungerDiscGeometry(0.2, 0.082));
        const roller = this.makeMesh(rollerGeo, this.materials.housingMatte, {
          ...meta,
          label: 'Eccentric Cam Roller Disc',
        });
        rollerGroup.add(roller);

        const rollerRimGeo = this.trackGeo(new THREE.TorusGeometry(0.195, 0.022, 8, 22));
        rollerRimGeo.rotateX(Math.PI / 2);
        const rollerRim = this.makeMesh(rollerRimGeo, this.materials.mirrorChrome, meta, false, false);
        rollerRim.position.y = 0.04;
        rollerGroup.add(rollerRim);

        const eccPinGeo = this.trackGeo(new THREE.CylinderGeometry(0.035, 0.035, 0.11, 12));
        const eccPin = this.makeMesh(eccPinGeo, this.materials.bearingBronze, meta, false, false);
        eccPin.position.set(0.065, 0.02, 0.0);
        rollerGroup.add(eccPin);

        arcGroup.add(rollerGroup);
        this.eccentricRollerGroup = rollerGroup;
      }

      arcTier.add(arcGroup);

      // --- Tier 5: Animated Plunger Disc + Finger Stem (sub-hardware batched in 6 animated InstancedMeshes) ---
      const pGroup = new THREE.Group();
      pGroup.position.set(cx, 0, cz);

      const disc = this.makeMesh(discGeo, this.materials.plungerTurned, meta);
      pGroup.add(disc);

      // Descending top actuation finger stem
      const stemLen = vSize(Math.min(act.stemEndV - act.v, 0.145));
      const stemGeo = this.trackGeo(createRoundedStripGeometry(0.086, 0.072, stemLen));
      const stem = this.makeMesh(stemGeo, this.materials.machinedPrimary, meta);
      stem.position.set(0, 0.036, stemLen * 0.5 - 0.02);
      pGroup.add(stem);

      // Lower extension linkage bar for multi-row coupled actuators
      const fullStemLen = vSize(act.stemEndV - act.v);
      if (fullStemLen > stemLen + 0.05) {
        const extLen = fullStemLen - stemLen + 0.14;
        const extGeo = this.trackGeo(createRoundedStripGeometry(0.092, 0.068, extLen));
        const extBar = this.makeMesh(extGeo, this.materials.machinedPrimary, meta, true, false);
        extBar.position.set(0, -0.06, stemLen + extLen * 0.5 - 0.08);
        pGroup.add(extBar);
      }

      plungerTier.add(pGroup);
      this.plungerGroups.push(pGroup);
      this.plungerBaseY.push(0);
      this.plungerCoords.push({ x: cx, z: cz, slotAngle: (act.index * 0.73) % Math.PI });
    }

    // Batch 208 static gimbal support struts, bronze guide collars, flanges & C-arc end-caps into 4 draw calls!
    this.addInstanced(arcTier, arcBridgeGeo, this.materials.housingMatte, strutPositions);
    this.addInstanced(arcTier, guideBushingGeo, this.materials.bearingBronze, guideBushingPositions);
    this.addInstanced(arcTier, guideFlangeGeo, this.materials.housingMatte, guideFlangePositions);
    this.addInstanced(arcTier, endCapGeo, this.materials.mirrorChrome, endCapPositions);

    // Batch all 156 animated plunger sub-hardware pieces (slotted cap screws, push-rods, compressing
    // 5-turn micro-springs, clevis tappet forks, bronze roller pins) into 6 real-time InstancedMeshes!
    const keyCount = this.plungerCoords.length;
    const makeDynamicInstanced = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
      const inst = new THREE.InstancedMesh(geo, mat, keyCount);
      inst.castShadow = false;
      inst.receiveShadow = true;
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      plungerTier.add(inst);
      return inst;
    };

    this.instScrewHeads = makeDynamicInstanced(slottedHeadGeo, this.materials.mirrorChrome);
    this.instScrewSlots = makeDynamicInstanced(screwSlotGeo, this.materials.recessedDark);
    this.instPushRods = makeDynamicInstanced(pushRodGeo, this.materials.mirrorChrome);
    this.instMicroSprings = makeDynamicInstanced(microSpringGeo, this.materials.springWire);
    this.instTappetForks = makeDynamicInstanced(tappetForkGeo, this.materials.housingMatte);
    this.instTappetPins = makeDynamicInstanced(tappetPinGeo, this.materials.bearingBronze);
    this.syncPlungerHardwareInstances(null);
  }

  private syncPlungerHardwareInstances(keyPress: ArrayLike<number> | null): void {
    const d = this.instDummy;
    const n = this.plungerCoords.length;
    let anyUpdated = false;

    for (let i = 0; i < n; i++) {
      const stroke = keyPress ? keyPress[i] : 0;
      if (keyPress && Math.abs(stroke - this.prevPlungerPress[i]) < 0.00025) {
        continue;
      }
      this.prevPlungerPress[i] = stroke;
      anyUpdated = true;

      const c = this.plungerCoords[i];
      const py = this.plungerBaseY[i] - stroke * 0.145;

      // 1. Slotted center screw head
      d.position.set(c.x, py + 0.038, c.z);
      d.rotation.set(0, 0, 0);
      d.scale.set(1, 1, 1);
      d.updateMatrix();
      this.instScrewHeads?.setMatrixAt(i, d.matrix);

      // 2. Watchmaker screw slot groove
      d.position.set(c.x, py + 0.078, c.z);
      d.rotation.set(0, c.slotAngle, 0);
      d.updateMatrix();
      this.instScrewSlots?.setMatrixAt(i, d.matrix);

      // 3. Vertical mirror-chrome push-rod shaft
      d.position.set(c.x, py - 0.22, c.z);
      d.rotation.set(0, 0, 0);
      d.updateMatrix();
      this.instPushRods?.setMatrixAt(i, d.matrix);

      // 4. Compressing 4.5-turn helical micro-return spring
      d.position.set(c.x, py - 0.055, c.z);
      d.scale.set(1, 1 - stroke * 0.42, 1);
      d.updateMatrix();
      this.instMicroSprings?.setMatrixAt(i, d.matrix);

      // 5. Machined U-shaped clevis tappet fork straddling comb lever
      d.position.set(c.x, py - 0.39, c.z);
      d.scale.set(1, 1, 1);
      d.updateMatrix();
      this.instTappetForks?.setMatrixAt(i, d.matrix);

      // 6. Oilite bronze tappet cross-pin
      d.position.set(c.x, py - 0.42, c.z);
      d.updateMatrix();
      this.instTappetPins?.setMatrixAt(i, d.matrix);
    }

    if (!anyUpdated) return;
    if (this.instScrewHeads) this.instScrewHeads.instanceMatrix.needsUpdate = true;
    if (this.instScrewSlots) this.instScrewSlots.instanceMatrix.needsUpdate = true;
    if (this.instPushRods) this.instPushRods.instanceMatrix.needsUpdate = true;
    if (this.instMicroSprings) this.instMicroSprings.instanceMatrix.needsUpdate = true;
    if (this.instTappetForks) this.instTappetForks.instanceMatrix.needsUpdate = true;
    if (this.instTappetPins) this.instTappetPins.instanceMatrix.needsUpdate = true;
  }

  /**
   * Tier 5B: Left-side Shift Lock U-channel housings, chrome hex bolts, bronze-bushed lug, & I-beam foot.
   */
  private buildLeftShiftAssembly(): void {
    const tier = this.tierGroups.plungerDiscs;
    this.shiftLeftGroup.name = 'left-shift-assembly';
    tier.add(this.shiftLeftGroup);

    const meta: InteractiveUserData = {
      partCategory: 'shiftLeft',
      actionType: 'shift',
      label: 'Left Shift Lock Housing & I-Beam Foot',
    };

    const xBlock = toX(0.094);
    const socketHeadGeo = this.trackGeo(new THREE.CylinderGeometry(0.065, 0.072, 0.062, 20));
    const socketHexGeo = this.trackGeo(new THREE.CylinderGeometry(0.032, 0.032, 0.07, 6));
    const washerGeo = this.trackGeo(new THREE.CylinderGeometry(0.084, 0.084, 0.016, 20));

    const upperBodyGeo = this.trackGeo(createBeveledBlockGeometry(0.45, 0.24, 0.58, 0.04, 0.025));
    const upperBody = this.makeMesh(upperBodyGeo, this.materials.housingMatte, meta);
    upperBody.position.set(xBlock, -0.06, toZ(0.585));
    this.shiftLeftGroup.add(upperBody);

    const lipFlangeGeo = this.trackGeo(createBeveledBlockGeometry(0.5, 0.095, 0.125, 0.03, 0.018));
    const upperLip = this.makeMesh(lipFlangeGeo, this.materials.machinedPrimary, meta);
    upperLip.position.set(xBlock, 0.04, toZ(0.554));
    this.shiftLeftGroup.add(upperLip);

    const upperWasher = this.makeMesh(washerGeo, this.materials.bearingBronze, meta, false);
    upperWasher.position.set(xBlock, 0.056, toZ(0.592));
    this.shiftLeftGroup.add(upperWasher);
    const upperBolt = this.makeMesh(socketHeadGeo, this.materials.mirrorChrome, meta);
    upperBolt.position.set(xBlock, 0.07, toZ(0.592));
    this.shiftLeftGroup.add(upperBolt);
    const upperHex = this.makeMesh(socketHexGeo, this.materials.recessedDark, meta, false);
    upperHex.position.set(xBlock, 0.074, toZ(0.592));
    this.shiftLeftGroup.add(upperHex);

    const sideLugGeo = this.trackGeo(new THREE.CylinderGeometry(0.09, 0.09, 0.18, 20));
    sideLugGeo.rotateZ(Math.PI / 2);
    const sideLug = this.makeMesh(sideLugGeo, this.materials.mirrorChrome, meta);
    sideLug.position.set(toX(0.123), -0.07, toZ(0.594));
    this.shiftLeftGroup.add(sideLug);

    const midStemGeo = this.trackGeo(createRoundedStripGeometry(0.135, 0.1, vSize(0.088)));
    const midStem = this.makeMesh(midStemGeo, this.materials.machinedPrimary, meta);
    midStem.position.set(xBlock, -0.08, toZ(0.648));
    this.shiftLeftGroup.add(midStem);

    const crossFlangeGeo = this.trackGeo(createBeveledBlockGeometry(0.49, 0.09, 0.095, 0.025, 0.014));
    const crossFlange = this.makeMesh(crossFlangeGeo, this.materials.polishedPin, meta);
    crossFlange.position.set(xBlock, -0.04, toZ(0.644));
    this.shiftLeftGroup.add(crossFlange);

    const lowerLip = this.makeMesh(lipFlangeGeo, this.materials.machinedPrimary, meta);
    lowerLip.position.set(toX(0.091), 0.02, toZ(0.686));
    this.shiftLeftGroup.add(lowerLip);

    const lowerBodyGeo = this.trackGeo(createBeveledBlockGeometry(0.43, 0.22, 0.54, 0.04, 0.024));
    const lowerBody = this.makeMesh(lowerBodyGeo, this.materials.housingMatte, meta);
    lowerBody.position.set(toX(0.091), -0.06, toZ(0.718));
    this.shiftLeftGroup.add(lowerBody);

    const lowerWasher = this.makeMesh(washerGeo, this.materials.bearingBronze, meta, false);
    lowerWasher.position.set(toX(0.091), 0.048, toZ(0.725));
    this.shiftLeftGroup.add(lowerWasher);
    const lowerBolt = this.makeMesh(socketHeadGeo, this.materials.mirrorChrome, meta);
    lowerBolt.position.set(toX(0.091), 0.06, toZ(0.725));
    this.shiftLeftGroup.add(lowerBolt);
    const lowerHex = this.makeMesh(socketHexGeo, this.materials.recessedDark, meta, false);
    lowerHex.position.set(toX(0.091), 0.064, toZ(0.725));
    this.shiftLeftGroup.add(lowerHex);

    const neckGeo = this.trackGeo(createBeveledBlockGeometry(0.24, 0.16, 0.3, 0.04, 0.018));
    const neck = this.makeMesh(neckGeo, this.materials.machinedPrimary, meta);
    neck.position.set(toX(0.091), -0.08, toZ(0.756));
    this.shiftLeftGroup.add(neck);

    const footPadGeo = this.trackGeo(createBeveledBlockGeometry(0.48, 0.11, 0.11, 0.03, 0.018));
    const footPad = this.makeMesh(footPadGeo, this.materials.polishedPin, meta);
    footPad.position.set(toX(0.091), -0.06, toZ(0.774));
    this.shiftLeftGroup.add(footPad);

    // I-Beam / T-Bar Shift Foot with concentric lathe-turned spherical boss
    const xI = toX(0.214);
    const iBarGeo = this.trackGeo(createBeveledBlockGeometry(0.47, 0.1, 0.095, 0.035, 0.016));
    const iTopBar = this.makeMesh(iBarGeo, this.materials.polishedPin, meta);
    iTopBar.position.set(xI, -0.06, toZ(0.683));
    this.shiftLeftGroup.add(iTopBar);

    const iBotBar = this.makeMesh(iBarGeo, this.materials.polishedPin, meta);
    iBotBar.position.set(xI, -0.06, toZ(0.774));
    this.shiftLeftGroup.add(iBotBar);

    const iStemGeo = this.trackGeo(createRoundedStripGeometry(0.135, 0.11, vSize(0.092)));
    const iStem = this.makeMesh(iStemGeo, this.materials.machinedPrimary, meta);
    iStem.position.set(xI, -0.07, toZ(0.728));
    this.shiftLeftGroup.add(iStem);

    const bossGeo = this.trackGeo(new THREE.SphereGeometry(0.112, 24, 18));
    bossGeo.scale(1.0, 0.85, 1.0);
    const boss = this.makeMesh(bossGeo, this.materials.plungerTurned, meta);
    boss.position.set(xI, -0.03, toZ(0.728));
    this.shiftLeftGroup.add(boss);
  }

  /**
   * Tier 4B: Upper-right shift housing block + Large Sculpted Stadium Return Loop & Bolted T-Clamp.
   */
  private buildRightStadiumReturnAssembly(): void {
    const tier = this.tierGroups.gimbalArcs;
    this.returnAssemblyGroup.name = 'right-stadium-return';
    tier.add(this.returnAssemblyGroup);

    const meta: InteractiveUserData = {
      partCategory: 'stadium',
      actionType: 'return',
      label: 'Stadium Return Handle & Upper Housing',
    };

    const xRightBlock = toX(0.905);
    const upperBodyGeo = this.trackGeo(createBeveledBlockGeometry(0.45, 0.24, 0.58, 0.04, 0.025));
    const upperBody = this.makeMesh(upperBodyGeo, this.materials.housingMatte, meta);
    upperBody.position.set(xRightBlock, 0.06, toZ(0.585));
    this.returnAssemblyGroup.add(upperBody);

    const lipFlangeGeo = this.trackGeo(createBeveledBlockGeometry(0.5, 0.095, 0.125, 0.03, 0.018));
    const upperLip = this.makeMesh(lipFlangeGeo, this.materials.machinedPrimary, meta);
    upperLip.position.set(xRightBlock, 0.16, toZ(0.554));
    this.returnAssemblyGroup.add(upperLip);

    const socketHeadGeo = this.trackGeo(new THREE.CylinderGeometry(0.065, 0.072, 0.062, 20));
    const socketHexGeo = this.trackGeo(new THREE.CylinderGeometry(0.032, 0.032, 0.07, 6));
    const washerGeo = this.trackGeo(new THREE.CylinderGeometry(0.084, 0.084, 0.016, 20));

    const rWasher = this.makeMesh(washerGeo, this.materials.bearingBronze, meta, false);
    rWasher.position.set(xRightBlock, 0.176, toZ(0.592));
    this.returnAssemblyGroup.add(rWasher);
    const rBolt = this.makeMesh(socketHeadGeo, this.materials.mirrorChrome, meta);
    rBolt.position.set(xRightBlock, 0.19, toZ(0.592));
    this.returnAssemblyGroup.add(rBolt);
    const rHex = this.makeMesh(socketHexGeo, this.materials.recessedDark, meta, false);
    rHex.position.set(xRightBlock, 0.194, toZ(0.592));
    this.returnAssemblyGroup.add(rHex);

    const sideLugGeo = this.trackGeo(new THREE.CylinderGeometry(0.09, 0.09, 0.18, 20));
    sideLugGeo.rotateZ(Math.PI / 2);
    const sideLug = this.makeMesh(sideLugGeo, this.materials.mirrorChrome, meta);
    sideLug.position.set(toX(0.876), 0.05, toZ(0.594));
    this.returnAssemblyGroup.add(sideLug);

    const rightDropGeo = this.trackGeo(createRoundedStripGeometry(0.12, 0.1, vSize(0.115)));
    const rightDrop = this.makeMesh(rightDropGeo, this.materials.machinedPrimary, meta);
    rightDrop.position.set(xRightBlock, 0.03, toZ(0.668));
    this.returnAssemblyGroup.add(rightDrop);

    const crossFlangeGeo = this.trackGeo(createBeveledBlockGeometry(0.49, 0.09, 0.095, 0.025, 0.014));
    const crossFlange = this.makeMesh(crossFlangeGeo, this.materials.polishedPin, meta);
    crossFlange.position.set(xRightBlock, 0.08, toZ(0.644));
    this.returnAssemblyGroup.add(crossFlange);

    const loopW = uSize(STADIUM_HANDLE.uMax - STADIUM_HANDLE.uMin);
    const loopH = vSize(STADIUM_HANDLE.vMax - STADIUM_HANDLE.vMin);
    const loopCX = toX((STADIUM_HANDLE.uMin + STADIUM_HANDLE.uMax) * 0.5);
    const loopCZ = toZ((STADIUM_HANDLE.vMin + STADIUM_HANDLE.vMax) * 0.5);

    const loopGeo = this.trackGeo(
      createStadiumLoopGeometry(loopW, loopH, STADIUM_HANDLE.tubeRadius),
    );
    const loopMesh = this.makeMesh(loopGeo, this.materials.machinedPrimary, meta);
    loopMesh.position.set(loopCX, 0.02, loopCZ);
    this.returnAssemblyGroup.add(loopMesh);

    const clampW = uSize(STADIUM_HANDLE.clampUMax - STADIUM_HANDLE.clampUMin);
    const clampLen = vSize(STADIUM_HANDLE.clampVBottom - STADIUM_HANDLE.clampVTop);
    const clampCX = toX((STADIUM_HANDLE.clampUMin + STADIUM_HANDLE.clampUMax) * 0.5);
    const clampCZ = toZ((STADIUM_HANDLE.clampVTop + STADIUM_HANDLE.clampVBottom) * 0.5);

    const tClampGeo = this.trackGeo(createTClampGeometry(clampW, clampW * 0.34, clampLen, 0.165));
    const tClamp = this.makeMesh(tClampGeo, this.materials.housingMatte, meta);
    tClamp.position.set(clampCX, 0.01, clampCZ);
    this.returnAssemblyGroup.add(tClamp);

    // Side framing rails + twin mirror-chrome M2.5 hex clamp screws securing the T-saddle bridge
    const frameRailGeo = this.trackGeo(createRoundedStripGeometry(0.11, 0.12, vSize(0.068)));
    const clampBoltGeo = this.trackGeo(new THREE.CylinderGeometry(0.032, 0.032, 0.035, 14));
    const clampHexGeo = this.trackGeo(new THREE.CylinderGeometry(0.016, 0.016, 0.04, 6));
    for (const uRail of [0.828, 0.903]) {
      const rx = toX(uRail);
      const rail = this.makeMesh(frameRailGeo, this.materials.polishedPin, meta);
      rail.position.set(rx, 0.04, toZ(0.712));
      this.returnAssemblyGroup.add(rail);

      const bolt = this.makeMesh(clampBoltGeo, this.materials.mirrorChrome, meta, false);
      bolt.position.set(rx, 0.105, toZ(0.712));
      this.returnAssemblyGroup.add(bolt);

      const hex = this.makeMesh(clampHexGeo, this.materials.recessedDark, meta, false);
      hex.position.set(rx, 0.108, toZ(0.712));
      this.returnAssemblyGroup.add(hex);
    }
  }

  /**
   * Zero-allocation per-frame coupled mechanical kinematic update:
   * - Depresses plungers, compresses individual micro-return springs, drives tappet forks
   * - Pivots all 17 comb keybars cleanly around the continuous rear fulcrum datum axle
   * - Stretches twin 12-turn helical springs, tracks ferrules, rocks bell-crank levers & twists torsion coils
   * - Slides linked Shift & Return pull-rods synchronously with their housings
   * - Rotates eccentric roller cam disc smoothly
   */
  public update(state: MechanismKinematicState): void {
    const e = state.explodeProgress;
    this.tierGroups.baseBrackets.position.y = getTierElevation('baseBrackets', e);
    this.tierGroups.combBars.position.y = getTierElevation('combBars', e);
    this.tierGroups.linkageRods.position.y = getTierElevation('linkageRods', e);
    this.tierGroups.gimbalArcs.position.y = getTierElevation('gimbalArcs', e);
    this.tierGroups.plungerDiscs.position.y = getTierElevation('plungerDiscs', e);

    // 1. Actuate all 26 circular key plungers & sync their 6 instanced mechanical drive-train layers
    for (let i = 0; i < this.plungerGroups.length; i++) {
      this.plungerGroups[i].position.y = this.plungerBaseY[i] - state.keyPress[i] * 0.145;
    }
    this.syncPlungerHardwareInstances(state.keyPress);

    // 2. Pivot all 17 comb keybars cleanly around their shared rear fulcrum axle
    for (let i = 0; i < this.combPivots.length; i++) {
      this.combPivots[i].rotation.x = -state.combAngles[i];
    }

    // 3. Stretch twin helical tension springs, rock bell-crank arms, twist torsion coils & slide bail carriage
    for (let i = 0; i < this.springMeshes.length; i++) {
      this.springMeshes[i].scale.z = state.springScale;
      if (i < this.springTails.length) {
        this.springTails[i].position.z =
          this.springTailBaseZ[i] + (state.springScale - 1) * this.springLengths[i] * 0.55;
      }
    }
    for (let i = 0; i < this.torsionMeshes.length; i++) {
      this.torsionMeshes[i].rotation.x = state.torsionTwist;
    }
    for (let i = 0; i < this.bellCrankPivots.length; i++) {
      this.bellCrankPivots[i].rotation.x = state.torsionTwist * 0.85;
    }
    this.spaceCarriageGroup.position.y = -state.spacePress * 0.12;
    this.spaceCarriageGroup.position.z = state.spacePress * 0.14;

    // 4. Coupled Right Return handle + vertical Return Pull-Rod train (+ subtle Backspace coupling)
    const rightDrive = Math.max(state.returnPress, state.backspacePress * 0.45);
    this.returnAssemblyGroup.position.y = -rightDrive * 0.12;
    this.returnAssemblyGroup.position.z = rightDrive * 0.11;
    this.returnRodGroup.position.z = rightDrive * 0.11;

    // 5. Coupled Left Shift housing + vertical Shift Guide Rods train (+ 123 / Emoji coupling)
    const leftDrive = Math.max(state.shiftPress, state.modeKeyPress * 0.65, state.emojiPress * 0.4);
    this.shiftLeftGroup.position.y = -leftDrive * 0.12;
    this.shiftLeftGroup.position.z = leftDrive * 0.08;
    this.shiftRodsGroup.position.z = leftDrive * 0.08;

    // 6. Eccentric Cam Roller rotation coupled to Row 3 #3 key & carriage motion
    if (this.eccentricRollerGroup) {
      const rollerDrive = (state.keyPress[21] ?? 0) * 1.4 + state.spacePress * 0.9;
      this.eccentricRollerGroup.rotation.y = rollerDrive;
    }

    // 7. Tier 6: All 32 Vintage Chrome-Bezel Porcelain Typewriter Keys + Live GLSL SDF Contact Shadows
    this.tierGroups.keycapArray.position.y = getTierElevation('keycapArray', e);
    if (this.tierGroups.keycapArray.visible) {
      const isCutaway = this.keycapViewMode === 'cutaway';
      const d = this.instDummy;
      const shadowPress = this.dynamicShadowUniforms?.uKeyPress.value;

      const cutawayChanged = isCutaway !== this.prevCutawayForCollets;
      this.prevCutawayForCollets = isCutaway;
      let anyColletUpdated = false;

      for (let i = 0; i < this.keycapGroups.length; i++) {
        const stroke = state.keyPress[i];
        const isGhostKey = isCutaway && this.keycapIsRightBank[i];
        const lift = isGhostKey ? 0.34 : 0;
        const py = -stroke * 0.145 + lift;
        const grp = this.keycapGroups[i];
        grp.position.y = py;
        grp.rotation.x = stroke * 0.048;

        if (shadowPress) shadowPress[i] = stroke;

        if (cutawayChanged || Math.abs(stroke - this.prevColletPress[i]) >= 0.00025) {
          this.prevColletPress[i] = stroke;
          anyColletUpdated = true;
          const c = this.plungerCoords[i];
          d.position.set(c.x, py - 0.14, c.z);
          d.rotation.set(stroke * 0.048, 0, 0);
          const s = isGhostKey ? 0 : 1;
          d.scale.set(s, s, s);
          d.updateMatrix();
          this.instKeycapCollets?.setMatrixAt(i, d.matrix);
        }
      }
      if (anyColletUpdated && this.instKeycapCollets) {
        this.instKeycapCollets.instanceMatrix.needsUpdate = true;
      }

      const cutawayModLift = isCutaway ? 0.34 : 0;

      // 26: Left Shift pill
      this.shiftKeycapGroup.position.y = -state.shiftPress * 0.135;
      this.shiftKeycapGroup.position.z = state.shiftPress * 0.04;
      this.shiftKeycapGroup.rotation.x = state.shiftPress * 0.04;

      // 27: Right Crimson Backspace pill
      this.backspaceKeycapGroup.position.y = -state.backspacePress * 0.145 + cutawayModLift;
      this.backspaceKeycapGroup.position.z = state.backspacePress * 0.04;
      this.backspaceKeycapGroup.rotation.x = state.backspacePress * 0.045;

      // 28: Bottom-Left 123 / ABC mode toggle pill
      this.modeKeycapGroup.position.y = -state.modeKeyPress * 0.135;
      this.modeKeycapGroup.position.z = state.modeKeyPress * 0.03;
      this.modeKeycapGroup.rotation.x = state.modeKeyPress * 0.04;

      // 29: Bottom-Left Circular Emoji key
      this.emojiKeycapGroup.position.y = -state.emojiPress * 0.145;
      this.emojiKeycapGroup.rotation.x = state.emojiPress * 0.045;

      // 30: Center Spacebar pill
      this.spaceKeycapGroup.position.y = -state.spacePress * 0.13 + cutawayModLift;
      this.spaceKeycapGroup.position.z = state.spacePress * 0.08;
      this.spaceKeycapGroup.rotation.x = state.spacePress * 0.035;

      // 31: Bottom-Right Return pill
      this.returnKeycapGroup.position.y = -state.returnPress * 0.135 + cutawayModLift;
      this.returnKeycapGroup.position.z = state.returnPress * 0.06;
      this.returnKeycapGroup.rotation.x = state.returnPress * 0.04;

      // Sync real-time GLSL 32-key SDF contact shadow uniforms
      if (this.dynamicShadowUniforms && shadowPress) {
        shadowPress[26] = state.shiftPress;
        shadowPress[27] = state.backspacePress;
        shadowPress[28] = state.modeKeyPress;
        shadowPress[29] = state.emojiPress;
        shadowPress[30] = state.spacePress;
        shadowPress[31] = state.returnPress;
        this.dynamicShadowUniforms.uExplode.value = e;
        this.dynamicShadowUniforms.uModeMask.value = isCutaway ? 1.0 : 2.0;
      }
    } else if (this.dynamicShadowUniforms) {
      this.dynamicShadowUniforms.uModeMask.value = 0.0;
    }
  }

  /**
   * Tier 6: Complete 32-Key Vintage Chrome-Bezel Porcelain Typewriter Matrix
   * reverse-engineered directly from the reference video:
   * - 26 Circular Chrome-Bezel Porcelain Keys (Q..M / 1..0 & Symbols) with lathe-turned bezels,
   *   concave alabaster porcelain dishes, slab-serif double-shot legends, and chrome collets
   * - Row 3 Left Shift Pill (⇧ / #+=)
   * - Row 3 Right Signature Glossy Crimson-Red Backspace Pill (⌫)
   * - Row 4 Bottom-Left Mode Toggle Pill (123 / ABC)
   * - Row 4 Bottom-Left Circular Emoji Key (☺)
   * - Row 4 Center Blank Porcelain Spacebar Pill
   * - Row 4 Bottom-Right Return Pill (↵)
   * - Real-time 32-key Analytical SDF Contact Shadow Shader Plane seated on the studio deck
   */
  private buildKeycapArray(): void {
    const tier = this.tierGroups.keycapArray;
    const capH = 0.24;

    const roundBezelGeo = this.trackGeo(createTypewriterRoundBezelGeometry(0.485, capH, this.highDetail));
    const roundEnamelGeo = this.trackGeo(
      createTypewriterRoundEnamelGeometry(0.415, capH, 0.032, this.highDetail),
    );
    const colletGeo = this.trackGeo(
      new THREE.CylinderGeometry(0.145, 0.185, 0.11, this.highDetail ? 16 : 10),
    );

    // 0..25: 26 Circular QWERTY / Symbol Keys
    for (let i = 0; i < KEY_ACTUATORS.length; i++) {
      const act = KEY_ACTUATORS[i];
      const cx = toX(act.u);
      const cz = toZ(act.v);
      const meta: InteractiveUserData = {
        partCategory: 'keycap',
        actionType: 'key',
        keyIndex: act.index,
        label: `Typewriter Key [${act.keyLabel}] (Row ${act.row + 1} · Col ${act.col + 1})`,
      };

      const kGroup = new THREE.Group();
      kGroup.position.set(cx, 0, cz);

      const bezelMesh = this.makeMesh(roundBezelGeo, this.materials.keycapChromeBezel, meta, true, true);
      const enamelMesh = this.makeMesh(roundEnamelGeo, this.materials.keycapPorcelain, meta, false, true);
      const legendGeo = this.trackGeo(
        createTypewriterRoundLegendGeometry(0.415, capH, 0.032, i, 6),
      );
      const legendMesh = this.makeMesh(legendGeo, this.materials.keycapLegend, meta, false, false);

      kGroup.add(bezelMesh, enamelMesh, legendMesh);
      tier.add(kGroup);

      this.keycapGroups.push(kGroup);
      this.keycapBezelMeshes.push(bezelMesh);
      this.keycapEnamelMeshes.push(enamelMesh);
      this.keycapIsRightBank.push(act.u >= 0.49);
    }

    // Batch all 26 machined underside chrome mounting collets into 1 dynamic InstancedMesh
    const collets = new THREE.InstancedMesh(
      colletGeo,
      this.materials.mirrorChrome,
      KEY_ACTUATORS.length,
    );
    collets.castShadow = false;
    collets.receiveShadow = true;
    collets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    tier.add(collets);
    this.instKeycapCollets = collets;

    const stabPostGeo = this.trackGeo(
      new THREE.CylinderGeometry(0.068, 0.082, 0.22, this.highDetail ? 14 : 10),
    );

    // Shared geometry for 1.48 x 0.96 standard modifier pills (Shift, Crimson Backspace, 123/ABC)
    const modPillBezelGeo = this.trackGeo(
      createTypewriterPillBezelGeometry(1.48, 0.96, capH, 0.072, this.highDetail),
    );
    const modPillEnamelGeo = this.trackGeo(
      createTypewriterPillEnamelGeometry(1.48, 0.96, capH, 0.072, 0.024, this.highDetail),
    );

    // 26: Row 3 Left Shift Pill (⇧ / #+=) at u = 0.095, v = 0.598
    {
      this.shiftKeycapGroup.name = 'shift-keycap-group';
      tier.add(this.shiftKeycapGroup);
      const sx = toX(0.095);
      const sz = toZ(0.598);
      const meta: InteractiveUserData = {
        partCategory: 'keycap',
        actionType: 'shift',
        label: 'Left Shift Chrome-Bezel Pill Key [⇧]',
      };
      const bezel = this.makeMesh(modPillBezelGeo, this.materials.keycapChromeBezel, meta);
      const enamel = this.makeMesh(modPillEnamelGeo, this.materials.keycapPorcelain, meta, false, true);
      const legendGeo = this.trackGeo(
        createTypewriterPillLegendGeometry(1.48, 0.96, capH, 0.024, 26, 6),
      );
      const legend = this.makeMesh(legendGeo, this.materials.keycapLegend, meta, false, false);
      bezel.position.set(sx, 0, sz);
      enamel.position.set(sx, 0, sz);
      legend.position.set(sx, 0, sz);
      this.shiftKeycapGroup.add(bezel, enamel, legend);
      this.shiftBezelMesh = bezel;
      this.shiftEnamelMesh = enamel;

      const post = this.makeMesh(stabPostGeo, this.materials.mirrorChrome, meta, false, false);
      post.position.set(sx, -0.15, sz);
      this.shiftKeycapGroup.add(post);
    }

    // 27: Row 3 Right Signature Glossy Crimson-Red Backspace Pill (⌫) at u = 0.905, v = 0.598
    {
      this.backspaceKeycapGroup.name = 'backspace-keycap-group';
      tier.add(this.backspaceKeycapGroup);
      const bx = toX(0.905);
      const bz = toZ(0.598);
      const meta: InteractiveUserData = {
        partCategory: 'keycap',
        actionType: 'backspace',
        label: 'Crimson Enamel Backspace Pill Key [⌫]',
      };
      const bezel = this.makeMesh(modPillBezelGeo, this.materials.keycapChromeBezel, meta);
      const enamel = this.makeMesh(modPillEnamelGeo, this.materials.keycapCrimson, meta, false, true);
      const legendGeo = this.trackGeo(
        createTypewriterPillLegendGeometry(1.48, 0.96, capH, 0.024, 27, 6),
      );
      const legend = this.makeMesh(legendGeo, this.materials.keycapLegend, meta, false, false);
      bezel.position.set(bx, 0, bz);
      enamel.position.set(bx, 0, bz);
      legend.position.set(bx, 0, bz);
      this.backspaceKeycapGroup.add(bezel, enamel, legend);
      this.backspaceBezelMesh = bezel;
      this.backspaceEnamelMesh = enamel;

      const post = this.makeMesh(stabPostGeo, this.materials.mirrorChrome, meta, false, false);
      post.position.set(bx, -0.15, bz);
      this.backspaceKeycapGroup.add(post);
    }

    // 28: Row 4 Bottom-Left Mode Toggle Pill (123 / ABC) at u = 0.095, v = 0.728
    {
      this.modeKeycapGroup.name = 'mode-keycap-group';
      tier.add(this.modeKeycapGroup);
      const mx = toX(0.095);
      const mz = toZ(0.728);
      const meta: InteractiveUserData = {
        partCategory: 'keycap',
        actionType: 'mode',
        label: 'Numeric / Symbol Layer Switch Key [123 / ABC]',
      };
      const bezel = this.makeMesh(modPillBezelGeo, this.materials.keycapChromeBezel, meta);
      const enamel = this.makeMesh(modPillEnamelGeo, this.materials.keycapPorcelain, meta, false, true);
      const legendGeo = this.trackGeo(
        createTypewriterPillLegendGeometry(1.48, 0.96, capH, 0.024, 28, 6),
      );
      const legend = this.makeMesh(legendGeo, this.materials.keycapLegend, meta, false, false);
      bezel.position.set(mx, 0, mz);
      enamel.position.set(mx, 0, mz);
      legend.position.set(mx, 0, mz);
      this.modeKeycapGroup.add(bezel, enamel, legend);
      this.modeBezelMesh = bezel;
      this.modeEnamelMesh = enamel;

      const post = this.makeMesh(stabPostGeo, this.materials.mirrorChrome, meta, false, false);
      post.position.set(mx, -0.15, mz);
      this.modeKeycapGroup.add(post);
    }

    // 29: Row 4 Bottom-Left Circular Emoji Key (☺) at u = 0.214, v = 0.728 (over I-Beam spherical boss)
    {
      this.emojiKeycapGroup.name = 'emoji-keycap-group';
      tier.add(this.emojiKeycapGroup);
      const ex = toX(0.214);
      const ez = toZ(0.728);
      const meta: InteractiveUserData = {
        partCategory: 'keycap',
        actionType: 'emoji',
        label: 'Circular Chrome-Bezel Emoji Key [☺]',
      };
      const emojiBezelGeo = this.trackGeo(createTypewriterRoundBezelGeometry(0.48, capH, this.highDetail));
      const emojiEnamelGeo = this.trackGeo(
        createTypewriterRoundEnamelGeometry(0.41, capH, 0.032, this.highDetail),
      );
      const emojiLegendGeo = this.trackGeo(
        createTypewriterRoundLegendGeometry(0.41, capH, 0.032, 29, 6),
      );
      const bezel = this.makeMesh(emojiBezelGeo, this.materials.keycapChromeBezel, meta);
      const enamel = this.makeMesh(emojiEnamelGeo, this.materials.keycapPorcelain, meta, false, true);
      const legend = this.makeMesh(emojiLegendGeo, this.materials.keycapLegend, meta, false, false);
      bezel.position.set(ex, 0, ez);
      enamel.position.set(ex, 0, ez);
      legend.position.set(ex, 0, ez);
      this.emojiKeycapGroup.add(bezel, enamel, legend);
      this.emojiBezelMesh = bezel;
      this.emojiEnamelMesh = enamel;

      const post = this.makeMesh(stabPostGeo, this.materials.mirrorChrome, meta, false, false);
      post.position.set(ex, -0.15, ez);
      this.emojiKeycapGroup.add(post);
    }

    // 30: Row 4 Center Blank Porcelain Spacebar Pill at u = 0.499, v = 0.728 (width = 5.42)
    {
      this.spaceKeycapGroup.name = 'spacebar-keycap-group';
      tier.add(this.spaceKeycapGroup);
      const spaceX = toX(0.499);
      const spaceZ = toZ(0.728);
      const spaceW = 5.42;
      const meta: InteractiveUserData = {
        partCategory: 'keycap',
        actionType: 'space',
        label: 'Chrome-Bezel Porcelain Spacebar Pill',
      };
      const bezelGeo = this.trackGeo(
        createTypewriterPillBezelGeometry(spaceW, 0.96, capH, 0.072, this.highDetail),
      );
      const enamelGeo = this.trackGeo(
        createTypewriterPillEnamelGeometry(spaceW, 0.96, capH, 0.072, 0.022, this.highDetail),
      );
      const bezel = this.makeMesh(bezelGeo, this.materials.keycapChromeBezel, meta);
      const enamel = this.makeMesh(enamelGeo, this.materials.keycapPorcelain, meta, false, true);
      bezel.position.set(spaceX, 0, spaceZ);
      enamel.position.set(spaceX, 0, spaceZ);
      this.spaceKeycapGroup.add(bezel, enamel);
      this.spaceBezelMesh = bezel;
      this.spaceEnamelMesh = enamel;

      for (const uStab of [0.425, 0.604]) {
        const post = this.makeMesh(stabPostGeo, this.materials.mirrorChrome, meta, false, false);
        post.position.set(toX(uStab), -0.16, spaceZ);
        this.spaceKeycapGroup.add(post);
      }
    }

    // 31: Row 4 Bottom-Right Return Pill (↵) at u = 0.858, v = 0.728 (width = 2.74 over STADIUM_HANDLE)
    {
      this.returnKeycapGroup.name = 'return-keycap-group';
      tier.add(this.returnKeycapGroup);
      const retX = toX(0.858);
      const retZ = toZ(0.728);
      const retW = 2.74;
      const meta: InteractiveUserData = {
        partCategory: 'keycap',
        actionType: 'return',
        label: 'Chrome-Bezel Porcelain Return Pill Key [↵]',
      };
      const bezelGeo = this.trackGeo(
        createTypewriterPillBezelGeometry(retW, 0.96, capH, 0.072, this.highDetail),
      );
      const enamelGeo = this.trackGeo(
        createTypewriterPillEnamelGeometry(retW, 0.96, capH, 0.072, 0.024, this.highDetail),
      );
      const legendGeo = this.trackGeo(
        createTypewriterPillLegendGeometry(retW, 0.96, capH, 0.024, 30, 6),
      );
      const bezel = this.makeMesh(bezelGeo, this.materials.keycapChromeBezel, meta);
      const enamel = this.makeMesh(enamelGeo, this.materials.keycapPorcelain, meta, false, true);
      const legend = this.makeMesh(legendGeo, this.materials.keycapLegend, meta, false, false);
      bezel.position.set(retX, 0, retZ);
      enamel.position.set(retX, 0, retZ);
      legend.position.set(retX, 0, retZ);
      this.returnKeycapGroup.add(bezel, enamel, legend);
      this.returnBezelMesh = bezel;
      this.returnEnamelMesh = enamel;

      for (const uRail of [0.828, 0.903]) {
        const post = this.makeMesh(stabPostGeo, this.materials.mirrorChrome, meta, false, false);
        post.position.set(toX(uRail), -0.15, retZ);
        this.returnKeycapGroup.add(post);
      }
    }

    // Live 32-Key Analytical SDF Reactive Contact Shadow Plane anchored directly on the studio tabletop
    const { material: shadowMat, uniforms: shadowUniforms } = createDynamicKeyShadowMaterial();
    const dynShadowGeo = this.trackGeo(createDynamicShadowPlaneGeometry());
    const dynShadowMesh = new THREE.Mesh(dynShadowGeo, shadowMat);
    dynShadowMesh.position.set(0, 0.026, 0);
    dynShadowMesh.renderOrder = 1;
    this.root.add(dynShadowMesh);
    this.dynamicShadowMat = shadowMat;
    this.dynamicShadowUniforms = shadowUniforms;
  }

  public getKeycapViewMode(): KeycapViewMode {
    return this.keycapViewMode;
  }

  public getKeycapLayoutMode(): KeycapLayoutMode {
    return this.keycapLayoutMode;
  }

  public setKeycapLayoutMode(layout: KeycapLayoutMode): void {
    this.keycapLayoutMode = layout;
    setKeycapLayout(this.materials, layout);
  }

  public setKeycapViewMode(mode: KeycapViewMode): void {
    this.keycapViewMode = mode;
    if (mode === 'mechanism') {
      this.tierGroups.keycapArray.visible = false;
      if (this.dynamicShadowUniforms) this.dynamicShadowUniforms.uModeMask.value = 0.0;
      return;
    }

    this.tierGroups.keycapArray.visible = true;
    const isCutaway = mode === 'cutaway';
    if (this.dynamicShadowUniforms) {
      this.dynamicShadowUniforms.uModeMask.value = isCutaway ? 1.0 : 2.0;
    }

    for (let i = 0; i < this.keycapBezelMeshes.length; i++) {
      const useGhost = isCutaway && this.keycapIsRightBank[i];
      this.keycapBezelMeshes[i].material = useGhost
        ? this.materials.keycapGhost
        : this.materials.keycapChromeBezel;
      this.keycapBezelMeshes[i].castShadow = !useGhost;
      this.keycapEnamelMeshes[i].material = useGhost
        ? this.materials.keycapGhost
        : this.materials.keycapPorcelain;
    }

    const applyPair = (
      bezel: THREE.Mesh | null,
      enamel: THREE.Mesh | null,
      solidEnamelMat: THREE.Material,
      ghosted: boolean,
    ) => {
      if (bezel) {
        bezel.material = ghosted ? this.materials.keycapGhost : this.materials.keycapChromeBezel;
        bezel.castShadow = !ghosted;
      }
      if (enamel) {
        enamel.material = ghosted ? this.materials.keycapGhost : solidEnamelMat;
      }
    };

    applyPair(this.shiftBezelMesh, this.shiftEnamelMesh, this.materials.keycapPorcelain, false);
    applyPair(this.modeBezelMesh, this.modeEnamelMesh, this.materials.keycapPorcelain, false);
    applyPair(this.emojiBezelMesh, this.emojiEnamelMesh, this.materials.keycapPorcelain, false);
    applyPair(
      this.backspaceBezelMesh,
      this.backspaceEnamelMesh,
      this.materials.keycapCrimson,
      isCutaway,
    );
    applyPair(this.spaceBezelMesh, this.spaceEnamelMesh, this.materials.keycapPorcelain, isCutaway);
    applyPair(
      this.returnBezelMesh,
      this.returnEnamelMesh,
      this.materials.keycapPorcelain,
      isCutaway,
    );
  }

  public dispose(): void {
    for (const geo of this.disposableGeometries) {
      geo.dispose();
    }
    this.disposableGeometries.length = 0;
    this.dynamicShadowMat?.dispose();
    this.dynamicShadowMat = null;
  }
}
