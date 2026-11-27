import * as THREE from 'three';

/**
 * Helper to create a rounded-rectangle 2D Shape centered at (0, 0).
 */
export function createRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const r = Math.min(radius, width * 0.49, height * 0.49);
  const hw = width * 0.5;
  const hh = height * 0.5;
  const s = new THREE.Shape();
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r);
  s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + r);
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return s;
}

/**
 * Precision bent spring-steel comb keybar:
 * Extruded along X (bar width) from a side-profile in the Z-Y plane so the rear end (z = 0)
 * curves smoothly downward through a 90° elbow tang into the chassis depth, with a real
 * punched rear fulcrum bore hole so the continuous steel fulcrum axle threads straight through!
 */
export function createCombBarGeometry(
  lengthZ: number,
  widthX: number,
  thicknessY: number,
  hookDropY: number,
  hasBottomTab: boolean,
): THREE.BufferGeometry {
  const rOuter = 0.21;
  const rInner = Math.max(0.06, rOuter - thicknessY);
  const tipLen = hasBottomTab ? lengthZ : lengthZ;

  const profile = new THREE.Shape();
  profile.moveTo(0, -hookDropY);
  profile.lineTo(0, -rOuter);
  profile.absarc(rOuter, -rOuter, rOuter, Math.PI, Math.PI / 2, true);
  profile.lineTo(tipLen - thicknessY * 0.5, 0);
  profile.absarc(
    tipLen - thicknessY * 0.5,
    -thicknessY * 0.5,
    thicknessY * 0.5,
    Math.PI / 2,
    -Math.PI / 2,
    true,
  );
  profile.lineTo(rOuter, -thicknessY);
  profile.absarc(rOuter, -rOuter, rInner, Math.PI / 2, Math.PI, false);
  profile.lineTo(thicknessY, -hookDropY);
  profile.absarc(thicknessY * 0.5, -hookDropY, thicknessY * 0.5, 0, Math.PI, true);

  const bevel = Math.min(0.017, widthX * 0.14);
  const geo = new THREE.ExtrudeGeometry(profile, {
    depth: Math.max(0.02, widthX - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.85,
    bevelSegments: 2,
    curveSegments: 10,
  });

  geo.translate(0, 0, -(widthX - bevel * 2) * 0.5);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * CNC-turned stepped circular key-pad plunger disc using LatheGeometry.
 * Features double-chamfered outer bezel, micro-grooved rim, slight concave dish lip,
 * and deep stepped underside guide collar that seats onto the vertical push-rod.
 */
export function createPlungerDiscGeometry(
  radius = 0.212,
  height = 0.092,
  radialSegments = 28,
): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0.0, -height * 0.82),
    new THREE.Vector2(radius * 0.42, -height * 0.82),
    new THREE.Vector2(radius * 0.46, -height * 0.55),
    new THREE.Vector2(radius * 0.58, -height * 0.48),
    new THREE.Vector2(radius * 0.62, -height * 0.28),
    new THREE.Vector2(radius * 0.94, -height * 0.24),
    new THREE.Vector2(radius, -height * 0.12),
    new THREE.Vector2(radius, height * 0.14),
    new THREE.Vector2(radius * 0.96, height * 0.19),
    new THREE.Vector2(radius, height * 0.24),
    new THREE.Vector2(radius, height * 0.4),
    new THREE.Vector2(radius * 0.91, height * 0.54),
    new THREE.Vector2(radius * 0.78, height * 0.54),
    new THREE.Vector2(radius * 0.72, height * 0.44),
    new THREE.Vector2(0.0, height * 0.43),
  ];
  const geo = new THREE.LatheGeometry(pts, radialSegments);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Inner recessed brushed disc cap sitting slightly recessed inside the plunger bezel.
 */
export function createPlungerInsetGeometry(radius = 0.156, height = 0.018): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(radius, radius * 1.03, height, 24);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Compact 5-turn helical return micro-spring wound around the vertical Y axis
 * underneath every circular plunger disc (connects plunger collar to gimbal guide bushing).
 */
export function createMicroReturnSpringGeometry(
  heightY = 0.19,
  coilRadius = 0.068,
  wireRadius = 0.011,
  turns = 4.5,
  highDetail = true,
): THREE.BufferGeometry {
  const steps = Math.round(turns * (highDetail ? 9 : 6));
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const theta = t * turns * Math.PI * 2;
    pts.push(
      new THREE.Vector3(
        Math.cos(theta) * coilRadius,
        -t * heightY,
        Math.sin(theta) * coilRadius,
      ),
    );
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, steps, wireRadius, highDetail ? 6 : 4, false);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Precision machined bell-crank rocker arm clamping onto the horizontal torsion axle
 * and reaching forward/upward to couple into the lower helical spring clevis ferrule.
 */
export function createBellCrankLeverGeometry(
  armLength = 0.26,
  widthX = 0.065,
  hubRadius = 0.095,
): THREE.BufferGeometry {
  const s = new THREE.Shape();
  // Side profile in Z-Y plane (x2d = +Z forward, y2d = +Y up)
  s.absarc(0, 0, hubRadius, Math.PI * 0.6, Math.PI * 1.65, false);
  s.lineTo(armLength, -0.042);
  s.absarc(armLength, 0.015, 0.056, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(0.02, hubRadius * 0.92);
  s.closePath();

  const bevel = 0.012;
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.02, widthX - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelSegments: 2,
    curveSegments: 12,
  });
  geo.translate(0, 0, -(widthX - bevel * 2) * 0.5);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Machined U-shaped clevis yoke fork sitting at the base of a plunger push-rod
 * to straddle and physically engage the comb keybar spine beneath it.
 */
export function createClevisForkGeometry(
  outerW = 0.195,
  slotW = 0.148,
  heightY = 0.13,
  depthZ = 0.115,
  highDetail = true,
): THREE.BufferGeometry {
  const hw = outerW * 0.5;
  const sw = slotW * 0.5;
  const hh = heightY * 0.5;
  const topBar = heightY * 0.34;

  const s = new THREE.Shape();
  s.moveTo(-hw, -hh);
  s.lineTo(-sw, -hh);
  s.lineTo(-sw, hh - topBar);
  s.lineTo(sw, hh - topBar);
  s.lineTo(sw, -hh);
  s.lineTo(hw, -hh);
  s.lineTo(hw, hh);
  s.lineTo(-hw, hh);
  s.closePath();

  const bevel = 0.01;
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.02, depthZ - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.75,
    bevelSegments: highDetail ? 2 : 1,
  });
  geo.translate(0, 0, -(depthZ - bevel * 2) * 0.5);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Machined bearing pillow block anchoring the left and right ends of the rear comb fulcrum axle.
 */
export function createBearingPillowBlockGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.18, -0.16);
  s.lineTo(0.18, -0.16);
  s.lineTo(0.18, -0.05);
  s.quadraticCurveTo(0.13, -0.04, 0.11, 0.06);
  s.absarc(0, 0.06, 0.11, 0, Math.PI, false);
  s.quadraticCurveTo(-0.13, -0.04, -0.18, -0.05);
  s.closePath();

  const bevel = 0.014;
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.11,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelSegments: 2,
    curveSegments: 14,
  });
  geo.translate(0, 0, -0.055);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Split circular C-arc gimbal guard bracket (North or South arc around each plunger disc).
 */
export function createSplitCArcGeometry(
  arcRadius: number,
  halfAngle: number,
  tubeRadius: number,
  isNorth: boolean,
  highDetail = true,
): THREE.BufferGeometry {
  const centerAngle = isNorth ? -Math.PI / 2 : Math.PI / 2;
  const segments = highDetail ? 18 : 12;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = centerAngle - halfAngle + t * (halfAngle * 2);
    pts.push(new THREE.Vector3(Math.cos(angle) * arcRadius, 0, Math.sin(angle) * arcRadius));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, highDetail ? 22 : 14, tubeRadius, highDetail ? 8 : 6, false);
  geo.scale(1, 1.45, 1);
  geo.computeVertexNormals();
  return geo;
}

/**
 * True 3D helical tension coil spring along the Z axis, spanning z = 0 (top hook) to z = lengthZ.
 */
export function createHelicalSpringGeometry(
  lengthZ: number,
  coilRadius: number,
  wireRadius: number,
  turns: number,
): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const hookLen = lengthZ * 0.11;
  const coilStart = hookLen;
  const coilEnd = lengthZ - hookLen;
  const coilLen = coilEnd - coilStart;

  pts.push(new THREE.Vector3(0, 0.01, 0));
  pts.push(new THREE.Vector3(0, 0.02, hookLen * 0.45));
  pts.push(new THREE.Vector3(coilRadius * 0.55, 0.015, hookLen * 0.85));

  const stepsPerTurn = 11;
  const totalSteps = turns * stepsPerTurn;
  for (let i = 0; i <= totalSteps; i++) {
    const t = i / totalSteps;
    const theta = t * turns * Math.PI * 2;
    const x = Math.cos(theta) * coilRadius;
    const y = Math.sin(theta) * coilRadius;
    const z = coilStart + t * coilLen;
    pts.push(new THREE.Vector3(x, y, z));
  }

  pts.push(new THREE.Vector3(coilRadius * 0.55, -0.015, lengthZ - hookLen * 0.85));
  pts.push(new THREE.Vector3(0, -0.02, lengthZ - hookLen * 0.45));
  pts.push(new THREE.Vector3(0, 0, lengthZ));

  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, totalSteps + 18, wireRadius, 7, false);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Horizontal torsion spring wrap coiled around the lower pivot shaft (along X axis).
 */
export function createTorsionCoilGeometry(
  lengthX: number,
  coilRadius: number,
  wireRadius: number,
  turns: number,
): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const steps = turns * 11;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const theta = t * turns * Math.PI * 2;
    const x = (t - 0.5) * lengthX;
    const y = Math.sin(theta) * coilRadius;
    const z = Math.cos(theta) * coilRadius;
    pts.push(new THREE.Vector3(x, y, z));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, steps, wireRadius, 7, false);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Closed stadium / oval return handle loop in the X-Z plane centered at (0, 0, 0).
 */
export function createStadiumLoopGeometry(
  totalWidthX: number,
  totalHeightZ: number,
  tubeRadius: number,
): THREE.BufferGeometry {
  const r = (totalHeightZ - tubeRadius * 2) * 0.5;
  const halfStraight = Math.max(0.05, totalWidthX * 0.5 - r - tubeRadius);

  const pts: THREE.Vector3[] = [];
  const arcSegs = 16;

  for (let i = 0; i <= arcSegs; i++) {
    const a = -Math.PI / 2 + (i / arcSegs) * Math.PI;
    pts.push(new THREE.Vector3(halfStraight + Math.cos(a) * r, 0, Math.sin(a) * r));
  }
  for (let i = 0; i <= arcSegs; i++) {
    const a = Math.PI / 2 + (i / arcSegs) * Math.PI;
    pts.push(new THREE.Vector3(-halfStraight + Math.cos(a) * r, 0, Math.sin(a) * r));
  }

  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.2);
  const geo = new THREE.TubeGeometry(curve, 68, tubeRadius, 12, true);
  geo.scale(1, 1.38, 1);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Stamped & beveled ear-flange mounting bracket with a real circular through-hole.
 */
export function createEarBracketGeometry(side: 'left' | 'right'): THREE.BufferGeometry {
  const s = side === 'left' ? 1 : -1;
  const earOffsetX = -0.25 * s;
  const earRadius = 0.21;
  const holeRadius = 0.095;

  const shape = new THREE.Shape();
  if (side === 'left') {
    shape.moveTo(-0.07, 0.32);
    shape.lineTo(-0.07, 0.2);
    shape.quadraticCurveTo(-0.14, 0.21, earOffsetX, earRadius);
    shape.absarc(earOffsetX, 0, earRadius, Math.PI / 2, (Math.PI * 3) / 2, false);
    shape.quadraticCurveTo(-0.13, -0.21, -0.07, -0.28);
    shape.lineTo(-0.07, -1.16);
    shape.absarc(0.0, -1.16, 0.07, Math.PI, 0, false);
    shape.lineTo(0.07, -0.58);
    shape.quadraticCurveTo(0.09, -0.5, 0.22, -0.5);
    shape.lineTo(0.32, -0.5);
    shape.lineTo(0.32, -0.37);
    shape.lineTo(0.16, -0.37);
    shape.quadraticCurveTo(0.07, -0.37, 0.07, -0.24);
    shape.lineTo(0.07, 0.32);
    shape.closePath();
  } else {
    shape.moveTo(0.07, 0.32);
    shape.lineTo(-0.07, 0.32);
    shape.lineTo(-0.07, -0.24);
    shape.quadraticCurveTo(-0.07, -0.37, -0.16, -0.37);
    shape.lineTo(-0.32, -0.37);
    shape.lineTo(-0.32, -0.5);
    shape.lineTo(-0.22, -0.5);
    shape.quadraticCurveTo(-0.09, -0.5, -0.07, -0.58);
    shape.lineTo(-0.07, -1.16);
    shape.absarc(0.0, -1.16, 0.07, Math.PI, 0, false);
    shape.lineTo(0.07, -0.28);
    shape.quadraticCurveTo(0.13, -0.21, earOffsetX, -earRadius);
    shape.absarc(earOffsetX, 0, earRadius, -Math.PI / 2, Math.PI / 2, false);
    shape.quadraticCurveTo(0.14, 0.21, 0.07, 0.2);
    shape.closePath();
  }

  const hole = new THREE.Path();
  hole.absarc(earOffsetX, 0, holeRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const depth = 0.14;
  const bevel = 0.022;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.9,
    bevelSegments: 3,
    curveSegments: 20,
  });

  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -depth * 0.5, 0);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Beveled rectangular machined housing block.
 */
export function createBeveledBlockGeometry(
  widthX: number,
  heightY: number,
  lengthZ: number,
  cornerRadius = 0.04,
  bevel = 0.022,
): THREE.BufferGeometry {
  const shape = createRoundedRectShape(
    Math.max(0.04, widthX - bevel * 2),
    Math.max(0.04, lengthZ - bevel * 2),
    cornerRadius,
  );
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.02, heightY - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 10,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -(heightY - bevel * 2) * 0.5, 0);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Machined T-shaped saddle bridge inside the right-side stadium return loop.
 */
export function createTClampGeometry(
  topWidthX: number,
  stemWidthX: number,
  totalLengthZ: number,
  heightY: number,
): THREE.BufferGeometry {
  const hwTop = topWidthX * 0.5;
  const hwStem = stemWidthX * 0.5;
  const hz = totalLengthZ * 0.5;
  const headH = totalLengthZ * 0.52;
  const r = 0.05;

  const s = new THREE.Shape();
  s.moveTo(-hwTop + r, hz);
  s.lineTo(hwTop - r, hz);
  s.quadraticCurveTo(hwTop, hz, hwTop, hz - r);
  s.lineTo(hwTop, hz - headH + r);
  s.quadraticCurveTo(hwTop, hz - headH, hwTop - r, hz - headH);
  s.lineTo(hwStem + r, hz - headH);
  s.quadraticCurveTo(hwStem, hz - headH, hwStem, hz - headH - r);
  s.lineTo(hwStem, -hz + r);
  s.quadraticCurveTo(hwStem, -hz, hwStem - r, -hz);
  s.lineTo(-hwStem + r, -hz);
  s.quadraticCurveTo(-hwStem, -hz, -hwStem, -hz + r);
  s.lineTo(-hwStem, hz - headH - r);
  s.quadraticCurveTo(-hwStem, hz - headH, -hwStem - r, hz - headH);
  s.lineTo(-hwTop + r, hz - headH);
  s.quadraticCurveTo(-hwTop, hz - headH, -hwTop, hz - headH + r);
  s.lineTo(-hwTop, hz - r);
  s.quadraticCurveTo(-hwTop, hz, -hwTop + r, hz);
  s.closePath();

  const bevel = 0.022;
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.03, heightY - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.85,
    bevelSegments: 3,
    curveSegments: 10,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -(heightY - bevel * 2) * 0.5, 0);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Smoothly beveled rod along Z with rounded ends.
 */
export function createRoundedStripGeometry(
  widthX: number,
  heightY: number,
  lengthZ: number,
): THREE.BufferGeometry {
  const shape = createRoundedRectShape(widthX, lengthZ, widthX * 0.45);
  const bevel = Math.min(0.015, widthX * 0.2, heightY * 0.25);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.015, heightY - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelSegments: 2,
    curveSegments: 10,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -(heightY - bevel * 2) * 0.5, 0);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Vintage typewriter circular polished chrome bezel ring (LatheGeometry):
 * Exact cross-section reverse-engineered from the reference video:
 * - Tapered cylindrical lower chrome collar seating cleanly over the gimbal ring
 * - Thick, softly rolled convex outer chrome shoulder & luminous specular top lip
 * - Recessed stepped inner rim wall framing the concave porcelain enamel dish
 */
export function createTypewriterRoundBezelGeometry(
  outerRadius = 0.485,
  height = 0.24,
  highDetail = true,
): THREE.BufferGeometry {
  const halfH = height * 0.5;
  const rOut = outerRadius;
  const rLip = outerRadius * 0.87;
  const rIn = outerRadius * 0.825;

  const pts: THREE.Vector2[] = [
    new THREE.Vector2(rIn * 0.92, -halfH),
    new THREE.Vector2(rOut * 0.94, -halfH),
    new THREE.Vector2(rOut * 0.99, -halfH + 0.03),
    new THREE.Vector2(rOut, -halfH + 0.085),
    new THREE.Vector2(rOut, halfH - 0.055),
    new THREE.Vector2(rOut * 0.978, halfH - 0.018),
    new THREE.Vector2(rOut * 0.935, halfH + 0.006),
    new THREE.Vector2(rLip, halfH + 0.008),
    new THREE.Vector2(rLip - 0.016, halfH - 0.005),
    new THREE.Vector2(rIn, halfH - 0.036),
    new THREE.Vector2(rIn * 0.95, halfH - 0.045),
    new THREE.Vector2(rIn * 0.92, -halfH),
  ];

  const geo = new THREE.LatheGeometry(pts, highDetail ? 44 : 28);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Vintage typewriter concave porcelain enamel circular insert (LatheGeometry):
 * Sits flush inside the stepped inner wall of the chrome bezel with a smooth
 * spherical finger-scoop dish and dark perimeter tuck crevice.
 */
export function createTypewriterRoundEnamelGeometry(
  innerRadius = 0.415,
  height = 0.24,
  dishDepth = 0.032,
  highDetail = true,
): THREE.BufferGeometry {
  const halfH = height * 0.5;
  const topY = halfH - 0.008;
  const radialSegs = highDetail ? 44 : 28;
  const ringSteps = highDetail ? 10 : 6;

  // Build exact concentric-ring concave dish + tucked outer wall with uv.x = normalized rim distance [0..1]
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Ring 0 = center point (t=0), Rings 1..ringSteps = concave dish (t=1/ringSteps..1), Ring ringSteps+1 = tucked skirt
  const rings: Array<{ r: number; y: number; t: number }> = [];
  for (let s = 0; s <= ringSteps; s++) {
    const t = s / ringSteps;
    const r = innerRadius * 0.985 * t;
    const y = topY - dishDepth * (1 - t * t);
    rings.push({ r, y, t });
  }
  rings.push({ r: innerRadius, y: topY - 0.025, t: 1.0 });
  rings.push({ r: innerRadius, y: -halfH + 0.05, t: 1.0 });

  for (let ri = 0; ri < rings.length; ri++) {
    const { r, y, t } = rings[ri];
    for (let si = 0; si <= radialSegs; si++) {
      const a = (si / radialSegs) * Math.PI * 2;
      positions.push(Math.cos(a) * r, y, Math.sin(a) * r);
      uvs.push(t, si / radialSegs);
    }
  }

  const stride = radialSegs + 1;
  for (let ri = 0; ri < rings.length - 1; ri++) {
    for (let si = 0; si < radialSegs; si++) {
      const a = ri * stride + si;
      const b = a + 1;
      const c = (ri + 1) * stride + si;
      const d = c + 1;
      // Outward/upward CCW winding
      indices.push(a, b, d, a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Concave circular UV-mapped double-shot typewriter legend disc conforming 1:1 to
 * the porcelain dish curvature and mapped to cell `cellIndex` of a 6x6 Legend Atlas.
 */
export function createTypewriterRoundLegendGeometry(
  innerRadius = 0.415,
  height = 0.24,
  dishDepth = 0.032,
  cellIndex = 0,
  gridCols = 6,
): THREE.BufferGeometry {
  const halfH = height * 0.5;
  const topY = halfH - 0.008;
  const patchR = innerRadius * 0.86;
  const geo = new THREE.PlaneGeometry(patchR * 2, patchR * 2, 8, 8);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  const col = cellIndex % gridCols;
  const row = Math.floor(cellIndex / gridCols);
  const pad = 0.015;
  const u0 = (col + pad) / gridCols;
  const uSpan = (1 - pad * 2) / gridCols;
  const vTop = 1 - (row + pad) / gridCols;
  const vBot = 1 - (row + 1 - pad) / gridCols;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r = Math.min(innerRadius * 0.985, Math.hypot(x, z));
    const t = r / (innerRadius * 0.985);
    const y = topY - dishDepth * (1 - t * t) + 0.0042;
    pos.setY(i, y);

    const rawU = uv.getX(i);
    const rawV = uv.getY(i);
    uv.setXY(i, u0 + rawU * uSpan, vBot + rawV * (vTop - vBot));
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates ordered perimeter stations around a horizontal stadium (pill) loop in the X-Z plane:
 * each station gives the spine-offset center `(cx, cz)` and outward unit normal `(nx, nz)`.
 */
function sampleStadiumPerimeter(
  halfStraightX: number,
  arcSegs: number,
  straightSegs: number,
): Array<{ cx: number; cz: number; nx: number; nz: number }> {
  const stations: Array<{ cx: number; cz: number; nx: number; nz: number }> = [];

  // Right semicircle: angle -PI/2 -> +PI/2 (top-right -> bottom-right)
  for (let i = 0; i <= arcSegs; i++) {
    const a = -Math.PI / 2 + (i / arcSegs) * Math.PI;
    stations.push({ cx: halfStraightX, cz: 0, nx: Math.cos(a), nz: Math.sin(a) });
  }
  // Bottom straight: +halfStraightX -> -halfStraightX (normal points +Z)
  for (let i = 1; i < straightSegs; i++) {
    const t = i / straightSegs;
    stations.push({
      cx: halfStraightX * (1 - 2 * t),
      cz: 0,
      nx: 0,
      nz: 1,
    });
  }
  // Left semicircle: angle +PI/2 -> +3*PI/2 (bottom-left -> top-left)
  for (let i = 0; i <= arcSegs; i++) {
    const a = Math.PI / 2 + (i / arcSegs) * Math.PI;
    stations.push({ cx: -halfStraightX, cz: 0, nx: Math.cos(a), nz: Math.sin(a) });
  }
  // Top straight: -halfStraightX -> +halfStraightX (normal points -Z)
  for (let i = 1; i < straightSegs; i++) {
    const t = i / straightSegs;
    stations.push({
      cx: -halfStraightX * (1 - 2 * t),
      cz: 0,
      nx: 0,
      nz: -1,
    });
  }
  return stations;
}

/**
 * Vintage typewriter hollow stadium (pill) polished chrome bezel ring:
 * Sweeps the EXACT SAME 12-point rolled chrome cross-section as the circular LatheGeometry bezel
 * cleanly around the closed stadium perimeter—guaranteeing identical rim thickness, specular lip
 * curvature, and an open recessed interior cavity for the porcelain or crimson enamel dish!
 */
export function createTypewriterPillBezelGeometry(
  width: number,
  depth = 0.96,
  height = 0.24,
  rimThickness = 0.072,
  highDetail = true,
): THREE.BufferGeometry {
  const halfH = height * 0.5;
  const rOut = depth * 0.5;
  const halfStraight = Math.max(0.02, width * 0.5 - rOut);
  const rIn = rOut - rimThickness;
  const rLip = rOut - rimThickness * 0.52;

  // Identical rolled chrome cross-section (radial distance from stadium spine, Y elevation)
  const profile: Array<[number, number]> = [
    [rIn - 0.012, -halfH],
    [rOut - 0.024, -halfH],
    [rOut - 0.005, -halfH + 0.03],
    [rOut, -halfH + 0.085],
    [rOut, halfH - 0.055],
    [rOut - 0.01, halfH - 0.018],
    [rOut - 0.028, halfH + 0.006],
    [rLip, halfH + 0.008],
    [rLip - 0.014, halfH - 0.005],
    [rIn, halfH - 0.036],
    [rIn - 0.012, halfH - 0.045],
    [rIn - 0.012, -halfH],
  ];

  const arcSegs = highDetail ? 20 : 12;
  const straightSegs = Math.max(2, Math.round(halfStraight * (highDetail ? 6 : 4)));
  const stations = sampleStadiumPerimeter(halfStraight, arcSegs, straightSegs);
  const nStations = stations.length;
  const nProf = profile.length;

  const positions: number[] = [];
  const indices: number[] = [];

  for (let si = 0; si <= nStations; si++) {
    const st = stations[si % nStations];
    for (let pi = 0; pi < nProf; pi++) {
      const [rad, py] = profile[pi];
      positions.push(st.cx + st.nx * rad, py, st.cz + st.nz * rad);
    }
  }

  for (let si = 0; si < nStations; si++) {
    for (let pi = 0; pi < nProf - 1; pi++) {
      const a = si * nProf + pi;
      const b = (si + 1) * nProf + pi;
      const c = si * nProf + (pi + 1);
      const d = (si + 1) * nProf + (pi + 1);
      // Outward-facing CCW winding around the swept tube
      indices.push(a, c, d, a, d, b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Recessed concave porcelain (or glossy crimson red) stadium enamel insert seated
 * flush inside the swept hollow chrome pill bezel, with exact concentric dish rings
 * and `uv.x` encoding normalized rim distance [0..1] for stadium-exact crevice AO shading!
 */
export function createTypewriterPillEnamelGeometry(
  width: number,
  depth = 0.96,
  height = 0.24,
  rimThickness = 0.072,
  dishDepth = 0.026,
  highDetail = true,
): THREE.BufferGeometry {
  const halfH = height * 0.5;
  const topY = halfH - 0.009;
  const rOut = depth * 0.5;
  const halfStraight = Math.max(0.02, width * 0.5 - rOut);
  const rIn = rOut - rimThickness + 0.008; // tucks cleanly 0.008 inside inner chrome wall

  const arcSegs = highDetail ? 20 : 12;
  const straightSegs = Math.max(2, Math.round(halfStraight * (highDetail ? 6 : 4)));
  const stations = sampleStadiumPerimeter(halfStraight, arcSegs, straightSegs);
  const nStations = stations.length;
  const ringSteps = highDetail ? 8 : 5;

  const rings: Array<{ r: number; y: number; t: number }> = [];
  for (let s = 0; s <= ringSteps; s++) {
    const t = s / ringSteps;
    const r = rIn * t;
    const y = topY - dishDepth * (1 - t * t);
    rings.push({ r, y, t });
  }
  // Short vertical tuck skirt into bezel cavity
  rings.push({ r: rIn, y: topY - 0.032, t: 1.0 });
  rings.push({ r: rIn, y: -halfH + 0.05, t: 1.0 });

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const stride = nStations + 1;

  for (let ri = 0; ri < rings.length; ri++) {
    const { r, y, t } = rings[ri];
    for (let si = 0; si <= nStations; si++) {
      const st = stations[si % nStations];
      positions.push(st.cx + st.nx * r, y, st.cz + st.nz * r);
      uvs.push(t, si / nStations);
    }
  }

  for (let ri = 0; ri < rings.length - 1; ri++) {
    for (let si = 0; si < nStations; si++) {
      const a = ri * stride + si;
      const b = a + 1;
      const c = (ri + 1) * stride + si;
      const d = c + 1;
      // Upward-facing CCW winding (stations run clockwise in X-Z from -PI/2 -> +PI/2 -> +3PI/2)
      indices.push(a, b, d, a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Aspect-preserving concave legend inlay plane seated cleanly above a pill typewriter enamel dish.
 */
export function createTypewriterPillLegendGeometry(
  width: number,
  depth = 0.96,
  height = 0.24,
  dishDepth = 0.026,
  cellIndex = 26,
  gridCols = 6,
): THREE.BufferGeometry {
  const halfH = height * 0.5;
  const topY = halfH - 0.009;
  const rOut = depth * 0.5;
  const halfStraight = Math.max(0.02, width * 0.5 - rOut);
  const rIn = rOut - 0.072 + 0.008;

  const patchSize = Math.min(width - 0.22, depth * 0.78);
  const patchW = width > depth * 1.45 ? Math.min(width * 0.62, depth * 1.15) : patchSize;
  const patchD = patchSize;

  const geo = new THREE.PlaneGeometry(patchW, patchD, 8, 6);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  const col = cellIndex % gridCols;
  const row = Math.floor(cellIndex / gridCols);
  const pad = 0.015;
  const u0 = (col + pad) / gridCols;
  const uSpan = (1 - pad * 2) / gridCols;
  const vTop = 1 - (row + pad) / gridCols;
  const vBot = 1 - (row + 1 - pad) / gridCols;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const dx = Math.max(0, Math.abs(x) - halfStraight);
    const t = Math.min(1, Math.hypot(dx, z) / rIn);
    const y = topY - dishDepth * (1 - t * t) + 0.0048;
    pos.setY(i, y);

    const rawU = uv.getX(i);
    const rawV = uv.getY(i);
    uv.setXY(i, u0 + rawU * uSpan, vBot + rawV * (vTop - vBot));
  }

  geo.computeVertexNormals();
  return geo;
}


